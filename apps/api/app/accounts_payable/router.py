from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db import get_db

from .schemas import AccountPayableCreate, AccountPayableOut, AccountPayableUpdate, MarkPaidPayload
from .service import (
    create_account_payable,
    get_account_payable,
    list_accounts_payable,
    mark_account_payable_paid,
    mark_account_payable_unpaid,
    update_account_payable,
)

router = APIRouter(prefix="/accounts-payable", tags=["accounts-payable"])


@router.get("", response_model=list[AccountPayableOut])
def list_accounts_payable_endpoint(
    paid: bool | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    expense_type: str | None = Query(default=None),
    due_from: date | None = Query(default=None),
    due_to: date | None = Query(default=None),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return list_accounts_payable(
        db,
        paid=paid,
        status=status_filter,
        expense_type=expense_type,
        due_from=due_from,
        due_to=due_to,
        q=q,
    )


@router.post("", response_model=AccountPayableOut, status_code=status.HTTP_201_CREATED)
def create_account_payable_endpoint(payload: AccountPayableCreate, db: Session = Depends(get_db)):
    return create_account_payable(db, payload)


@router.get("/{payable_id}", response_model=AccountPayableOut)
def get_account_payable_endpoint(payable_id: str, db: Session = Depends(get_db)):
    return get_account_payable(db, payable_id)


@router.patch("/{payable_id}", response_model=AccountPayableOut)
def update_account_payable_endpoint(payable_id: str, payload: AccountPayableUpdate, db: Session = Depends(get_db)):
    return update_account_payable(db, payable_id, payload)


@router.post("/{payable_id}/mark-paid", response_model=AccountPayableOut)
def mark_account_payable_paid_endpoint(
    payable_id: str,
    payload: MarkPaidPayload | None = None,
    db: Session = Depends(get_db),
):
    return mark_account_payable_paid(db, payable_id, paid_at=payload.paid_at if payload else None)


@router.post("/{payable_id}/mark-unpaid", response_model=AccountPayableOut)
def mark_account_payable_unpaid_endpoint(payable_id: str, db: Session = Depends(get_db)):
    return mark_account_payable_unpaid(db, payable_id)
