from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel
from pydantic.config import ConfigDict

# Keep statuses aligned with the backend service rules (ALLOWED_WORK_ORDER_STATUSES)
WorkOrderStatus = Literal["DRAFT", "RECIBIDO", "EN_PROCESO", "LISTO", "ENTREGADO", "CERRADO"]
PricingTier = Literal["TD", "SC"]


class WorkOrderCreate(BaseModel):
    customer_id: str
    pricing_tier: PricingTier = "TD"
    piece: str | None = None
    notes: str | None = None
    engine_model_id: str | None = None
    offered_for_date: date | None = None
    received_part_ids: list[str] | None = None


class WorkOrderUpdate(BaseModel):
    status: WorkOrderStatus | None = None
    pricing_tier: PricingTier | None = None
    piece: str | None = None
    notes: str | None = None
    total: Decimal | None = None
    engine_model_id: str | None = None
    offered_for_date: date | None = None
    received_part_ids: list[str] | None = None
    assigned_worker_ids: list[str] | None = None


class WorkOrderAssign(BaseModel):
    worker_id: str


class WorkOrderReceivedPartOut(BaseModel):
    id: str
    part_id: str
    label: str
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkerOutMini(BaseModel):
    id: str
    name: str
    job_role: str | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkOrderOut(BaseModel):
    id: str                      # UUID interno (no mostrarlo al usuario si no quieres)
    order_number: int            # <- ESTE es el número corto visible

    customer_id: str
    pricing_tier: PricingTier
    status: WorkOrderStatus

    piece: str | None = None
    notes: str | None = None
    engine_model_id: str | None = None
    engine_model_label: str | None = None
    offered_for_date: date | None = None

    total: Decimal
    paid_total: Decimal
    balance: Decimal
    payment_status: str

    created_at: datetime

    received_parts: list[WorkOrderReceivedPartOut] | None = None

    assigned_worker_id: str | None = None
    assigned_at: datetime | None = None
    assigned_workers: list[WorkerOutMini] | None = None

    model_config = ConfigDict(from_attributes=True)
