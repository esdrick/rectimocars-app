from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class WorkOrderItemCreate(BaseModel):
    # Link to catalog service (optional: if omitted, item is manual)
    service_id: str | None = None

    # Quantity
    qty: Decimal = Decimal("1")

    # Unit price (ONLY for manual items, when service_id is None)
    unit_price: Decimal | None = None

    # Description for the item (if service_id is provided and description is None,
    # backend may use service.name)
    description: str | None = None
    cilindraje: int | None = None
    valvulas: int | None = None
    sellos: int | None = None

    @field_validator("cilindraje")
    @classmethod
    def validate_cilindraje(cls, v: int | None):
        if v is None:
            return v
        if v not in {4, 6, 8}:
            raise ValueError("cilindraje inválido. Opciones: 4, 6, 8 o null")
        return v

    @field_validator("valvulas")
    @classmethod
    def validate_valvulas(cls, v: int | None):
        if v is None:
            return v
        if v not in {8, 12, 16, 24}:
            raise ValueError("valvulas inválido. Opciones: 8, 12, 16, 24 o null")
        return v

    @field_validator("sellos")
    @classmethod
    def validate_sellos(cls, v: int | None):
        if v is None:
            return v
        if v not in {2, 4}:
            raise ValueError("sellos inválido. Opciones: 2, 4 o null")
        return v



class WorkOrderItemUpdate(BaseModel):
    description: str | None = None
    qty: Decimal | None = None
    cilindraje: int | None = None
    valvulas: int | None = None
    sellos: int | None = None

    @field_validator("cilindraje")
    @classmethod
    def validate_cilindraje(cls, v: int | None):
        if v is None:
            return v
        if v not in {4, 6, 8}:
            raise ValueError("cilindraje inválido. Opciones: 4, 6, 8 o null")
        return v

    @field_validator("valvulas")
    @classmethod
    def validate_valvulas(cls, v: int | None):
        if v is None:
            return v
        if v not in {8, 12, 16, 24}:
            raise ValueError("valvulas inválido. Opciones: 8, 12, 16, 24 o null")
        return v

    @field_validator("sellos")
    @classmethod
    def validate_sellos(cls, v: int | None):
        if v is None:
            return v
        if v not in {2, 4}:
            raise ValueError("sellos inválido. Opciones: 2, 4 o null")
        return v


class WorkOrderItemOut(BaseModel):
    id: str
    order_id: str
    service_id: str | None = None
    description: str | None = None
    qty: Decimal
    unit_price: Decimal
    cilindraje: int | None = None
    valvulas: int | None = None
    sellos: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True
