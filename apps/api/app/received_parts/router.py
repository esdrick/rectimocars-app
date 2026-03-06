from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.constants import ROLE_ADMIN
from app.auth.permissions import require_roles
from app.auth.deps import get_current_user

from app.received_parts.schemas import ReceivedPartCreate, ReceivedPartUpdate, ReceivedPartOut
from app.received_parts.service import (
    create_received_part,
    list_received_parts,
    get_received_part,
    update_received_part,
)

router = APIRouter(prefix="/received-parts", tags=["Received Parts"])


@router.post("/", response_model=ReceivedPartOut, status_code=status.HTTP_201_CREATED)
def create(
    payload: ReceivedPartCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    try:
        return create_received_part(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=list[ReceivedPartOut])
def list_all(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return list_received_parts(db, include_inactive=include_inactive)


@router.get("/{part_id}", response_model=ReceivedPartOut)
def get_one(
    part_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    part = get_received_part(db, part_id)
    if not part:
        raise HTTPException(status_code=404, detail="Pieza recibida no encontrada")
    return part


@router.patch("/{part_id}", response_model=ReceivedPartOut)
def update(
    part_id: str,
    payload: ReceivedPartUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    part = get_received_part(db, part_id)
    if not part:
        raise HTTPException(status_code=404, detail="Pieza recibida no encontrada")

    try:
        return update_received_part(db, part, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
