from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from io import BytesIO
from datetime import datetime
from zoneinfo import ZoneInfo
from decimal import Decimal
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from sqlalchemy.orm import Session
from decimal import Decimal

from app.db import get_db
from app.models import User, Customer
from app.constants import ROLE_ADMIN, ROLE_EDITOR, ROLE_REGISTRADOR

from app.auth.deps import get_current_user
from app.auth.permissions import require_roles

from app.work_orders.schemas import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderOut,
    WorkOrderAssign,
)
from app.work_orders.meta_schemas import WorkOrderMetaHistoryOut
from app.work_orders.service import (
    create_work_order,
    list_work_orders,
    get_work_order,
    update_work_order,
    assign_work_order,
    unassign_work_order,
    list_accounts_receivable,
    delete_work_order,
    list_meta_history,
)
from app.work_order_items.service import list_items

from app.payments.schemas import PaymentCreate, PaymentOut
from app.payments.service import (
    create_payment,
    list_payments_for_order,
    get_paid_total,
)

router = APIRouter()


def _fmt_money(value: Decimal | int | float | None) -> str:
    try:
        if value is None:
            return "0.00 $"
        d = value if isinstance(value, Decimal) else Decimal(str(value))
        return f"{d:.2f} $"
    except Exception:
        return "0.00 $"


def _fmt_date(value) -> str:
    if not value:
        return "—"
    if isinstance(value, str):
        return value
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")
    try:
        return value.strftime("%d/%m/%Y")
    except Exception:
        return str(value)


def _build_invoice_pdf(order, items, payments, customer_name: str, customer_phone: str) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=30,
        rightMargin=30,
        topMargin=30,
        bottomMargin=30,
        title="Nota de compra",
    )
    styles = getSampleStyleSheet()
    story = []

    # Header: two-column layout
    company_info = [
        Paragraph("RECTIMOCARS ARAGUA C.A", styles["Title"]),
        Paragraph("RIF. J31387263-6", styles["Normal"]),
        Paragraph("Av. Ruíz Pineda, Maracay 2106, Aragua, Venezuela", styles["Normal"]),
    ]

    caracas = ZoneInfo("America/Caracas")
    issued_at = datetime.now(caracas).strftime("%d/%m/%Y %H:%M")
    offered_for = _fmt_date(getattr(order, "offered_for_date", None))

    invoice_info_data = [
        [Paragraph("<b>NOTA DE VENTA</b>", styles["Normal"])],
        [f"Nº Orden: {order.order_number or '—'}"],
        [f"Fecha emisión: {issued_at}"],
        [f"Ofrecido para: {offered_for}"],
    ]
    invoice_info_table = Table(invoice_info_data, colWidths=[160])
    invoice_info_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), colors.lightgrey),
                ("TEXTCOLOR", (0, 0), (0, 0), colors.black),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
                ("BOX", (0, 0), (-1, -1), 1, colors.black),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    header_table = Table(
        [
            [company_info, invoice_info_table],
        ],
        colWidths=[320, 180],
        hAlign="LEFT",
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 20))

    # Datos del cliente section as a small table with 2 columns
    client_data = [
        [Paragraph("<b>Datos del cliente</b>", styles["Heading3"]), ""],
        [Paragraph("<b>Cliente:</b>", styles["Normal"]), Paragraph(customer_name, styles["Normal"])],
        [Paragraph("<b>Teléfono:</b>", styles["Normal"]), Paragraph(customer_phone, styles["Normal"])],
    ]
    client_table = Table(client_data, colWidths=[90, 410])
    client_table.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (1, 0)),
                ("BACKGROUND", (0, 0), (1, 0), colors.lightgrey),
                ("ALIGN", (0, 0), (-1, 0), "LEFT"),
                ("FONTNAME", (0, 0), (1, 0), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (1, 0), 6),
                ("TOPPADDING", (0, 0), (1, 0), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(client_table)
    story.append(Spacer(1, 20))

    # Items table
    items_data = [["Descripción", "Cantidad", "Precio unitario", "Subtotal"]]
    for it in items:
        desc = it.description or (it.service.name if getattr(it, "service", None) else "Servicio")
        qty = it.qty
        price = it.unit_price
        subtotal = (Decimal(str(qty)) * Decimal(str(price))) if qty is not None and price is not None else 0
        items_data.append([str(desc), str(qty), _fmt_money(price), _fmt_money(subtotal)])

    col_widths = [260, 55, 85, 85]
    t = Table(items_data, hAlign="LEFT", colWidths=col_widths)

    # Zebra striping for rows, alternating background
    row_bg_colors = []
    for i in range(1, len(items_data)):
        if i % 2 == 1:
            row_bg_colors.append(("BACKGROUND", (0, i), (-1, i), colors.whitesmoke))
    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
    ]
    t_style.extend(row_bg_colors)
    t.setStyle(TableStyle(t_style))

    story.append(Paragraph("Servicios / Items", styles["Heading3"]))
    story.append(t)
    story.append(Spacer(1, 12))

    # Totals box aligned to the right under items table
    total = getattr(order, "total", None)
    paid_total = getattr(order, "paid_total", None)
    balance = getattr(order, "balance", None)

    totals_data = [
        [Paragraph("<b>Total:</b>", styles["Normal"]), Paragraph(_fmt_money(total), styles["Normal"])],
        [Paragraph("<b>Pagado:</b>", styles["Normal"]), Paragraph(_fmt_money(paid_total), styles["Normal"])],
        [Paragraph("<b>Saldo:</b>", styles["Normal"]), Paragraph(_fmt_money(balance), styles["Normal"])],
    ]
    totals_table = Table(totals_data, colWidths=[80, 80], hAlign="RIGHT")
    totals_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (-1, -1), colors.whitesmoke),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(totals_table)
    story.append(Spacer(1, 20))

    # Payments section (only if payments exist)
    if payments:
        story.append(Paragraph("Pagos", styles["Heading3"]))
        payments_data = [["Fecha", "Método", "Monto", "Nota"]]
        for p in payments:
            pay_date = _fmt_date(getattr(p, "created_at", None))
            method = getattr(p, "method", "—")
            amount = _fmt_money(getattr(p, "amount", None))
            note = getattr(p, "note", "—") or "—"
            payments_data.append([pay_date, method, amount, note])

        payments_col_widths = [110, 110, 80, 140]
        payments_table = Table(payments_data, colWidths=payments_col_widths, hAlign="LEFT")
        pay_t_style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (2, 1), (2, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("TOPPADDING", (0, 1), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ]
        # Zebra striping for payments rows
        for i in range(1, len(payments_data)):
            if i % 2 == 1:
                pay_t_style.append(("BACKGROUND", (0, i), (-1, i), colors.whitesmoke))
        payments_table.setStyle(TableStyle(pay_t_style))
        story.append(payments_table)
        story.append(Spacer(1, 20))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def _attach_payment_totals(db: Session, order):
    """Attach computed fields to the SQLAlchemy object so Pydantic can expose them.

    Money values are handled as Decimal to avoid float rounding issues.

    Notes:
    - `paid_total` is the NET paid total (payments - refunds) returned by get_paid_total().
    - `balance` can be negative only if something is inconsistent; business rules + auto-refund
      should normally keep it >= 0.
    - `payment_status` is derived from total/paid.
    """
    paid = get_paid_total(db, order.id)  # Decimal

    # SQLAlchemy Numeric usually returns Decimal, but normalize defensively.
    order_total = order.total
    if not isinstance(order_total, Decimal):
        order_total = Decimal(str(order_total))

    balance = order_total - paid

    order.paid_total = paid
    order.balance = balance

    # Compute payment_status
    if order_total <= 0:
        # No hay nada que cobrar todavía
        order.payment_status = "PENDIENTE"
    elif paid <= 0:
        order.payment_status = "PENDIENTE"
    elif balance > 0:
        order.payment_status = "PARCIAL"
    else:
        # balance <= 0 => pagado (o sobrepagado, cosa que el auto-refund debería evitar)
        order.payment_status = "PAGADO"

    return order


@router.post("/", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
def create(
    payload: WorkOrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_REGISTRADOR)),
):
    try:
        order = create_work_order(db, payload)
        return _attach_payment_totals(db, order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=list[WorkOrderOut])
def list_all(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    orders = list_work_orders(db)
    return [_attach_payment_totals(db, o) for o in orders]


# --- Cuentas por cobrar endpoint ---
from decimal import Decimal

@router.get("/accounts-receivable")
def accounts_receivable(
    customer_id: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    min_balance: Decimal | None = None,
    collection_status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR, ROLE_REGISTRADOR)),
):
    """Cuentas por cobrar: órdenes con saldo pendiente."""

    # Parse dates if provided (ISO format: YYYY-MM-DD)
    from datetime import datetime

    df = datetime.fromisoformat(date_from) if date_from else None
    dt = datetime.fromisoformat(date_to) if date_to else None

    return list_accounts_receivable(
        db,
        customer_id=customer_id,
        status=status,
        date_from=df,
        date_to=dt,
        min_balance=min_balance,
        collection_status=collection_status,
    )


@router.get("/{order_id}", response_model=WorkOrderOut)
def get_one(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return _attach_payment_totals(db, order)


@router.patch("/{order_id}", response_model=WorkOrderOut)
def update(
    order_id: str,
    payload: WorkOrderUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR)),
):
    order = get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    try:
        order = update_work_order(db, order, payload, actor_user_id=user.id)
        return _attach_payment_totals(db, order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{order_id}/meta-history", response_model=list[WorkOrderMetaHistoryOut])
def meta_history(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return list_meta_history(db, order_id)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR, ROLE_REGISTRADOR)),
):
    order = get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    try:
        delete_work_order(db, order)
        return None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{order_id}/assign", response_model=WorkOrderOut)
def assign(
    order_id: str,
    payload: WorkOrderAssign,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR, ROLE_REGISTRADOR)),
):
    order = get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    try:
        order = assign_work_order(db, order, payload.worker_id)
        return _attach_payment_totals(db, order)    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.delete("/{order_id}/assign", response_model=WorkOrderOut)
def unassign(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR)),
):
    order = get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    order = unassign_work_order(db, order)
    return _attach_payment_totals(db, order)


@router.post("/{order_id}/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def add_payment(
    order_id: str,
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_REGISTRADOR)),
):
    order = get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    try:
        return create_payment(db, order, payload, actor_user_id=user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{order_id}/payments", response_model=list[PaymentOut])
def list_payments(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    return list_payments_for_order(db, order_id)


@router.get("/{order_id}/invoice.pdf")
def invoice_pdf(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    order = _attach_payment_totals(db, order)
    items = list_items(db, order_id)
    payments = list_payments_for_order(db, order_id)

    customer = order.customer if hasattr(order, "customer") else None
    if not customer and order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    customer_name = (customer.name if customer else None) or "—"
    customer_phone = (customer.phone if customer else None) or "—"

    pdf_bytes = _build_invoice_pdf(order, items, payments, customer_name, customer_phone)
    filename = f"factura_orden_{order.order_number or order.id}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
