from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Customer, WorkOrder
from app.customers.schemas import CustomerCreate, CustomerUpdate
from app.payments.service import get_paid_total


def create_customer(db: Session, data: CustomerCreate) -> Customer:
    customer = Customer(
        name=data.name,
        phone=data.phone,
        email=data.email,
        address=data.address,
        notes=data.notes,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def list_customers(db: Session) -> list[Customer]:
    return db.query(Customer).order_by(Customer.created_at.desc()).all()


def get_customer(db: Session, customer_id: str) -> Customer | None:
    return db.query(Customer).filter(Customer.id == customer_id).first()


def update_customer(db: Session, customer: Customer, data: CustomerUpdate) -> Customer:
    payload = data.model_dump(exclude_unset=True)

    if "name" in payload and payload["name"] is not None:
        if not str(payload["name"]).strip():
            raise ValueError("El nombre es obligatorio")
        customer.name = str(payload["name"]).strip()

    if "phone" in payload:
        phone = payload["phone"]
        customer.phone = phone.strip() if isinstance(phone, str) else phone

    if "email" in payload:
        email = payload["email"]
        customer.email = email.strip() if isinstance(email, str) else email

    if "address" in payload:
        address = payload["address"]
        customer.address = address.strip() if isinstance(address, str) else address

    if "notes" in payload:
        notes = payload["notes"]
        customer.notes = notes.strip() if isinstance(notes, str) else notes

    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer

def get_customer_debt_total(db: Session, customer_id: str) -> Decimal:
    orders = db.query(WorkOrder).filter(WorkOrder.customer_id == customer_id).all()
    total_debt = Decimal('0')
    for order in orders:
        paid_total = get_paid_total(db, order.id)
        balance = order.total - paid_total
        if balance > 0:
            total_debt += balance
    return total_debt


def list_customer_orders_with_balance(db: Session, customer_id: str):
    orders = db.query(WorkOrder).filter(WorkOrder.customer_id == customer_id).all()
    orders_with_balance = []
    for order in orders:
        paid_total = get_paid_total(db, order.id)
        total = Decimal(str(order.total or 0))
        balance = total - paid_total
        age_days = 0
        if getattr(order, "created_at", None):
            age_days = max(0, (date.today() - order.created_at.date()).days)
        if age_days >= 60:
            collection_status = "VENCIDA"
        elif age_days >= 45:
            collection_status = "POR_VENCER"
        else:
            collection_status = "AL_DIA"
        orders_with_balance.append(
            {
                "id": order.id,
                "order_number": getattr(order, "order_number", None),
                "status": getattr(order, "status", None),
                "pricing_tier": getattr(order, "pricing_tier", None),
                "created_at": getattr(order, "created_at", None),
                "total": total,
                "paid_total": paid_total,
                "balance": balance,
                "collection_status": collection_status,
                "days_since_created": age_days,
            }
        )
    return orders_with_balance
