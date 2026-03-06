from fastapi import APIRouter, Depends, Query, UploadFile, File, Response
from sqlalchemy.orm import Session

from app.db import get_db
from .schemas import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemOut,
    InventoryItemDetailOut,
    InventoryMovementCreate,
    InventoryMovementOut,
    InventorySummaryOut,
)
from . import service as inventory_service

router = APIRouter(prefix="/inventory/items", tags=["inventory"])
summary_router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryItemOut])
def list_items(
    response: Response,
    q: str | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    include_totals: bool = Query(default=False),
    stock_status: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    items, total = inventory_service.list_items(
        db,
        q=q,
        include_inactive=include_inactive,
        include_totals=include_totals,
        stock_status=stock_status,
        limit=limit,
        offset=offset,
        include_total_count=True,
    )
    response.headers["X-Total-Count"] = str(total or 0)
    return items


@router.post("", response_model=InventoryItemOut)
def create_item(payload: InventoryItemCreate, db: Session = Depends(get_db)):
    return inventory_service.create_item(db, payload)


@router.patch("/{item_id}", response_model=InventoryItemOut)
def update_item(item_id: str, payload: InventoryItemUpdate, db: Session = Depends(get_db)):
    return inventory_service.update_item(db, item_id, payload)


@router.delete("/{item_id}")
def delete_item(item_id: str, db: Session = Depends(get_db)):
    inventory_service.soft_delete_item(db, item_id)
    return {"ok": True}


@router.get("/{item_id}/detail", response_model=InventoryItemDetailOut)
def get_item_detail(item_id: str, db: Session = Depends(get_db)):
    return inventory_service.get_item_detail(db, item_id)


@router.get("/{item_id}/movements", response_model=list[InventoryMovementOut])
def list_movements(
    item_id: str,
    type: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    return inventory_service.list_movements(
        db,
        item_id=item_id,
        movement_type=type.upper() if type else None,
        limit=limit,
        offset=offset,
    )


@router.post("/{item_id}/movements", response_model=InventoryMovementOut)
def create_movement(item_id: str, payload: InventoryMovementCreate, db: Session = Depends(get_db)):
    return inventory_service.create_movement(db, item_id=item_id, payload=payload)


@router.get("/summary", response_model=InventorySummaryOut)
def inventory_summary_legacy(
    month: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return inventory_service.get_inventory_summary(db, month=month)


@summary_router.get("/summary", response_model=InventorySummaryOut)
def inventory_summary(
    month: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return inventory_service.get_inventory_summary(db, month=month)


@summary_router.get("/export")
def export_inventory(db: Session = Depends(get_db)):
    csv_data = inventory_service.export_inventory_csv(db)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventario_export.csv"},
    )


@summary_router.post("/import")
async def import_inventory(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    return inventory_service.import_inventory_csv(db, text)
