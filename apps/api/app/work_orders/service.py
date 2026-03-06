from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import re
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models import (
    Customer,
    EngineModel,
    Payment,
    ReceivedPartCatalog,
    User,
    WorkOrderItem,
    WorkOrderMetaHistory,
    WorkOrderReceivedPart,
    Worker,
    WorkOrder,
    work_order_workers,
)
from app.work_orders.history import add_work_order_history
from app.work_orders.schemas import WorkOrderCreate, WorkOrderUpdate

from app.payments.service import create_refund_if_overpaid

# ---- Operational status rules (MVP) ----
ALLOWED_WORK_ORDER_STATUSES = {"DRAFT", "RECIBIDO", "EN_PROCESO", "LISTO", "ENTREGADO", "CERRADO"}

# Strict workflow (MVP): allow forward transitions + allow reopening a delivered order back to LISTO.
# (Same-status updates are allowed.)
ALLOWED_STATUS_TRANSITIONS: dict[str, set[str]] = {
    # Draft workflow: start here, then explicitly move to RECIBIDO when "finalized"
    "DRAFT": {"DRAFT", "RECIBIDO"},

    "RECIBIDO": {"RECIBIDO", "EN_PROCESO"},
    "EN_PROCESO": {"EN_PROCESO", "LISTO"},
    "LISTO": {"LISTO", "ENTREGADO"},
    # Delivered can be reopened to LISTO, or closed to CERRADO (financially finished).
    "ENTREGADO": {"ENTREGADO", "LISTO", "CERRADO"},
    # Terminal: once closed, it stays closed.
    "CERRADO": {"CERRADO"},
}


def _append_audit_note(existing: str | None, msg: str) -> str:
    base = (existing or "").rstrip()
    stamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp}] {msg}"
    return f"{base}\n{line}".lstrip() if base else line


def _reopen_if_delivered(
    data: dict,
    order: WorkOrder,
    reason: str,
    actor_user_id: str | None,
) -> None:
    """If an order is ENTREGADO and we are changing content, reopen it to LISTO.

    This keeps the workflow coherent: delivered means ‘closed’, but edits reopen it.
    """
    current_status = str(order.status).upper().strip()
    if current_status != "ENTREGADO":
        return

    # If the request explicitly changes status, let the normal validation handle it.
    if "status" in data and data["status"] is not None:
        return

    data["status"] = "LISTO"
    # If caller didn’t include notes, we still append an audit note.
    data["notes"] = _append_audit_note(order.notes, f"REAPERTURA automática (antes ENTREGADO): {reason}")
    data["status_changed_at"] = datetime.utcnow()
    data["status_changed_by_id"] = actor_user_id


def _compute_order_balance(db: Session, order: WorkOrder) -> Decimal:
    """Compute saldo = total - net_paid.

    We treat refunds/returns (DEVOLUCION/REFUND) as negative payments.
    """
    total = Decimal(str(order.total or 0))

    payments = (
        db.query(Payment)
        .filter(Payment.order_id == order.id)
        .all()
    )

    net_paid = Decimal("0")
    for p in payments:
        amt = Decimal(str(getattr(p, "amount", 0) or 0))
        ptype = str(getattr(p, "type", "")).upper().strip()
        if ptype in {"DEVOLUCION", "REFUND"}:
            net_paid -= amt
        else:
            net_paid += amt

    return total - net_paid


COLLECTION_STATUS_WARNING_DAYS = 45
COLLECTION_STATUS_OVERDUE_DAYS = 60


def compute_collection_status(created_at: datetime | None) -> str:
    if created_at is None:
        return "AL_DIA"
    age_days = (date.today() - created_at.date()).days
    if age_days >= COLLECTION_STATUS_OVERDUE_DAYS:
        return "VENCIDA"
    if age_days >= COLLECTION_STATUS_WARNING_DAYS:
        return "POR_VENCER"
    return "AL_DIA"


def compute_collection_days(created_at: datetime | None) -> int:
    if created_at is None:
        return 0
    return max(0, (date.today() - created_at.date()).days)


def _order_has_items(db: Session, order: WorkOrder) -> bool:
    """Return True if the order has at least one item.

    Depending on the model, the FK can be `order_id` or `work_order_id`.
    """
    if hasattr(WorkOrderItem, "order_id"):
        fk = WorkOrderItem.order_id
    elif hasattr(WorkOrderItem, "work_order_id"):
        fk = WorkOrderItem.work_order_id
    else:
        # Fallback: no known FK field, treat as no items (will block leaving DRAFT)
        return False

    return (
        db.query(WorkOrderItem)
        .filter(fk == order.id)
        .count()
        > 0
    )


def create_work_order(db: Session, payload: WorkOrderCreate, actor_user_id: str | None = None) -> WorkOrder:
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise ValueError("Cliente no existe")

    # Validate and normalize pricing_tier
    tier = payload.pricing_tier
    if not tier:
        tier = "TD"
    tier = str(tier).upper().strip()
    if tier not in {"TD", "SC"}:
        raise ValueError("pricing_tier inválido. Usa TD o SC")

    engine_model_id = payload.engine_model_id
    if engine_model_id:
        model = db.query(EngineModel).filter(EngineModel.id == engine_model_id).first()
        if not model:
            raise ValueError("Tipo de motor no existe")

    order = WorkOrder(
        customer_id=payload.customer_id,
        piece=payload.piece,
        notes=payload.notes,
        pricing_tier=tier,
        status="DRAFT",
        status_changed_at=datetime.utcnow(),
        status_changed_by_id=actor_user_id,
        engine_model_id=engine_model_id,
        offered_for_date=payload.offered_for_date,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    if payload.received_part_ids:
        part_ids = [str(x) for x in payload.received_part_ids if x]
        if part_ids:
            parts = (
                db.query(ReceivedPartCatalog)
                .filter(ReceivedPartCatalog.id.in_(part_ids))
                .all()
            )
            if len(parts) != len(set(part_ids)):
                raise ValueError("Una o más piezas recibidas no existen")

            links = [
                WorkOrderReceivedPart(work_order_id=order.id, part_id=p.id)
                for p in parts
            ]
            db.add_all(links)
            db.commit()
            db.refresh(order)

    return order


def list_work_orders(db: Session) -> list[WorkOrder]:
    return db.query(WorkOrder).order_by(WorkOrder.created_at.desc()).all()


def get_work_order(db: Session, order_id: str) -> WorkOrder | None:
    return db.query(WorkOrder).filter(WorkOrder.id == order_id).first()


def update_work_order(
    db: Session,
    order: WorkOrder,
    payload: WorkOrderUpdate,
    actor_user_id: str | None = None,
) -> WorkOrder:
    data = payload.model_dump(exclude_unset=True)
    # --- Audit snapshot for meta fields ---
    old_engine_model_id = str(order.engine_model_id) if getattr(order, "engine_model_id", None) else None
    old_offered_for_date = (
        order.offered_for_date.isoformat()
        if getattr(order, "offered_for_date", None)
        else None
    )
    old_parts = (
        db.query(WorkOrderReceivedPart)
        .filter(WorkOrderReceivedPart.work_order_id == order.id)
        .all()
    )
    old_part_ids = [str(p.part_id) for p in old_parts]
    old_worker_ids = [str(w.id) for w in getattr(order, "assigned_workers", [])]

    # Validate pricing_tier if present
    if "pricing_tier" in data and data["pricing_tier"] is not None:
        tier = str(data["pricing_tier"]).upper().strip()
        if tier not in {"TD", "SC"}:
            raise ValueError("pricing_tier inválido. Usa TD o SC")
        data["pricing_tier"] = tier

    # If a delivered order is edited (total/piece/notes/engine/received_parts), reopen it to LISTO automatically.
    if any(
        k in data
        for k in (
            "total",
            "piece",
            "notes",
            "engine_model_id",
            "offered_for_date",
            "received_part_ids",
        )
    ):
        _reopen_if_delivered(data, order, "edición manual en PATCH", actor_user_id)

    current_status_before = str(order.status).upper().strip()

    # If status is being updated, validate transition.
    if "status" in data and data["status"] is not None:
        new_status = str(data["status"]).upper().strip()
        current_status = str(order.status).upper().strip()

        if new_status not in ALLOWED_WORK_ORDER_STATUSES:
            raise ValueError(
                "Estado inválido. Usa: DRAFT, RECIBIDO, EN_PROCESO, LISTO, ENTREGADO, CERRADO"
            )

        # Rule: Cannot deliver unless it is LISTO first.
        # (You can deliver with debt; payment is a separate concern.)
        if new_status == "ENTREGADO" and current_status != "LISTO":
            raise ValueError("No se puede ENTREGAR si la orden no está en estado LISTO")

        # Rule: Cannot leave DRAFT unless it has at least one service/item.
        if current_status == "DRAFT" and new_status != "DRAFT":
            if not _order_has_items(db, order):
                raise ValueError("No se puede pasar a RECIBIDO sin agregar al menos un servicio a la orden")

        # Rule: Cannot close unless it is fully paid (saldo == 0).
        if new_status == "CERRADO":
            saldo = _compute_order_balance(db, order)
            if saldo != Decimal("0"):
                raise ValueError(
                    f"No se puede CERRAR si hay saldo pendiente. Saldo: {saldo}"
                )

        # Optional strict workflow: only allow valid forward transitions.
        allowed_next = ALLOWED_STATUS_TRANSITIONS.get(current_status, set())
        if new_status not in allowed_next:
            raise ValueError(
                f"Transición de estado inválida: {current_status} -> {new_status}. "
                "Flujo válido: RECIBIDO→EN_PROCESO→LISTO→ENTREGADO→CERRADO (y ENTREGADO→LISTO para reabrir)"
            )

        # Normalize to uppercase so DB always stores the canonical value.
        data["status"] = new_status

        # Audit: record who changed the operational status
        if new_status != current_status_before:
            data["status_changed_at"] = datetime.utcnow()
            data["status_changed_by_id"] = actor_user_id

    # Keep previous total to decide whether an automatic refund is needed.
    old_total = Decimal(str(order.total or 0))

    # Normalize money values to Decimal.
    if "total" in data and data["total"] is not None:
        data["total"] = Decimal(str(data["total"]))
        if data["total"] < 0:
            raise ValueError("El total de la orden no puede ser negativo")

    if "engine_model_id" in data:
        engine_model_id = data["engine_model_id"]
        if engine_model_id:
            model = db.query(EngineModel).filter(EngineModel.id == engine_model_id).first()
            if not model:
                raise ValueError("Tipo de motor no existe")
        order.engine_model_id = engine_model_id

    if "offered_for_date" in data:
        order.offered_for_date = data["offered_for_date"]

    if "received_part_ids" in data:
        part_ids = data["received_part_ids"] or []
        part_ids = [str(x) for x in part_ids if x]
        parts: list[ReceivedPartCatalog] = []
        if part_ids:
            parts = (
                db.query(ReceivedPartCatalog)
                .filter(ReceivedPartCatalog.id.in_(part_ids))
                .all()
            )
            if len(parts) != len(set(part_ids)):
                raise ValueError("Una o más piezas recibidas no existen")

        db.query(WorkOrderReceivedPart).filter(WorkOrderReceivedPart.work_order_id == order.id).delete(
            synchronize_session=False
        )
        if parts:
            links = [
                WorkOrderReceivedPart(work_order_id=order.id, part_id=p.id)
                for p in parts
            ]
            db.add_all(links)

    if "assigned_worker_ids" in data:
        worker_ids = data["assigned_worker_ids"] or []
        worker_ids = [str(x) for x in worker_ids if x]
        workers: list[Worker] = []
        if worker_ids:
            workers = db.query(Worker).filter(Worker.id.in_(worker_ids)).all()
            if len(workers) != len(set(worker_ids)):
                raise ValueError("Uno o más trabajadores no existen")
        order.assigned_workers = workers
        order.assigned_worker_id = workers[0].id if workers else None
        order.assigned_at = datetime.utcnow() if workers else None

    for k, v in data.items():
        if k in {"engine_model_id", "offered_for_date", "received_part_ids", "assigned_worker_ids"}:
            continue
        setattr(order, k, v)

    # Ensure the updated total is visible to subsequent queries within the same transaction.
    db.flush()

    # ---- History (audit) ----
    changes: dict = {}
    new_engine_model_id = str(order.engine_model_id) if getattr(order, "engine_model_id", None) else None
    new_offered_for_date = (
        order.offered_for_date.isoformat()
        if getattr(order, "offered_for_date", None)
        else None
    )
    new_status = str(order.status).upper().strip()
    if "engine_model_id" in data and old_engine_model_id != new_engine_model_id:
        changes["engine_model_id"] = {"from": old_engine_model_id, "to": new_engine_model_id}

    if "offered_for_date" in data and old_offered_for_date != new_offered_for_date:
        changes["offered_for_date"] = {"from": old_offered_for_date, "to": new_offered_for_date}

    if "received_part_ids" in data:
        new_part_ids = data["received_part_ids"] or []
        new_part_ids = [str(x) for x in new_part_ids if x]
        if sorted(old_part_ids) != sorted(new_part_ids):
            changes["received_part_ids"] = {"from": old_part_ids, "to": new_part_ids}

    if "assigned_worker_ids" in data:
        new_worker_ids = [str(w.id) for w in getattr(order, "assigned_workers", [])]
        if sorted(old_worker_ids) != sorted(new_worker_ids):
            changes["assigned_worker_ids"] = {"from": old_worker_ids, "to": new_worker_ids}

    if "status" in data and current_status_before != new_status:
        changes["status"] = {"from": current_status_before, "to": new_status}

    add_work_order_history(db, order.id, changes, actor_user_id)

    # If the total was manually reduced, and the order is now overpaid, create an automatic refund.
    if "total" in data:
        new_total = Decimal(str(order.total))
        if new_total < old_total:
            create_refund_if_overpaid(db, order.id, actor_user_id=actor_user_id)

    db.commit()
    db.refresh(order)
    return order


def delete_work_order(db: Session, order: WorkOrder) -> None:
    current_status = str(order.status).upper().strip()
    if current_status != "DRAFT":
        raise ValueError("Solo se puede eliminar una orden en estado DRAFT")

    # Delete related rows (payments don't have cascade)
    db.query(Payment).filter(Payment.order_id == order.id).delete(synchronize_session=False)

    # Items have cascade, but delete explicitly for safety
    db.query(WorkOrderItem).filter(WorkOrderItem.order_id == order.id).delete(synchronize_session=False)
    db.query(WorkOrderReceivedPart).filter(WorkOrderReceivedPart.work_order_id == order.id).delete(
        synchronize_session=False
    )
    db.query(WorkOrderMetaHistory).filter(WorkOrderMetaHistory.work_order_id == order.id).delete(
        synchronize_session=False
    )
    db.execute(
        work_order_workers.delete().where(work_order_workers.c.work_order_id == order.id)
    )

    db.delete(order)
    db.commit()


def assign_work_order(db: Session, order: WorkOrder, worker_id: str) -> WorkOrder:
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise ValueError("Trabajador asignado no existe")

    if worker not in order.assigned_workers:
        order.assigned_workers.append(worker)
    order.assigned_worker_id = order.assigned_workers[0].id if order.assigned_workers else worker.id
    order.assigned_at = datetime.utcnow()

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def unassign_work_order(db: Session, order: WorkOrder) -> WorkOrder:
    order.assigned_workers = []
    order.assigned_worker_id = None
    order.assigned_at = None

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


# ---- Accounts Receivable Service ----
def list_accounts_receivable(
    db: Session,
    customer_id: str | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    min_balance: Decimal | None = None,
    collection_status: str | None = None,
) -> list[dict[str, Any]]:
    """Return work orders with saldo > 0 (accounts receivable) plus useful computed fields.

    MVP implementation uses per-order balance computation (N+1). Optimize later if needed.
    """

    q = db.query(WorkOrder)
    q = q.filter(WorkOrder.status != "DRAFT")

    filters = []
    if customer_id:
        filters.append(WorkOrder.customer_id == customer_id)

    if status:
        filters.append(WorkOrder.status == str(status).upper().strip())

    if date_from:
        filters.append(WorkOrder.created_at >= date_from)

    if date_to:
        filters.append(WorkOrder.created_at <= date_to)

    if filters:
        q = q.filter(and_(*filters))

    q = q.order_by(WorkOrder.created_at.desc())

    rows: list[dict[str, Any]] = []
    for o in q.all():
        total = Decimal(str(o.total or 0))
        balance = _compute_order_balance(db, o)
        paid_total = total - balance

        # Only accounts receivable
        if balance <= Decimal("0"):
            continue

        if min_balance is not None and balance < min_balance:
            continue

        current_collection_status = compute_collection_status(o.created_at)
        if collection_status and current_collection_status != str(collection_status).upper().strip():
            continue

        age_days = compute_collection_days(o.created_at)

        rows.append(
            {
                "id": o.id,
                "order_number": getattr(o, "order_number", None),
                "customer_id": o.customer_id,
                "status": str(o.status).upper().strip() if o.status else None,
                "pricing_tier": getattr(o, "pricing_tier", None),
                "created_at": getattr(o, "created_at", None),
                "collection_status": current_collection_status,
                "days_since_created": age_days,
                "total": str(total),
                "paid_total": str(paid_total),
                "balance": str(balance),
            }
        )

    return rows


def list_meta_history(db: Session, order_id: str) -> list[dict[str, Any]]:
    rows = (
        db.query(WorkOrderMetaHistory)
        .filter(WorkOrderMetaHistory.work_order_id == order_id)
        .order_by(WorkOrderMetaHistory.changed_at.desc())
        .all()
    )
    uuid_like = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
    actor_ids = {r.changed_by for r in rows if r.changed_by and uuid_like.match(str(r.changed_by))}
    actors_by_id = {}
    if actor_ids:
        for u in db.query(User).filter(User.id.in_(actor_ids)).all():
            if u.email:
                actors_by_id[u.id] = u.email
    return [
        {
            "id": r.id,
            "work_order_id": r.work_order_id,
            "changed_at": r.changed_at,
            "changed_by": actors_by_id.get(r.changed_by, r.changed_by),
            "changes": r.changes_json,
        }
        for r in rows
    ]
