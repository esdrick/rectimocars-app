from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import InventoryItem, InventoryMovement, WorkOrderConsumable
from app.work_orders.history import add_work_order_history


def list_consumables(db: Session, work_order_id: str):
    rows = (
        db.query(WorkOrderConsumable, InventoryItem)
        .join(InventoryItem, InventoryItem.id == WorkOrderConsumable.item_id)
        .filter(WorkOrderConsumable.work_order_id == work_order_id)
        .order_by(InventoryItem.name.asc())
        .all()
    )
    # armar salida con item_code/item_name
    result = []
    for row, item in rows:
        row.item_code = item.code
        row.item_name = item.name
        result.append(row)
    return result


def add_consumable(
    db: Session,
    work_order_id: str,
    item_id: str,
    qty: Decimal,
    actor_user_id: str | None = None,
):
    if qty <= 0:
        raise HTTPException(400, "La cantidad debe ser mayor a 0")

    item = db.query(InventoryItem).filter(InventoryItem.id == item_id, InventoryItem.active == True).first()  # noqa: E712
    if not item:
        raise HTTPException(404, "Producto de inventario no encontrado")

    existing = db.query(WorkOrderConsumable).filter(
        WorkOrderConsumable.work_order_id == work_order_id,
        WorkOrderConsumable.item_id == item_id
    ).first()

    current_qty = Decimal(existing.qty) if existing else Decimal("0")
    next_qty = current_qty + qty
    delta = next_qty - current_qty  # aquí delta == qty

    # BLOQUEO por stock
    if Decimal(item.stock_on_hand) < delta:
        raise HTTPException(400, f"Stock insuficiente. Disponible: {item.stock_on_hand}")

    # aplicar cambios
    if existing:
        existing.qty = next_qty
    else:
        existing = WorkOrderConsumable(work_order_id=work_order_id, item_id=item_id, qty=next_qty)
        db.add(existing)

    # descontar stock
    item.stock_on_hand = Decimal(item.stock_on_hand) - delta

    # movimiento OUT
    mv = InventoryMovement(
        id=str(uuid4()),
        item_id=item_id,
        type="OUT",
        qty=delta,
        work_order_id=work_order_id,
        note="Consumo por orden"
    )
    db.add(mv)

    add_work_order_history(
        db,
        work_order_id,
        {
            "consumable_added": {
                "item_id": item_id,
                "item_name": item.name,
                "item_code": item.code,
                "qty": str(next_qty),
            }
        },
        actor_user_id,
    )

    db.commit()
    existing.item_code = item.code
    existing.item_name = item.name
    return existing


def update_consumable(
    db: Session,
    work_order_id: str,
    item_id: str,
    qty: Decimal,
    actor_user_id: str | None = None,
):
    if qty <= 0:
        raise HTTPException(400, "La cantidad debe ser mayor a 0")

    row = db.query(WorkOrderConsumable).filter(
        WorkOrderConsumable.work_order_id == work_order_id,
        WorkOrderConsumable.item_id == item_id
    ).first()
    if not row:
        raise HTTPException(404, "Insumo no existe en esta orden")

    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Producto de inventario no encontrado")

    current_qty = Decimal(row.qty)
    delta = qty - current_qty

    if delta > 0:
        if Decimal(item.stock_on_hand) < delta:
            raise HTTPException(400, f"Stock insuficiente. Disponible: {item.stock_on_hand}")
        item.stock_on_hand = Decimal(item.stock_on_hand) - delta
        mv_type = "OUT"
        mv_qty = delta
        mv_note = "Aumento consumo"
    elif delta < 0:
        # devolver stock
        item.stock_on_hand = Decimal(item.stock_on_hand) + (-delta)
        mv_type = "ADJUST"
        mv_qty = -delta
        mv_note = "Disminución consumo (reversión)"
    else:
        return row

    row.qty = qty

    db.add(InventoryMovement(
        id=str(uuid4()),
        item_id=item_id,
        type=mv_type,
        qty=mv_qty,
        work_order_id=work_order_id,
        note=mv_note
    ))

    add_work_order_history(
        db,
        work_order_id,
        {
            "consumable_updated": {
                "item_id": item_id,
                "item_name": item.name,
                "item_code": item.code,
                "qty": {
                    "from": str(current_qty),
                    "to": str(qty),
                },
            }
        },
        actor_user_id,
    )

    db.commit()
    row.item_code = item.code
    row.item_name = item.name
    return row


def delete_consumable(
    db: Session,
    work_order_id: str,
    item_id: str,
    actor_user_id: str | None = None,
):
    row = db.query(WorkOrderConsumable).filter(
        WorkOrderConsumable.work_order_id == work_order_id,
        WorkOrderConsumable.item_id == item_id
    ).first()
    if not row:
        raise HTTPException(404, "Insumo no existe en esta orden")

    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Producto de inventario no encontrado")

    qty = Decimal(row.qty)

    # devolver todo al stock
    item.stock_on_hand = Decimal(item.stock_on_hand) + qty

    db.add(InventoryMovement(
        id=str(uuid4()),
        item_id=item_id,
        type="ADJUST",
        qty=qty,
        work_order_id=work_order_id,
        note="Eliminación consumo (reversión total)"
    ))

    # marcar la última salida como revertida (trazabilidad)
    last_out = (
        db.query(InventoryMovement)
        .filter(
            InventoryMovement.item_id == item_id,
            InventoryMovement.work_order_id == work_order_id,
            InventoryMovement.type == "OUT",
        )
        .order_by(InventoryMovement.created_at.desc())
        .first()
    )
    if last_out and last_out.note and "revertido" not in last_out.note.lower():
        last_out.note = f"{last_out.note} (revertido)"
    elif last_out and not last_out.note:
        last_out.note = "Consumo por orden (revertido)"

    add_work_order_history(
        db,
        work_order_id,
        {
            "consumable_deleted": {
                "item_id": item_id,
                "item_name": item.name,
                "item_code": item.code,
                "qty": str(qty),
            }
        },
        actor_user_id,
    )

    db.delete(row)
    db.commit()
