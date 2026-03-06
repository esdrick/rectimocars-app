from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date, datetime


class InventoryItemCreate(BaseModel):
    code: Optional[str] = None
    name: str
    category: Optional[str] = None
    stock_on_hand: Optional[Decimal] = Decimal("0")
    stock_min: Optional[Decimal] = None
    active: bool = True
    supplier: Optional[str] = None
    unit_cost: Optional[Decimal] = None


class InventoryItemUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    stock_on_hand: Optional[Decimal] = None
    stock_min: Optional[Decimal] = None
    active: Optional[bool] = None


class InventoryTotalsLite(BaseModel):
    in_qty: Decimal
    out_qty: Decimal


class InventoryItemOut(BaseModel):
    id: str
    code: Optional[str] = None
    name: str
    category: Optional[str] = None
    active: bool
    stock_on_hand: Decimal
    stock_min: Optional[Decimal] = None
    totals: Optional[InventoryTotalsLite] = None

    class Config:
        from_attributes = True


class InventoryTotalsOut(BaseModel):
    in_qty: Decimal
    out_qty: Decimal
    stock_on_hand: Decimal
    status: str  # OK | LOW | OUT


class InventoryItemDetailOut(BaseModel):
    item: InventoryItemOut
    totals: InventoryTotalsOut


class InventoryMovementCreate(BaseModel):
    type: str  # IN | ADJUST
    qty: Decimal
    unit_cost: Optional[Decimal] = None
    supplier: Optional[str] = None
    payment_mode: Optional[str] = "CONTADO"
    total_cost: Optional[Decimal] = None
    due_date: Optional[date] = None
    note: Optional[str] = None
    direction: Optional[str] = None  # UP | DOWN (solo para ADJUST)


class InventoryMovementOut(BaseModel):
    id: str
    item_id: str
    type: str
    qty: Decimal
    unit_cost: Optional[Decimal] = None
    supplier: Optional[str] = None
    payment_mode: Optional[str] = None
    total_cost: Optional[Decimal] = None
    due_date: Optional[date] = None
    linked_account_payable_id: Optional[str] = None
    work_order_id: Optional[str] = None
    order_number: Optional[int] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InventorySummaryEntry(BaseModel):
    created_at: datetime
    supplier: Optional[str] = None
    qty: Decimal
    unit_cost: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None
    note: Optional[str] = None


class InventorySummaryExit(BaseModel):
    created_at: datetime
    work_order_id: Optional[str] = None
    order_number: Optional[int] = None
    qty: Decimal
    note: Optional[str] = None


class InventorySummaryTotals(BaseModel):
    total_entries_amount: Decimal
    total_exits_qty: Decimal


class InventorySummaryOut(BaseModel):
    month: str
    entries: list[InventorySummaryEntry]
    exits: list[InventorySummaryExit]
    totals: InventorySummaryTotals

    
