from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models import Supplier
from app.suppliers.schemas import SupplierCreate, SupplierUpdate


def list_suppliers(db: Session, include_inactive: bool = False) -> list[Supplier]:
    query = db.query(Supplier)
    if not include_inactive:
        query = query.filter(Supplier.active == True)  # noqa: E712
    return query.order_by(Supplier.created_at.desc()).all()


def create_supplier(db: Session, payload: SupplierCreate) -> Supplier:
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="El nombre es obligatorio.")
    supplier = Supplier(
        name=payload.name.strip(),
        supplies_type=payload.supplies_type.strip() if payload.supplies_type else None,
        phone=payload.phone.strip() if payload.phone else None,
        email=payload.email.strip() if payload.email else None,
        address=payload.address.strip() if payload.address else None,
        active=payload.active if payload.active is not None else True,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


def update_supplier(db: Session, supplier_id: str, payload: SupplierUpdate) -> Supplier:
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado.")
    if payload.name is not None:
        if not payload.name.strip():
            raise HTTPException(status_code=400, detail="El nombre es obligatorio.")
        supplier.name = payload.name.strip()
    if payload.supplies_type is not None:
        supplier.supplies_type = payload.supplies_type.strip() if payload.supplies_type else None
    if payload.phone is not None:
        supplier.phone = payload.phone.strip() if payload.phone else None
    if payload.email is not None:
        supplier.email = payload.email.strip() if payload.email else None
    if payload.address is not None:
        supplier.address = payload.address.strip() if payload.address else None
    if payload.active is not None:
        supplier.active = payload.active

    db.commit()
    db.refresh(supplier)
    return supplier
