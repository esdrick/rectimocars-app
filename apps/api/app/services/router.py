from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.constants import ROLE_ADMIN
from app.auth.permissions import require_roles
from app.auth.deps import get_current_user
from app.services.schemas import ServiceCreate, ServiceOut, ServiceUpdate
from app.services.service import (
    create_service,
    list_services,
    get_service,
    update_service,
)

router = APIRouter(prefix="/services", tags=["Services"])


@router.post("/", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    try:
        return create_service(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=list[ServiceOut])
def list_all(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return list_services(db)


@router.get("/{service_id}", response_model=ServiceOut)
def get_one(
    service_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = get_service(db, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return service


@router.patch("/{service_id}", response_model=ServiceOut)
def update(
    service_id: str,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    service = get_service(db, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    return update_service(db, service, payload)