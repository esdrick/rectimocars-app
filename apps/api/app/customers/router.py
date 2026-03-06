from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.customers.schemas import CustomerCreate, CustomerUpdate, CustomerOut, CustomerReceivablesOut
from app.customers.service import (
    create_customer,
    list_customers,
    get_customer,
    get_customer_debt_total,
    list_customer_orders_with_balance,
    update_customer,
)

from app.auth.deps import get_current_user
from app.auth.permissions import require_roles
from app.constants import ROLE_ADMIN, ROLE_REGISTRADOR
from app.models import User

router = APIRouter()


@router.post(
    "/",
    response_model=CustomerOut,
    status_code=status.HTTP_201_CREATED,
)
def create(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_REGISTRADOR)),
):
    return create_customer(db, payload)


@router.get("/", response_model=list[CustomerOut])
def list_all(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customers = list_customers(db)
    for c in customers:
        c.debt_total = get_customer_debt_total(db, c.id)
    return customers


@router.get("/{customer_id}", response_model=CustomerOut)
def get_one(
    customer_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customer = get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    customer.debt_total = get_customer_debt_total(db, customer.id)
    return customer


@router.patch("/{customer_id}", response_model=CustomerOut)
def update(
    customer_id: str,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_REGISTRADOR)),
):
    customer = get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    try:
        updated = update_customer(db, customer, payload)
        updated.debt_total = get_customer_debt_total(db, updated.id)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{customer_id}/receivables", response_model=CustomerReceivablesOut)
def receivables(
    customer_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customer = get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    debt_total = get_customer_debt_total(db, customer_id)
    orders = list_customer_orders_with_balance(db, customer_id)
    return {"customer_id": customer_id, "debt_total": debt_total, "orders": orders}


@router.get("/{customer_id}/work-orders")
def customer_work_orders(
    customer_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customer = get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return list_customer_orders_with_balance(db, customer_id)
