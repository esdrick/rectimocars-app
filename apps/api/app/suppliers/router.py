from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.auth.deps import get_current_user
from app.auth.permissions import require_roles
from app.constants import ROLE_ADMIN, ROLE_EDITOR
from app.suppliers.schemas import SupplierCreate, SupplierUpdate, SupplierOut
from app.suppliers.service import create_supplier, list_suppliers, update_supplier

router = APIRouter()


@router.get("/", response_model=list[SupplierOut])
def list_all(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return list_suppliers(db, include_inactive=include_inactive)


@router.post("/", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR)),
):
    return create_supplier(db, payload)


@router.patch("/{supplier_id}", response_model=SupplierOut)
def update(
    supplier_id: str,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR)),
):
    return update_supplier(db, supplier_id, payload)
