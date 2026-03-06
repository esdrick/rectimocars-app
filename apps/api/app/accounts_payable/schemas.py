from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


ACCOUNT_PAYABLE_STATUS_VALUES = {"vigente", "por_vencer", "vencido"}
ACCOUNT_PAYABLE_STATUS_LABELS = {
    "vigente": "VIGENTE",
    "por_vencer": "POR_VENCER",
    "vencido": "VENCIDO",
}
ACCOUNT_PAYABLE_EXPENSE_TYPES = (
    "COMPRA_INVENTARIO",
    "SERVICIOS",
    "ALQUILER",
    "NOMINA",
    "IMPUESTOS",
    "MANTENIMIENTO",
    "OTROS",
)
ACCOUNT_PAYABLE_SOURCE_INVENTORY_PURCHASE = "INVENTORY_PURCHASE"
ACCOUNT_PAYABLE_PAYMENT_MODES = ("CONTADO", "CREDITO")
ACCOUNT_PAYABLE_STATUS_THRESHOLD_DAYS = 7


class AccountPayableCreate(BaseModel):
    description: str
    expense_type: str
    amount: Decimal
    due_date: date
    paid: bool = False
    paid_at: datetime | None = None
    notes: str | None = None
    source_type: str | None = None
    source_id: str | None = None


class AccountPayableUpdate(BaseModel):
    description: str | None = None
    expense_type: str | None = None
    amount: Decimal | None = None
    due_date: date | None = None
    paid: bool | None = None
    paid_at: datetime | None = None
    notes: str | None = None
    source_type: str | None = None
    source_id: str | None = None


class MarkPaidPayload(BaseModel):
    paid_at: datetime | None = None


class AccountPayableOut(BaseModel):
    id: str
    description: str
    expense_type: str
    amount: Decimal
    due_date: date
    days_available: int
    status: str
    paid: bool
    paid_at: datetime | None = None
    notes: str | None = None
    source_type: str | None = None
    source_id: str | None = None
    created_at: datetime
    updated_at: datetime


class CashflowItemOut(BaseModel):
    id: str
    kind: str
    description: str
    amount: Decimal
    occurred_at: datetime
    source_type: str | None = None
    source_id: str | None = None


class CashflowDayOut(BaseModel):
    day: date
    incomes_total: Decimal
    expenses_total: Decimal
    net_total: Decimal


class CashflowReportOut(BaseModel):
    from_date: date
    to_date: date
    ingresos_total: Decimal
    egresos_total: Decimal
    neto: Decimal
    pendientes_total: Decimal
    breakdown_by_day: list[CashflowDayOut] = Field(default_factory=list)
    incomes: list[CashflowItemOut] = Field(default_factory=list)
    expenses: list[CashflowItemOut] = Field(default_factory=list)
