from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class PaymentCreate(BaseModel):
    amount: Decimal
    currency: str = "USD"
    method: str = "EFECTIVO"
    type: str = "ABONO"  # ABONO | FINAL | DEVOLUCION (si aplica)


class PaymentOut(BaseModel):
    id: str
    order_id: str
    amount: Decimal
    currency: str
    method: str
    type: str
    created_at: datetime

    class Config:
        from_attributes = True