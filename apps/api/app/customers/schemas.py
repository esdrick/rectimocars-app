from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr


class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    notes: str | None = None


class CustomerOut(BaseModel):
    id: str
    name: str
    phone: str | None
    email: str | None = None
    address: str | None = None
    notes: str | None = None
    created_at: datetime

    # Computed (not stored): sum of positive balances across this customer's orders
    debt_total: Decimal | None = None

    class Config:
        from_attributes = True


class OrderReceivableOut(BaseModel):
    id: str
    order_number: int | None = None
    status: str | None = None
    pricing_tier: str | None = None
    created_at: datetime | None = None
    total: Decimal | None = None
    paid_total: Decimal | None = None
    balance: Decimal
    collection_status: str
    days_since_created: int


class CustomerReceivablesOut(BaseModel):
    customer_id: str
    debt_total: Decimal
    orders: list[OrderReceivableOut]
