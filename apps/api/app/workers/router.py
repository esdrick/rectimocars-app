from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.workers.schemas import WorkerCreate, WorkerOut
from app.workers.service import create_worker, list_workers

from app.auth.deps import get_current_user
from app.auth.permissions import require_roles
from app.constants import ROLE_ADMIN, ROLE_EDITOR

router = APIRouter()

@router.post("/", response_model=WorkerOut, status_code=status.HTTP_201_CREATED)
def create(
    payload: WorkerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR)),
):
    return create_worker(db, payload)

@router.get("/", response_model=list[WorkerOut])
def list_all(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return list_workers(db)