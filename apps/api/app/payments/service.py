from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import Payment, WorkOrder, WorkOrderItem
from app.work_orders.history import add_work_order_history
from app.payments.schemas import PaymentCreate


def get_paid_total(db: Session, order_id: str) -> Decimal:
    """Net total paid for an order (as Decimal).

    Convention (MVP):
    - Payment.amount is always stored as a positive value.
    - Payment.type determines the sign:
        * ABONO / FINAL => +amount
        * DEVOLUCION    => -amount

    This returns the net amount applied to the order.
    """

    total = (
        db.query(
            func.coalesce(
                func.sum(
                    case(
                        (func.upper(Payment.type) == "DEVOLUCION", -Payment.amount),
                        else_=Payment.amount,
                    )
                ),
                0,
            )
        )
        .filter(Payment.order_id == order_id)
        .scalar()
    )

    if total is None:
        return Decimal("0")

    return Decimal(str(total))


def create_payment(
    db: Session,
    order: WorkOrder,
    payload: PaymentCreate,
    actor_user_id: str | None = None,
) -> Payment:
    """Register a payment or refund (ABONO/FINAL/DEVOLUCION) enforcing business rules.

    Rules (MVP):
    - amount must be > 0
    - order.total must be > 0 to accept payments
    - cannot pay more than current balance
    - if type == FINAL, it must settle the balance exactly
    - DEVOLUCION is allowed only if there is paid_total available, and it cannot exceed paid_total

    Note: `paid_total` and `balance` are computed fields exposed via WorkOrderOut,
    they are not stored as DB columns.
    """

    amount = Decimal(str(payload.amount))
    if amount <= 0:
        raise ValueError("El monto del pago debe ser mayor a 0")

    current_status = str(getattr(order, "status", "") or "").upper().strip()
    if current_status == "DRAFT":
        item_count = (
            db.query(func.count(WorkOrderItem.id))
            .filter(WorkOrderItem.order_id == order.id)
            .scalar()
            or 0
        )
        if item_count <= 0:
            raise ValueError("No se puede registrar un pago en una orden DRAFT sin servicios agregados.")

    order_total = Decimal(str(order.total))
    if order_total <= 0:
        raise ValueError("No se puede registrar un pago si el total de la orden es 0")

    paid_total = get_paid_total(db, order.id)
    balance = order_total - paid_total

    payment_type = str(payload.type).upper()

    # Refunds (DEVOLUCION) reduce the paid_total.
    if payment_type == "DEVOLUCION":
        if paid_total <= 0:
            raise ValueError("No hay pagos para devolver en esta orden")

        if amount > paid_total:
            raise ValueError("La devolución no puede superar el total pagado")

        # Create refund and exit (no need to validate against balance)
        payment = Payment(
            order_id=order.id,
            amount=payload.amount,
            currency=payload.currency,
            method=payload.method,
            type=payload.type,
            created_by_id=actor_user_id,
        )
        db.add(payment)
        add_work_order_history(
            db,
            order.id,
            {
                "payment_added": {
                    "type": payment.type,
                    "amount": str(payment.amount),
                    "currency": payment.currency,
                    "method": payment.method,
                }
            },
            actor_user_id,
        )
        db.commit()
        db.refresh(payment)
        return payment

    if balance <= 0:
        raise ValueError("La orden ya está totalmente pagada")

    if amount > balance:
        raise ValueError("El monto del pago no puede superar el saldo pendiente")

    if payment_type == "FINAL" and amount != balance:
        raise ValueError("El pago FINAL debe cancelar exactamente el saldo pendiente")

    if current_status == "DRAFT":
        order.status = "RECIBIDO"
        order.status_changed_at = datetime.utcnow()
        order.status_changed_by_id = actor_user_id
        db.add(order)
        add_work_order_history(
            db,
            order.id,
            {
                "status": {
                    "from": "DRAFT",
                    "to": "RECIBIDO",
                    "auto": True,
                    "reason": "Primer pago registrado en la orden",
                }
            },
            actor_user_id,
        )

    payment = Payment(
        order_id=order.id,
        amount=payload.amount,
        currency=payload.currency,
        method=payload.method,
        type=payload.type,
        created_by_id=actor_user_id,
    )

    db.add(payment)
    add_work_order_history(
        db,
        order.id,
        {
            "payment_added": {
                "type": payment.type,
                "amount": str(payment.amount),
                "currency": payment.currency,
                "method": payment.method,
            }
        },
        actor_user_id,
    )
    db.commit()
    db.refresh(payment)
    return payment


def list_payments_for_order(db: Session, order_id: str) -> list[Payment]:
    return (
        db.query(Payment)
        .filter(Payment.order_id == order_id)
        .order_by(Payment.created_at.desc())
        .all()
    )


def create_refund_if_overpaid(
    db: Session,
    order_id: str,
    actor_user_id: str | None = None,
) -> Payment | None:
    """Create an automatic refund (DEVOLUCION) if payments exceed the current order total.

    Scenario:
    - The order was previously paid (or partially paid)
    - Items are removed/edited and order.total decreases
    - If net paid_total > order.total, we create a DEVOLUCION for the difference.

    Important:
    - This function does NOT commit. It only adds the refund and flushes.
      The caller (e.g., work_order_items/service.py) controls the transaction.
    """

    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise ValueError("Orden no existe")

    order_total = Decimal(str(order.total))
    paid_total = get_paid_total(db, order_id)

    if paid_total <= order_total:
        return None

    refund_amount = paid_total - order_total

    refund = Payment(
        order_id=order_id,
        amount=refund_amount,
        currency="USD",
        method="AJUSTE",
        type="DEVOLUCION",
        created_by_id=actor_user_id,
    )

    db.add(refund)
    add_work_order_history(
        db,
        order_id,
        {
            "payment_added": {
                "type": refund.type,
                "amount": str(refund.amount),
                "currency": refund.currency,
                "method": refund.method,
                "auto": True,
            }
        },
        actor_user_id,
    )
    db.flush()
    return refund


def get_paid_total_float(db: Session, order_id: str) -> float:
    """Backward-friendly helper if some code expects float."""
    return float(get_paid_total(db, order_id))
