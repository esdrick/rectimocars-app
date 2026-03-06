from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel
from pydantic.config import ConfigDict


class ReceivedPartCreate(BaseModel):
    label: str
    active: bool | None = True


class ReceivedPartUpdate(BaseModel):
    label: str | None = None
    active: bool | None = None


class ReceivedPartOut(BaseModel):
    id: str
    label: str
    active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
