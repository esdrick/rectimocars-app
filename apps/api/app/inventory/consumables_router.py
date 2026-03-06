from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db import get_db
from app.models import User
from .consumables_schemas import ConsumableCreate, ConsumableUpdate, ConsumableOut
from . import consumables_services as consumables_service

router = APIRouter(tags=["inventory"])  # sin prefix aquí


@router.get("/work-orders/{id}/consumables", response_model=list[ConsumableOut])
def list_consumables(id: str, db: Session = Depends(get_db)):
    return consumables_service.list_consumables(db, work_order_id=id)


@router.post("/work-orders/{id}/consumables", response_model=ConsumableOut)
def add_consumable(
    id: str,
    payload: ConsumableCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return consumables_service.add_consumable(
        db,
        work_order_id=id,
        item_id=payload.item_id,
        qty=payload.qty,
        actor_user_id=user.id,
    )


@router.patch("/work-orders/{id}/consumables/{item_id}", response_model=ConsumableOut)
def update_consumable(
    id: str,
    item_id: str,
    payload: ConsumableUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return consumables_service.update_consumable(
        db,
        work_order_id=id,
        item_id=item_id,
        qty=payload.qty,
        actor_user_id=user.id,
    )


@router.delete("/work-orders/{id}/consumables/{item_id}")
def delete_consumable(
    id: str,
    item_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    consumables_service.delete_consumable(db, work_order_id=id, item_id=item_id, actor_user_id=user.id)
    return {"ok": True}
