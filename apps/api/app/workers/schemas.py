from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class WorkerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    job_role: Optional[str] = None   # mecánico, tornero, etc.


class WorkerOut(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    job_role: Optional[str] = None
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True