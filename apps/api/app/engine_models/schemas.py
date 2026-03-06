from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel
from pydantic.config import ConfigDict


class EngineModelCreate(BaseModel):
    label: str
    active: bool | None = True


class EngineModelUpdate(BaseModel):
    label: str | None = None
    active: bool | None = None


class EngineModelOut(BaseModel):
    id: str
    label: str
    active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
