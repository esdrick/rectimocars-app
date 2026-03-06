from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.constants import ROLE_ADMIN
from app.auth.permissions import require_roles
from app.auth.deps import get_current_user

from app.engine_models.schemas import EngineModelCreate, EngineModelUpdate, EngineModelOut
from app.engine_models.service import (
    create_engine_model,
    list_engine_models,
    get_engine_model,
    update_engine_model,
)

router = APIRouter(prefix="/engine-models", tags=["Engine Models"])


@router.post("/", response_model=EngineModelOut, status_code=status.HTTP_201_CREATED)
def create(
    payload: EngineModelCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    try:
        return create_engine_model(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=list[EngineModelOut])
def list_all(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return list_engine_models(db, include_inactive=include_inactive)


@router.get("/{engine_model_id}", response_model=EngineModelOut)
def get_one(
    engine_model_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    model = get_engine_model(db, engine_model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Tipo de motor no encontrado")
    return model


@router.patch("/{engine_model_id}", response_model=EngineModelOut)
def update(
    engine_model_id: str,
    payload: EngineModelUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    model = get_engine_model(db, engine_model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Tipo de motor no encontrado")

    try:
        return update_engine_model(db, model, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
