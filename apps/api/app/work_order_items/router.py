from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import WorkOrder, WorkOrderItem, User
from app.work_order_items.schemas import WorkOrderItemCreate, WorkOrderItemUpdate, WorkOrderItemOut
from app.work_order_items.service import add_item, list_items, update_item, delete_item

from app.auth.deps import get_current_user
from app.auth.permissions import require_roles
from app.constants import ROLE_ADMIN, ROLE_EDITOR, ROLE_REGISTRADOR

router = APIRouter()

def _get_order(db: Session, order_id: str) -> WorkOrder:
    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return order

def _get_item(db: Session, item_id: str) -> WorkOrderItem:
    item = db.query(WorkOrderItem).filter(WorkOrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    return item

@router.get("/{order_id}/items", response_model=list[WorkOrderItemOut])
def items_list(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_order(db, order_id)
    return list_items(db, order_id)

@router.post("/{order_id}/items", response_model=WorkOrderItemOut, status_code=status.HTTP_201_CREATED)
def items_create(
    order_id: str,
    payload: WorkOrderItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_REGISTRADOR)),
):
    order = _get_order(db, order_id)
    return add_item(db, order, payload, actor_user_id=user.id)

@router.patch("/items/{item_id}", response_model=WorkOrderItemOut)
def items_update(
    item_id: str,
    payload: WorkOrderItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR)),
):
    item = _get_item(db, item_id)
    return update_item(db, item, payload, actor_user_id=user.id)

@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def items_delete(
    item_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR)),
):
    item = _get_item(db, item_id)
    delete_item(db, item, actor_user_id=user.id)
    return None
