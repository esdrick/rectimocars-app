from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.accounts_payable.schemas import CashflowReportOut
from app.accounts_payable.service import build_cashflow_report
from app.db import get_db

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/cashflow", response_model=CashflowReportOut)
def get_cashflow_report(
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    include_details: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return build_cashflow_report(db, from_date=from_date, to_date=to_date, include_details=include_details)
