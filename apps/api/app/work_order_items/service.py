from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import WorkOrder, WorkOrderItem, Service
from app.payments.service import create_refund_if_overpaid
from app.work_orders.history import add_work_order_history
from app.work_order_items.schemas import WorkOrderItemCreate, WorkOrderItemUpdate


def _svc_param_to_int(value: object) -> int | None:
    """Convert Service.cilindraje/valvulas/sellos (stored as str) to int|None for items.

    Accepted:
    - None -> None
    - "NO_APLICA" (any case) -> None
    - "" -> None
    - numeric strings like "6" -> 6
    - ints -> int
    """
    if value is None:
        return None
    if isinstance(value, int):
        return value
    s = str(value).strip()
    if not s:
        return None
    if s.upper() == "NO_APLICA":
        return None
    try:
        return int(s)
    except ValueError:
        raise ValueError(f"Parámetro de servicio inválido: {value!r}")


def _ensure_editable_order(db: Session, order: WorkOrder) -> None:
    """Business rule: allow editing items even if the order was ENTREGADO,
    but "re-open" it to keep the workflow coherent.

    Rationale:
    - If a delivered order changes (total may go up/down), it should stop being considered final.
    - We re-open it to LISTO (closest state to delivery).
    """
    # Make sure we see the latest status from DB
    db.refresh(order)

    status = str(order.status).upper()

    # 🔒 Closed orders are immutable for items.
    if status == "CERRADO":
        raise ValueError("No se pueden modificar servicios en una orden CERRADA")

    if status == "ENTREGADO":
        order.status = "LISTO"
        # Optional lightweight audit trail in notes (no new tables yet)
        stamp = datetime.utcnow().isoformat(timespec="seconds")
        msg = f"[AJUSTE] Orden reabierta desde ENTREGADO por edición de ítems ({stamp})."
        if order.notes:
            order.notes = f"{order.notes}\n{msg}"
        else:
            order.notes = msg
        db.add(order)
        db.flush()


def _recalc_order_total(db: Session, order: WorkOrder) -> None:
    # Ensure any pending changes to items (e.g., qty updates) are flushed
    # so the SUM query reflects the latest values.
    db.flush()

    total = (
        db.query(func.coalesce(func.sum(WorkOrderItem.qty * WorkOrderItem.unit_price), 0))
        .filter(WorkOrderItem.order_id == order.id)
        .scalar()
    )

    # Normalize to Decimal (Numeric columns usually return Decimal, but we are defensive)
    if total is None:
        total = Decimal("0")
    else:
        total = Decimal(str(total))

    order.total = total
    db.add(order)
    # Ensure the updated total is flushed before any downstream logic (e.g. refunds)
    db.flush()


def add_item(
    db: Session,
    order: WorkOrder,
    data: WorkOrderItemCreate,
    actor_user_id: str | None = None,
) -> WorkOrderItem:
    _ensure_editable_order(db, order)

    service_id = getattr(data, "service_id", None)
    unit_price_in = getattr(data, "unit_price", None)

    # If item is linked to a service, the price is computed automatically.
    if service_id is not None and unit_price_in is not None:
        raise ValueError("No se puede definir unit_price manual cuando se usa un servicio")

    unit_price = unit_price_in

    # 🔹 Precio automático desde catálogo
    if service_id:
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise ValueError("Servicio no existe")

        # 🔒 Validar que el servicio tenga precio según el tipo de orden
        if order.pricing_tier == "TD" and service.price_td is None:
            raise ValueError("Servicio sin precio TD")
        if order.pricing_tier == "SC" and service.price_sc is None:
            raise ValueError("Servicio sin precio SC")

        if order.pricing_tier == "TD":
            unit_price = service.price_td
        elif order.pricing_tier == "SC":
            unit_price = service.price_sc
        else:
            raise ValueError("Pricing tier inválido en la orden")

        # 🔹 Los parámetros también vienen del catálogo (Service es la variante con precio)
        svc_cilindraje = _svc_param_to_int(service.cilindraje)
        svc_valvulas = _svc_param_to_int(service.valvulas)
        svc_sellos = _svc_param_to_int(service.sellos)

    # Si el ítem está ligado a un servicio, los parámetros se copian del servicio.
    # Si NO está ligado a un servicio (servicio manual), se aceptan los del payload.
    item = WorkOrderItem(
        order_id=order.id,
        service_id=service_id,
        description=data.description,
        qty=data.qty,
        unit_price=unit_price,
        cilindraje=(svc_cilindraje if service_id else data.cilindraje),
        valvulas=(svc_valvulas if service_id else data.valvulas),
        sellos=(svc_sellos if service_id else data.sellos),
    )
    
    db.add(item)
    db.flush()

    add_work_order_history(
        db,
        order.id,
        {
            "item_added": {
                "item_id": item.id,
                "service_id": item.service_id,
                "description": item.description,
                "qty": item.qty,
                "unit_price": str(item.unit_price) if item.unit_price is not None else None,
            }
        },
        actor_user_id,
    )

    _recalc_order_total(db, order)

    create_refund_if_overpaid(db, order.id, actor_user_id=actor_user_id)

    db.commit()
    db.refresh(item)
    return item


def list_items(db: Session, order_id: str) -> list[WorkOrderItem]:
    return (
        db.query(WorkOrderItem)
        .filter(WorkOrderItem.order_id == order_id)
        .order_by(WorkOrderItem.created_at.asc())
        .all()
    )


def update_item(
    db: Session,
    item: WorkOrderItem,
    data: WorkOrderItemUpdate,
    actor_user_id: str | None = None,
) -> WorkOrderItem:
    order = db.query(WorkOrder).filter(WorkOrder.id == item.order_id).first()
    if not order:
        raise ValueError("Orden no existe")

    _ensure_editable_order(db, order)

    payload = data.model_dump(exclude_unset=True)
    before = {
        "description": item.description,
        "qty": item.qty,
        "unit_price": item.unit_price,
    }
    if "description" in payload:
        item.description = payload.get("description")
    if "qty" in payload:
        item.qty = payload.get("qty")

    # 🔒 Si el ítem usa un servicio del catálogo (variante con precio),
    # sus parámetros NO se editan manualmente. Para cambiar parámetros,
    # el usuario debe elegir otro service_id (otra variante).
    if item.service_id is None:
        if "cilindraje" in payload:
            item.cilindraje = payload.get("cilindraje")
        if "valvulas" in payload:
            item.valvulas = payload.get("valvulas")
        if "sellos" in payload:
            item.sellos = payload.get("sellos")
    else:
        if any(k in payload for k in ("cilindraje", "valvulas", "sellos")):
            raise ValueError(
                "No se pueden editar cilindraje/válvulas/sellos en un ítem ligado a un servicio. "
                "Selecciona otro servicio (variante) si necesitas cambiar esos parámetros."
            )

    # 🔒 Prevent manual price override when item is linked to a service
    if item.service_id is not None and getattr(data, "unit_price", None) is not None:
        raise ValueError("No se puede modificar unit_price manual cuando el ítem usa un servicio")

    # 🔹 Recalcular precio automáticamente si el ítem está ligado a un servicio
    if item.service_id is not None:
        service = db.query(Service).filter(Service.id == item.service_id).first()
        if not service:
            raise ValueError("Servicio no existe")

        if order.pricing_tier == "TD":
            if service.price_td is None:
                raise ValueError("Servicio sin precio TD")
            item.unit_price = service.price_td
        elif order.pricing_tier == "SC":
            if service.price_sc is None:
                raise ValueError("Servicio sin precio SC")
            item.unit_price = service.price_sc
        else:
            raise ValueError("Pricing tier inválido en la orden")

        # Mantener parámetros del ítem sincronizados con la variante del servicio
        item.cilindraje = _svc_param_to_int(service.cilindraje)
        item.valvulas = _svc_param_to_int(service.valvulas)
        item.sellos = _svc_param_to_int(service.sellos)

    unit_price_in = getattr(data, "unit_price", None)
    if item.service_id is None and unit_price_in is not None:
        item.unit_price = unit_price_in

    _recalc_order_total(db, order)
    # If the order was previously paid and total decreased, create an automatic refund.
    create_refund_if_overpaid(db, order.id, actor_user_id=actor_user_id)

    after = {
        "description": item.description,
        "qty": item.qty,
        "unit_price": item.unit_price,
    }
    changes = {}
    for k in ("description", "qty", "unit_price"):
        if before.get(k) != after.get(k):
            changes[k] = {
                "from": str(before.get(k)) if k == "unit_price" and before.get(k) is not None else before.get(k),
                "to": str(after.get(k)) if k == "unit_price" and after.get(k) is not None else after.get(k),
            }
    if changes:
        add_work_order_history(
            db,
            order.id,
            {
                "item_updated": {
                    "item_id": item.id,
                    "service_id": item.service_id,
                    "description": item.description,
                    "changes": changes,
                }
            },
            actor_user_id,
        )

    db.commit()
    db.refresh(item)
    return item


def delete_item(
    db: Session,
    item: WorkOrderItem,
    actor_user_id: str | None = None,
) -> None:
    order_id = item.order_id

    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise ValueError("Orden no existe")

    _ensure_editable_order(db, order)

    add_work_order_history(
        db,
        order.id,
        {
            "item_deleted": {
                "item_id": item.id,
                "service_id": item.service_id,
                "description": item.description,
                "qty": item.qty,
                "unit_price": str(item.unit_price) if item.unit_price is not None else None,
            }
        },
        actor_user_id,
    )

    db.delete(item)
    db.flush()

    _recalc_order_total(db, order)
    # If the order was previously paid and total decreased, create an automatic refund.
    create_refund_if_overpaid(db, order.id, actor_user_id=actor_user_id)

    db.commit()
