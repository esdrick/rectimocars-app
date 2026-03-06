

from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime


class ServiceBase(BaseModel):
    name: str = Field(..., example="Rectificado de culata")
    description: str | None = Field(None, example="Servicio completo de rectificado")
    cilindraje: str | None = Field(None, example="4", description="Cilindraje: 4, 6, 8, NO_APLICA")
    valvulas: str | None = Field(None, example="16", description="Válvulas: 8, 12, 16, 24, NO_APLICA")
    sellos: str | None = Field(None, example="2", description="Sellos: 2, 4, NO_APLICA")
    price_td: Decimal | None = Field(
        None, example="120.00", description="Precio para cliente directo (TD)"
    )
    price_sc: Decimal | None = Field(
        None, example="90.00", description="Precio para subcontrato (SC)"
    )
    active: bool = True


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    cilindraje: str | None = None
    valvulas: str | None = None
    sellos: str | None = None
    price_td: Decimal | None = None
    price_sc: Decimal | None = None
    active: bool | None = None


class ServiceOut(ServiceBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
