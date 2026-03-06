import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, text, JSON, Table, Column, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

work_order_workers = Table(
    "work_order_workers",
    Base.metadata,
    Column("work_order_id", ForeignKey("work_orders.id"), primary_key=True),
    Column("worker_id", ForeignKey("workers.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)  # administrador | editor | registrador

    # Password hash (auth)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    payments_created = relationship("Payment", back_populates="created_by")
    work_orders_status_changed = relationship("WorkOrder", back_populates="status_changed_by")


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class WorkOrder(Base):
    __tablename__ = "work_orders"
    # Internal primary key (technical). Do NOT display to users.
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    # Human-friendly sequential order number (shown to users). Keep UUID `id` as internal PK.
    order_number: Mapped[int] = mapped_column(
        Integer,
        unique=True,
        index=True,
        nullable=False,
        server_default=text("nextval('work_orders_order_number_seq'::regclass)"),
    )

    status: Mapped[str] = mapped_column(String(30), default="RECIBIDO", nullable=False)
    pricing_tier: Mapped[str] = mapped_column(
        String(2),
        default="TD",
        nullable=False,
    )  # TD = cliente directo | SC = subcontrato
    piece: Mapped[str | None] = mapped_column(String(255), nullable=True)  # culata, bloque, cigüeñal...
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    engine_model_id: Mapped[str | None] = mapped_column(ForeignKey("engine_models.id"), nullable=True)
    offered_for_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    status_changed_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    customer = relationship("Customer")
    payments = relationship("Payment", back_populates="order")

    status_changed_by = relationship("User", back_populates="work_orders_status_changed")

    items = relationship("WorkOrderItem", back_populates="order", cascade="all, delete-orphan")

    assigned_worker_id: Mapped[str | None] = mapped_column(ForeignKey("workers.id"), nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    assigned_worker = relationship("Worker")
    assigned_workers = relationship(
        "Worker",
        secondary=work_order_workers,
        back_populates="work_orders",
    )
    engine_model = relationship("EngineModel")
    received_parts = relationship(
        "WorkOrderReceivedPart",
        back_populates="work_order",
        cascade="all, delete-orphan",
    )

    @property
    def engine_model_label(self) -> str | None:
        if self.engine_model is None:
            return None
        return getattr(self.engine_model, "label", None)


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id: Mapped[str] = mapped_column(ForeignKey("work_orders.id"), nullable=False)

    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)  # USD/VES/EUR
    method: Mapped[str] = mapped_column(String(50), default="EFECTIVO", nullable=False)  # efectivo, zelle, etc.
    type: Mapped[str] = mapped_column(String(20), default="ABONO", nullable=False)  # ABONO | FINAL | DEVOLUCION
    # Nota: amount siempre es positivo; el signo lo determina type (DEVOLUCION se resta en los totales)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    order = relationship("WorkOrder", back_populates="payments")
    created_by = relationship("User", back_populates="payments_created")


class WorkOrderItem(Base):
    __tablename__ = "work_order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id: Mapped[str] = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    service_id: Mapped[str] = mapped_column(ForeignKey("services.id"), nullable=False)

    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    qty: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=1, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    cilindraje: Mapped[int | None] = mapped_column(Integer, nullable=True)
    valvulas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sellos: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("WorkOrder", back_populates="items")
    service = relationship("Service")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )  # ✅ ESTE CAMPO FALTABA

    cilindraje: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Cilindraje: 4, 6, 8, NO_APLICA",
    )

    valvulas: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Válvulas: 8, 12, 16, 24, NO_APLICA",
    )

    sellos: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Sellos: 2, 4, NO_APLICA",
    )

    price_td: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Precio para cliente directo (TD)",
    )

    price_sc: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Precio para subcontrato (SC)",
    )

    active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )


class Worker(Base):
    __tablename__ = "workers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # "función" o rol interno del taller (no confundir con roles de login)
    job_role: Mapped[str | None] = mapped_column(String(50), nullable=True)  # ej: "tornador", "mecanico", etc.

    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    work_orders = relationship(
        "WorkOrder",
        secondary=work_order_workers,
        back_populates="assigned_workers",
    )


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    supplies_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)

    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class EngineModel(Base):
    __tablename__ = "engine_models"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    label: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ReceivedPartCatalog(Base):
    __tablename__ = "received_parts_catalog"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    label: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class WorkOrderReceivedPart(Base):
    __tablename__ = "work_order_received_parts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    work_order_id: Mapped[str] = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    part_id: Mapped[str] = mapped_column(ForeignKey("received_parts_catalog.id"), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    work_order = relationship("WorkOrder", back_populates="received_parts")
    part = relationship("ReceivedPartCatalog")

    @property
    def label(self) -> str | None:
        if self.part is None:
            return None
        return getattr(self.part, "label", None)


class WorkOrderMetaHistory(Base):
    __tablename__ = "work_order_meta_history"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    work_order_id: Mapped[str] = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    changed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    changes_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(String(36), primary_key=True)
    code = Column(String(50), unique=True, nullable=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    active = Column(Boolean, nullable=False, server_default=text("true"))
    stock_on_hand = Column(Numeric(12, 2), nullable=False, server_default="0")
    stock_min = Column(Numeric(12, 2), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(String(36), primary_key=True)
    item_id = Column(String(36), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(10), nullable=False)  # IN/OUT/ADJUST
    qty = Column(Numeric(12, 2), nullable=False)

    unit_cost = Column(Numeric(12, 2), nullable=True)
    supplier = Column(String(255), nullable=True)
    payment_mode = Column(String(20), nullable=False, server_default=text("'CONTADO'"))
    total_cost = Column(Numeric(12, 2), nullable=True)
    due_date = Column(Date, nullable=True)
    work_order_id = Column(String(36), ForeignKey("work_orders.id", ondelete="SET NULL"), nullable=True)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    item = relationship("InventoryItem")


class AccountPayable(Base):
    __tablename__ = "accounts_payable"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    expense_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"), index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
        server_default=text("now()"),
    )


class WorkOrderConsumable(Base):
    __tablename__ = "work_order_consumables"

    work_order_id = Column(String(36), ForeignKey("work_orders.id", ondelete="CASCADE"), primary_key=True)
    item_id = Column(String(36), ForeignKey("inventory_items.id", ondelete="CASCADE"), primary_key=True)
    qty = Column(Numeric(12, 2), nullable=False, server_default="0")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
