from uuid import uuid4
import re
import csv
import io
from datetime import datetime, date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, case, and_
from sqlalchemy.exc import IntegrityError

from app.accounts_payable.schemas import ACCOUNT_PAYABLE_PAYMENT_MODES, ACCOUNT_PAYABLE_SOURCE_INVENTORY_PURCHASE
from app.accounts_payable.service import create_inventory_purchase_payable
from app.models import AccountPayable, InventoryItem, InventoryMovement, WorkOrder
from .schemas import InventoryItemCreate, InventoryItemUpdate, InventoryMovementCreate


def list_items(
    db: Session,
    q: str | None,
    include_inactive: bool,
    include_totals: bool = False,
    stock_status: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
    include_total_count: bool = False,
) -> list[InventoryItem] | list[dict] | tuple[list[InventoryItem] | list[dict], int]:
    query = db.query(InventoryItem)

    if not include_inactive:
        query = query.filter(InventoryItem.active == True)  # noqa: E712

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                InventoryItem.code.ilike(like),
                InventoryItem.name.ilike(like),
                InventoryItem.category.ilike(like),
            )
        )

    if stock_status:
        status = stock_status.upper()
        if status == "OUT":
            query = query.filter(InventoryItem.stock_on_hand <= 0)
        elif status == "LOW":
            query = query.filter(InventoryItem.stock_on_hand > 0, InventoryItem.stock_on_hand < 10)
        elif status == "OK":
            query = query.filter(InventoryItem.stock_on_hand >= 10)

    base = query.order_by(InventoryItem.name.asc())
    total = None
    if include_total_count:
        total = query.with_entities(func.count(InventoryItem.id)).scalar() or 0

    if not include_totals:
        if offset is not None:
            base = base.offset(offset)
        if limit is not None:
            base = base.limit(limit)
        items = base.all()
        return (items, total) if include_total_count else items

    out_ok = or_(
        InventoryMovement.note.is_(None),
        ~InventoryMovement.note.ilike("%revertido%"),
    )
    totals_subq = (
        db.query(
            InventoryMovement.item_id.label("item_id"),
            func.coalesce(
                func.sum(
                    case(
                        (InventoryMovement.type == "IN", InventoryMovement.qty),
                        else_=0,
                    )
                ),
                0,
            ).label("in_qty"),
            func.coalesce(
                func.sum(
                    case(
                        (and_(InventoryMovement.type == "OUT", out_ok), InventoryMovement.qty),
                        else_=0,
                    )
                ),
                0,
            ).label("out_qty"),
        )
        .group_by(InventoryMovement.item_id)
        .subquery()
    )

    joined = (
        base.outerjoin(totals_subq, totals_subq.c.item_id == InventoryItem.id)
        .with_entities(
            InventoryItem,
            totals_subq.c.in_qty,
            totals_subq.c.out_qty,
        )
    )
    if offset is not None:
        joined = joined.offset(offset)
    if limit is not None:
        joined = joined.limit(limit)
    rows = joined.all()

    result = []
    for item, in_qty, out_qty in rows:
        result.append(
            {
                "id": item.id,
                "code": item.code,
                "name": item.name,
                "category": item.category,
                "active": item.active,
                "stock_on_hand": item.stock_on_hand,
                "stock_min": item.stock_min,
                "totals": {
                    "in_qty": in_qty or 0,
                    "out_qty": out_qty or 0,
                },
            }
        )
    return (result, total) if include_total_count else result

def _build_prefix(name: str, category: str | None = None) -> str:
    source = category if category and category.strip() else name
    raw = source.strip().upper()
    letters = re.sub(r"[^A-Z]", "", raw)
    if len(letters) >= 2:
        return letters[:2]
    compact = re.sub(r"\s+", "", raw)
    if len(compact) >= 2:
        return compact[:2]
    return (compact + "XX")[:2]


def _next_code_for_prefix(db: Session, prefix: str) -> str:
    rows = (
        db.query(InventoryItem.code)
        .filter(InventoryItem.code.ilike(f"{prefix}%"))
        .all()
    )
    max_num = 0
    for (code,) in rows:
        if not code:
            continue
        s = str(code).upper()
        if not s.startswith(prefix):
            continue
        tail = s[len(prefix):]
        m = re.match(r"^(\d{1,})", tail)
        if not m:
            continue
        try:
            num = int(m.group(1))
            if num > max_num:
                max_num = num
        except ValueError:
            continue
    return f"{prefix}{str(max_num + 1).zfill(2)}"


def _normalize_text(value: str | None) -> str:
    return (value or "").strip()


def _parse_number(value: str | None) -> float:
    raw = _normalize_text(value)
    if not raw:
        return 0.0
    cleaned = raw.replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _find_existing_item(db: Session, name: str, category: str | None):
    name_norm = name.strip()
    cat_norm = (category or "").strip()
    query = db.query(InventoryItem).filter(func.lower(InventoryItem.name) == func.lower(name_norm))
    if cat_norm:
        query = query.filter(func.lower(func.coalesce(InventoryItem.category, "")) == func.lower(cat_norm))
    else:
        query = query.filter(func.coalesce(InventoryItem.category, "") == "")
    return query.first()


def _create_item_from_import(
    db: Session, *, name: str, category: str | None, stock_on_hand: float
) -> InventoryItem:
    prefix = _build_prefix(name, category)
    code = _next_code_for_prefix(db, prefix)

    for _ in range(2):
        item = InventoryItem(
            id=str(uuid4()),
            code=code,
            name=name,
            category=category,
            active=True,
            stock_on_hand=stock_on_hand or 0,
            stock_min=None,
        )
        db.add(item)

        if stock_on_hand and stock_on_hand > 0:
            db.add(
                InventoryMovement(
                    id=str(uuid4()),
                    item_id=item.id,
                    type="IN",
                    qty=stock_on_hand,
                    unit_cost=None,
                    supplier=None,
                    work_order_id=None,
                    note="Importación inicial desde Excel",
                )
            )
        try:
            db.commit()
            db.refresh(item)
            return item
        except IntegrityError:
            db.rollback()
            prefix = _build_prefix(name, category)
            code = _next_code_for_prefix(db, prefix)
        except Exception:
            db.rollback()
            raise

    raise HTTPException(status_code=400, detail="No se pudo crear el item.")


def export_inventory_csv(db: Session) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["code", "name", "category", "stock_on_hand", "stock_min", "active"])
    items = db.query(InventoryItem).order_by(InventoryItem.name.asc()).all()
    for it in items:
        writer.writerow(
            [
                it.code or "",
                it.name or "",
                it.category or "",
                str(it.stock_on_hand or 0),
                "" if it.stock_min is None else str(it.stock_min),
                "true" if it.active else "false",
            ]
        )
    return output.getvalue()


def import_inventory_csv(db: Session, content: str) -> dict:
    stream = io.StringIO(content)
    reader = csv.DictReader(stream)
    created = 0
    skipped = 0
    errors: list[dict] = []

    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV sin encabezados.")

    headers = {h.strip().lower(): h for h in reader.fieldnames if h}
    name_key = headers.get("name") or headers.get("insumo")
    category_key = headers.get("category") or headers.get("categoria")
    stock_key = headers.get("stock_on_hand") or headers.get("existencia actual")

    if not name_key:
        raise HTTPException(status_code=400, detail="CSV sin columna de nombre (name o INSUMO).")

    row_index = 1  # encabezado
    for row in reader:
        row_index += 1
        try:
            name = _normalize_text(row.get(name_key))
            if not name:
                errors.append({"row": row_index, "reason": "Nombre vacío"})
                continue
            category = _normalize_text(row.get(category_key)) if category_key else ""
            stock_on_hand = _parse_number(row.get(stock_key)) if stock_key else 0.0

            existing = _find_existing_item(db, name, category or None)
            if existing:
                skipped += 1
                continue

            _create_item_from_import(
                db,
                name=name,
                category=category or None,
                stock_on_hand=stock_on_hand,
            )
            created += 1
        except Exception as exc:
            db.rollback()
            errors.append({"row": row_index, "reason": str(exc)})

    return {"created": created, "skipped": skipped, "errors": errors}
def create_item(db: Session, payload: InventoryItemCreate) -> InventoryItem:
    code = payload.code.strip() if payload.code else None
    if not code:
        prefix = _build_prefix(payload.name, payload.category)
        code = _next_code_for_prefix(db, prefix)

    # Retry once on collision to reduce race-condition failures
    for _ in range(2):
        item = InventoryItem(
            id=str(uuid4()),
            code=code,
            name=payload.name,
            category=payload.category,
            active=payload.active,
            stock_on_hand=payload.stock_on_hand or 0,
            stock_min=payload.stock_min,
        )

        db.add(item)
        # movimiento IN automático si hay stock inicial
        initial_qty = item.stock_on_hand or 0
        if initial_qty and initial_qty > 0:
            db.add(
                InventoryMovement(
                    id=str(uuid4()),
                    item_id=item.id,
                    type="IN",
                    qty=initial_qty,
                    unit_cost=payload.unit_cost,
                    supplier=payload.supplier,
                    work_order_id=None,
                    note="Stock inicial",
                )
            )
        try:
            db.commit()
            db.refresh(item)
            return item
        except IntegrityError:
            db.rollback()
            if payload.code:
                raise HTTPException(status_code=400, detail="No se pudo crear el item (¿código duplicado?).")
            prefix = _build_prefix(payload.name, payload.category)
            code = _next_code_for_prefix(db, prefix)
        except Exception:
            db.rollback()
            raise HTTPException(status_code=400, detail="No se pudo crear el item.")

    raise HTTPException(status_code=400, detail="No se pudo crear el item (¿código duplicado?).")


def get_item_detail(db: Session, item_id: str):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")

    in_qty = (
        db.query(func.coalesce(func.sum(InventoryMovement.qty), 0))
        .filter(InventoryMovement.item_id == item_id, InventoryMovement.type == "IN")
        .scalar()
    )
    out_qty = (
        db.query(func.coalesce(func.sum(InventoryMovement.qty), 0))
        .filter(
            InventoryMovement.item_id == item_id,
            InventoryMovement.type == "OUT",
            or_(
                InventoryMovement.note.is_(None),
                ~InventoryMovement.note.ilike("%revertido%"),
            ),
        )
        .scalar()
    )

    stock = item.stock_on_hand or 0
    status = "OK"
    if stock == 0:
        status = "OUT"
    elif stock < 10:
        status = "LOW"

    return {
        "item": item,
        "totals": {
            "in_qty": in_qty,
            "out_qty": out_qty,
            "stock_on_hand": stock,
            "status": status,
        },
    }


def list_movements(
    db: Session,
    item_id: str,
    movement_type: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
):
    q = (
        db.query(InventoryMovement, WorkOrder.order_number)
        .outerjoin(WorkOrder, WorkOrder.id == InventoryMovement.work_order_id)
        .filter(InventoryMovement.item_id == item_id)
        .order_by(InventoryMovement.created_at.desc())
    )
    if movement_type:
        q = q.filter(InventoryMovement.type == movement_type)
    if offset is not None:
        q = q.offset(offset)
    if limit is not None:
        q = q.limit(limit)

    rows = q.all()
    movement_ids = [mv.id for mv, _ in rows]
    payable_links: dict[str, str] = {}
    if movement_ids:
        linked_rows = (
            db.query(AccountPayable.source_id, AccountPayable.id)
            .filter(
                AccountPayable.source_type == ACCOUNT_PAYABLE_SOURCE_INVENTORY_PURCHASE,
                AccountPayable.source_id.in_(movement_ids),
            )
            .all()
        )
        payable_links = {source_id: payable_id for source_id, payable_id in linked_rows if source_id and payable_id}

    result = []
    for mv, order_number in rows:
        result.append(
            {
                "id": mv.id,
                "item_id": mv.item_id,
                "type": mv.type,
                "qty": mv.qty,
                "unit_cost": mv.unit_cost,
                "supplier": mv.supplier,
                "payment_mode": getattr(mv, "payment_mode", None),
                "total_cost": getattr(mv, "total_cost", None),
                "due_date": getattr(mv, "due_date", None),
                "linked_account_payable_id": payable_links.get(mv.id),
                "work_order_id": mv.work_order_id,
                "order_number": order_number,
                "note": mv.note,
                "created_at": mv.created_at,
            }
        )
    return result


def create_movement(db: Session, item_id: str, payload: InventoryMovementCreate):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")

    movement_type = str(payload.type).upper()
    if movement_type not in {"IN", "ADJUST"}:
        raise HTTPException(status_code=400, detail="Tipo inválido. Usa IN o ADJUST.")

    qty = payload.qty
    if qty is None or qty <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0.")

    payment_mode = str(payload.payment_mode or "CONTADO").upper()
    if payment_mode not in ACCOUNT_PAYABLE_PAYMENT_MODES:
        raise HTTPException(status_code=400, detail="payment_mode inválido. Usa CONTADO o CREDITO.")

    total_cost = payload.total_cost
    if movement_type != "IN":
        payment_mode = "CONTADO"
        total_cost = None
    elif total_cost is None and payload.unit_cost is not None:
        total_cost = Decimal(str(payload.unit_cost)) * Decimal(str(qty))

    if movement_type == "IN" and payment_mode == "CREDITO":
        if total_cost is None or Decimal(str(total_cost)) <= 0:
            raise HTTPException(status_code=400, detail="total_cost es requerido y debe ser mayor a 0 para compras a crédito.")
        if payload.due_date is None:
            raise HTTPException(status_code=400, detail="due_date es requerida cuando payment_mode=CREDITO.")

    delta = qty
    signed_qty = qty
    if movement_type == "ADJUST":
        direction = (payload.direction or "UP").upper()
        if direction not in {"UP", "DOWN"}:
            raise HTTPException(status_code=400, detail="direction inválido. Usa UP o DOWN.")
        if direction == "DOWN":
            signed_qty = -abs(qty)
        else:
            signed_qty = abs(qty)
        if (item.stock_on_hand or 0) + signed_qty < 0:
            raise HTTPException(status_code=400, detail="Stock insuficiente para ajustar.")
        delta = signed_qty

    item.stock_on_hand = (item.stock_on_hand or 0) + delta

    mv = InventoryMovement(
        id=str(uuid4()),
        item_id=item_id,
        type=movement_type,
        qty=signed_qty,
        unit_cost=payload.unit_cost,
        supplier=payload.supplier,
        payment_mode=payment_mode,
        total_cost=total_cost,
        due_date=payload.due_date if movement_type == "IN" else None,
        work_order_id=None,
        note=payload.note,
    )
    db.add(mv)
    db.add(item)

    linked_account_payable_id = None
    if movement_type == "IN" and payment_mode == "CREDITO":
        db.flush()
        payable = create_inventory_purchase_payable(
            db,
            movement_id=mv.id,
            item_name=item.name,
            supplier=payload.supplier,
            total_cost=Decimal(str(total_cost)),
            due_date=payload.due_date,
            notes=payload.note,
        )
        linked_account_payable_id = payable.id

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo registrar el movimiento.")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo registrar el movimiento.")

    db.refresh(mv)
    return {
        "id": mv.id,
        "item_id": mv.item_id,
        "type": mv.type,
        "qty": mv.qty,
        "unit_cost": mv.unit_cost,
        "supplier": mv.supplier,
        "payment_mode": mv.payment_mode,
        "total_cost": mv.total_cost,
        "due_date": mv.due_date,
        "linked_account_payable_id": linked_account_payable_id,
        "work_order_id": mv.work_order_id,
        "order_number": None,
        "note": mv.note,
        "created_at": mv.created_at,
    }


def _month_range(month: str | None):
    if month:
        try:
            y, m = month.split("-")
            year = int(y)
            mon = int(m)
            start = datetime(year, mon, 1)
        except Exception:
            raise HTTPException(status_code=400, detail="Mes inválido. Usa YYYY-MM.")
    else:
        today = date.today()
        start = datetime(today.year, today.month, 1)
    if start.month == 12:
        end = datetime(start.year + 1, 1, 1)
    else:
        end = datetime(start.year, start.month + 1, 1)
    return start, end, start.strftime("%Y-%m")


def get_inventory_summary(db: Session, month: str | None):
    start, end, label = _month_range(month)

    entries_q = (
        db.query(InventoryMovement)
        .filter(
            InventoryMovement.type == "IN",
            InventoryMovement.created_at >= start,
            InventoryMovement.created_at < end,
        )
        .order_by(InventoryMovement.created_at.desc())
        .all()
    )

    exits_q = (
        db.query(InventoryMovement, WorkOrder.order_number)
        .outerjoin(WorkOrder, WorkOrder.id == InventoryMovement.work_order_id)
        .filter(
            InventoryMovement.type == "OUT",
            InventoryMovement.created_at >= start,
            InventoryMovement.created_at < end,
        )
        .order_by(InventoryMovement.created_at.desc())
        .all()
    )

    entries = []
    total_entries_amount = 0
    for mv in entries_q:
        subtotal = None
        if mv.unit_cost is not None:
            subtotal = mv.qty * mv.unit_cost
            total_entries_amount += subtotal
        entries.append(
            {
                "created_at": mv.created_at,
                "supplier": mv.supplier,
                "qty": mv.qty,
                "unit_cost": mv.unit_cost,
                "subtotal": subtotal,
                "note": mv.note,
            }
        )

    exits = []
    total_exits_qty = 0
    for mv, order_number in exits_q:
        total_exits_qty += mv.qty
        exits.append(
            {
                "created_at": mv.created_at,
                "work_order_id": mv.work_order_id,
                "order_number": order_number,
                "qty": mv.qty,
                "note": mv.note,
            }
        )

    return {
        "month": label,
        "entries": entries,
        "exits": exits,
        "totals": {
            "total_entries_amount": total_entries_amount,
            "total_exits_qty": total_exits_qty,
        },
    }


def update_item(db: Session, item_id: str, payload: InventoryItemUpdate) -> InventoryItem:
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(item, k, v)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo actualizar (¿código duplicado?).")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo actualizar el item.")
    db.refresh(item)
    return item


def soft_delete_item(db: Session, item_id: str) -> None:
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")

    item.active = False
    db.commit()
