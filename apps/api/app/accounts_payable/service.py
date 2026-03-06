from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import Date, and_, case, cast, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AccountPayable, Payment, WorkOrder

from .schemas import (
    ACCOUNT_PAYABLE_EXPENSE_TYPES,
    ACCOUNT_PAYABLE_SOURCE_INVENTORY_PURCHASE,
    ACCOUNT_PAYABLE_STATUS_LABELS,
    ACCOUNT_PAYABLE_STATUS_THRESHOLD_DAYS,
    ACCOUNT_PAYABLE_STATUS_VALUES,
    AccountPayableCreate,
    AccountPayableUpdate,
)


def days_available(due_date: date) -> int:
    return (due_date - date.today()).days


def compute_status(due_date: date, threshold: int = ACCOUNT_PAYABLE_STATUS_THRESHOLD_DAYS) -> str:
    remaining_days = days_available(due_date)
    if remaining_days < 0:
        return ACCOUNT_PAYABLE_STATUS_LABELS["vencido"]
    if remaining_days <= threshold:
        return ACCOUNT_PAYABLE_STATUS_LABELS["por_vencer"]
    return ACCOUNT_PAYABLE_STATUS_LABELS["vigente"]


def _normalize_expense_type(value: str | None) -> str:
    normalized = (value or "").strip().upper()
    if not normalized:
        raise HTTPException(status_code=400, detail="expense_type es requerido.")
    if normalized not in ACCOUNT_PAYABLE_EXPENSE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"expense_type inválido. Usa uno de: {', '.join(ACCOUNT_PAYABLE_EXPENSE_TYPES)}",
        )
    return normalized


def _validate_amount(value: Decimal | None) -> Decimal:
    if value is None:
        raise HTTPException(status_code=400, detail="amount es requerido.")
    amount = Decimal(str(value))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount debe ser mayor a 0.")
    return amount


def _serialize_account_payable(record: AccountPayable) -> dict:
    return {
        "id": record.id,
        "description": record.description,
        "expense_type": record.expense_type,
        "amount": record.amount,
        "due_date": record.due_date,
        "days_available": days_available(record.due_date),
        "status": compute_status(record.due_date),
        "paid": record.paid,
        "paid_at": record.paid_at,
        "notes": record.notes,
        "source_type": record.source_type,
        "source_id": record.source_id,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def _get_account_payable(db: Session, payable_id: str) -> AccountPayable:
    record = db.query(AccountPayable).filter(AccountPayable.id == payable_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Cuenta por pagar no encontrada.")
    return record


def _status_filter_clause(status: str, threshold: int = ACCOUNT_PAYABLE_STATUS_THRESHOLD_DAYS):
    normalized = status.strip().lower()
    if normalized not in ACCOUNT_PAYABLE_STATUS_VALUES:
        raise HTTPException(status_code=400, detail="status inválido. Usa vigente, por_vencer o vencido.")

    today = date.today()
    threshold_date = today + timedelta(days=threshold)
    if normalized == "vencido":
        return AccountPayable.due_date < today
    if normalized == "por_vencer":
        return and_(AccountPayable.due_date >= today, AccountPayable.due_date <= threshold_date)
    return AccountPayable.due_date > threshold_date


def list_accounts_payable(
    db: Session,
    *,
    paid: bool | None = None,
    status: str | None = None,
    expense_type: str | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    q: str | None = None,
) -> list[dict]:
    query = db.query(AccountPayable)

    if paid is not None:
        query = query.filter(AccountPayable.paid == paid)
    if status:
        query = query.filter(_status_filter_clause(status))
    if expense_type:
        query = query.filter(AccountPayable.expense_type == _normalize_expense_type(expense_type))
    if due_from:
        query = query.filter(AccountPayable.due_date >= due_from)
    if due_to:
        query = query.filter(AccountPayable.due_date <= due_to)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                AccountPayable.description.ilike(like),
                func.coalesce(AccountPayable.notes, "").ilike(like),
            )
        )

    rows = query.order_by(AccountPayable.paid.asc(), AccountPayable.due_date.asc(), AccountPayable.created_at.desc()).all()
    return [_serialize_account_payable(row) for row in rows]


def get_account_payable(db: Session, payable_id: str) -> dict:
    return _serialize_account_payable(_get_account_payable(db, payable_id))


def create_account_payable(db: Session, payload: AccountPayableCreate) -> dict:
    description = payload.description.strip()
    if not description:
        raise HTTPException(status_code=400, detail="description es requerida.")

    record = AccountPayable(
        description=description,
        expense_type=_normalize_expense_type(payload.expense_type),
        amount=_validate_amount(payload.amount),
        due_date=payload.due_date,
        paid=bool(payload.paid),
        paid_at=payload.paid_at or (datetime.utcnow() if payload.paid else None),
        notes=payload.notes.strip() if payload.notes else None,
        source_type=payload.source_type.strip().upper() if payload.source_type else None,
        source_id=payload.source_id.strip() if payload.source_id else None,
    )

    db.add(record)
    try:
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear la cuenta por pagar.")
    return _serialize_account_payable(record)


def update_account_payable(db: Session, payable_id: str, payload: AccountPayableUpdate) -> dict:
    record = _get_account_payable(db, payable_id)
    data = payload.model_dump(exclude_unset=True)

    if "description" in data:
        description = (data.get("description") or "").strip()
        if not description:
            raise HTTPException(status_code=400, detail="description es requerida.")
        record.description = description
    if "expense_type" in data:
        record.expense_type = _normalize_expense_type(data.get("expense_type"))
    if "amount" in data:
        record.amount = _validate_amount(data.get("amount"))
    if "due_date" in data:
        if data.get("due_date") is None:
            raise HTTPException(status_code=400, detail="due_date es requerida.")
        record.due_date = data["due_date"]
    if "notes" in data:
        record.notes = data["notes"].strip() if data["notes"] else None
    if "source_type" in data:
        record.source_type = data["source_type"].strip().upper() if data["source_type"] else None
    if "source_id" in data:
        record.source_id = data["source_id"].strip() if data["source_id"] else None
    if "paid" in data:
        if data["paid"]:
            record.paid = True
            record.paid_at = data.get("paid_at") or record.paid_at or datetime.utcnow()
        else:
            record.paid = False
            record.paid_at = None
    elif "paid_at" in data and record.paid:
        record.paid_at = data.get("paid_at") or datetime.utcnow()

    record.updated_at = datetime.utcnow()
    try:
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo actualizar la cuenta por pagar.")
    return _serialize_account_payable(record)


def mark_account_payable_paid(db: Session, payable_id: str, paid_at: datetime | None = None) -> dict:
    record = _get_account_payable(db, payable_id)
    record.paid = True
    record.paid_at = paid_at or datetime.utcnow()
    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return _serialize_account_payable(record)


def mark_account_payable_unpaid(db: Session, payable_id: str) -> dict:
    record = _get_account_payable(db, payable_id)
    record.paid = False
    record.paid_at = None
    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return _serialize_account_payable(record)


def create_inventory_purchase_payable(
    db: Session,
    *,
    movement_id: str,
    item_name: str,
    supplier: str | None,
    total_cost: Decimal,
    due_date: date,
    notes: str | None = None,
) -> AccountPayable:
    description = f"Compra inventario: {supplier.strip()}" if supplier and supplier.strip() else f"Compra inventario: {item_name}"
    payable = AccountPayable(
        description=description,
        expense_type="COMPRA_INVENTARIO",
        amount=_validate_amount(total_cost),
        due_date=due_date,
        paid=False,
        paid_at=None,
        notes=notes.strip() if notes else None,
        source_type=ACCOUNT_PAYABLE_SOURCE_INVENTORY_PURCHASE,
        source_id=movement_id,
    )
    db.add(payable)
    db.flush()
    return payable


def build_cashflow_report(
    db: Session,
    *,
    from_date: date,
    to_date: date,
    include_details: bool = False,
) -> dict:
    if to_date < from_date:
        raise HTTPException(status_code=400, detail="El rango de fechas es inválido.")

    start_dt = datetime.combine(from_date, time.min)
    end_dt = datetime.combine(to_date + timedelta(days=1), time.min)

    signed_payment_amount = case(
        (func.upper(Payment.type) == "DEVOLUCION", -Payment.amount),
        else_=Payment.amount,
    )

    ingresos_total = (
        db.query(func.coalesce(func.sum(signed_payment_amount), 0))
        .filter(Payment.created_at >= start_dt, Payment.created_at < end_dt)
        .scalar()
    )
    egresos_total = (
        db.query(func.coalesce(func.sum(AccountPayable.amount), 0))
        .filter(
            AccountPayable.paid == True,  # noqa: E712
            AccountPayable.paid_at.isnot(None),
            AccountPayable.paid_at >= start_dt,
            AccountPayable.paid_at < end_dt,
        )
        .scalar()
    )
    pendientes_total = (
        db.query(func.coalesce(func.sum(AccountPayable.amount), 0))
        .filter(AccountPayable.paid == False)  # noqa: E712
        .scalar()
    )

    payments_by_day = (
        db.query(
            cast(Payment.created_at, Date).label("day"),
            func.coalesce(func.sum(signed_payment_amount), 0).label("ingresos_total"),
        )
        .filter(Payment.created_at >= start_dt, Payment.created_at < end_dt)
        .group_by(cast(Payment.created_at, Date))
        .all()
    )
    expenses_by_day = (
        db.query(
            cast(AccountPayable.paid_at, Date).label("day"),
            func.coalesce(func.sum(AccountPayable.amount), 0).label("egresos_total"),
        )
        .filter(
            AccountPayable.paid == True,  # noqa: E712
            AccountPayable.paid_at.isnot(None),
            AccountPayable.paid_at >= start_dt,
            AccountPayable.paid_at < end_dt,
        )
        .group_by(cast(AccountPayable.paid_at, Date))
        .all()
    )

    day_map: dict[date, dict] = {}
    for row in payments_by_day:
        day_map.setdefault(row.day, {"day": row.day, "ingresos_total": Decimal("0"), "egresos_total": Decimal("0")})
        day_map[row.day]["ingresos_total"] = Decimal(str(row.ingresos_total or 0))
    for row in expenses_by_day:
        day_map.setdefault(row.day, {"day": row.day, "ingresos_total": Decimal("0"), "egresos_total": Decimal("0")})
        day_map[row.day]["egresos_total"] = Decimal(str(row.egresos_total or 0))

    breakdown_by_day = []
    for day in sorted(day_map):
        income = day_map[day]["ingresos_total"]
        expense = day_map[day]["egresos_total"]
        breakdown_by_day.append(
            {
                "day": day,
                "incomes_total": income,
                "expenses_total": expense,
                "net_total": income - expense,
            }
        )

    incomes: list[dict] = []
    expenses: list[dict] = []
    if include_details:
        payment_rows = (
            db.query(Payment, WorkOrder.order_number)
            .outerjoin(WorkOrder, WorkOrder.id == Payment.order_id)
            .filter(Payment.created_at >= start_dt, Payment.created_at < end_dt)
            .order_by(Payment.created_at.desc())
            .all()
        )
        for payment, order_number in payment_rows:
            sign = Decimal("-1") if str(payment.type).upper() == "DEVOLUCION" else Decimal("1")
            order_ref = f"#{order_number}" if order_number is not None else payment.order_id
            incomes.append(
                {
                    "id": payment.id,
                    "kind": str(payment.type).upper(),
                    "description": f"Pago orden {order_ref}",
                    "amount": Decimal(str(payment.amount)) * sign,
                    "occurred_at": payment.created_at,
                    "source_type": "WORK_ORDER_PAYMENT",
                    "source_id": payment.order_id,
                }
            )

        expense_rows = (
            db.query(AccountPayable)
            .filter(
                AccountPayable.paid == True,  # noqa: E712
                AccountPayable.paid_at.isnot(None),
                AccountPayable.paid_at >= start_dt,
                AccountPayable.paid_at < end_dt,
            )
            .order_by(AccountPayable.paid_at.desc())
            .all()
        )
        for expense in expense_rows:
            expenses.append(
                {
                    "id": expense.id,
                    "kind": "ACCOUNT_PAYABLE",
                    "description": expense.description,
                    "amount": expense.amount,
                    "occurred_at": expense.paid_at,
                    "source_type": expense.source_type,
                    "source_id": expense.source_id,
                }
            )

    ingresos_total_dec = Decimal(str(ingresos_total or 0))
    egresos_total_dec = Decimal(str(egresos_total or 0))
    pendientes_total_dec = Decimal(str(pendientes_total or 0))
    return {
        "from_date": from_date,
        "to_date": to_date,
        "ingresos_total": ingresos_total_dec,
        "egresos_total": egresos_total_dec,
        "neto": ingresos_total_dec - egresos_total_dec,
        "pendientes_total": pendientes_total_dec,
        "breakdown_by_day": breakdown_by_day,
        "incomes": incomes,
        "expenses": expenses,
    }
