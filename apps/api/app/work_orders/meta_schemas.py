from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel
from pydantic.config import ConfigDict


class WorkOrderMetaHistoryOut(BaseModel):
    id: str
    work_order_id: str
    changed_at: datetime
    changed_by: str | None = None
    changes: dict

    model_config = ConfigDict(from_attributes=True)
