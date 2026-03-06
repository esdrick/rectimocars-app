from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SupplierCreate(BaseModel):
    name: str
    supplies_type: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    active: Optional[bool] = True


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    supplies_type: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    active: Optional[bool] = None


class SupplierOut(BaseModel):
    id: str
    name: str
    supplies_type: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True
