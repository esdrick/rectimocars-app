from pydantic import BaseModel
from decimal import Decimal

class ConsumableCreate(BaseModel):
    item_id: str
    qty: Decimal

class ConsumableUpdate(BaseModel):
    qty: Decimal

class ConsumableOut(BaseModel):
    item_id: str
    qty: Decimal
    item_code: str | None = None
    item_name: str | None = None

    class Config:
        from_attributes = True