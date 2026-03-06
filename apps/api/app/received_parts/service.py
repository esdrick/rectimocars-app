from sqlalchemy.orm import Session
from app.models import ReceivedPartCatalog
from app.received_parts.schemas import ReceivedPartCreate, ReceivedPartUpdate


def create_received_part(db: Session, data: ReceivedPartCreate) -> ReceivedPartCatalog:
    label = str(data.label).strip()
    if not label:
        raise ValueError("El nombre de la pieza recibida es obligatorio")

    exists = db.query(ReceivedPartCatalog).filter(ReceivedPartCatalog.label == label).first()
    if exists:
        raise ValueError("Ya existe una pieza recibida con ese nombre")

    part = ReceivedPartCatalog(
        label=label,
        active=bool(data.active) if data.active is not None else True,
    )
    db.add(part)
    db.commit()
    db.refresh(part)
    return part


def list_received_parts(db: Session, include_inactive: bool = False) -> list[ReceivedPartCatalog]:
    q = db.query(ReceivedPartCatalog)
    if not include_inactive:
        q = q.filter(ReceivedPartCatalog.active == True)  # noqa: E712
    return q.order_by(ReceivedPartCatalog.label.asc()).all()


def get_received_part(db: Session, part_id: str) -> ReceivedPartCatalog | None:
    return db.query(ReceivedPartCatalog).filter(ReceivedPartCatalog.id == part_id).first()


def update_received_part(db: Session, part: ReceivedPartCatalog, data: ReceivedPartUpdate) -> ReceivedPartCatalog:
    payload = data.model_dump(exclude_unset=True)

    if "label" in payload and payload["label"] is not None:
        label = str(payload["label"]).strip()
        if not label:
            raise ValueError("El nombre de la pieza recibida es obligatorio")

        exists = (
            db.query(ReceivedPartCatalog)
            .filter(ReceivedPartCatalog.label == label, ReceivedPartCatalog.id != part.id)
            .first()
        )
        if exists:
            raise ValueError("Ya existe una pieza recibida con ese nombre")

        part.label = label

    if "active" in payload and payload["active"] is not None:
        part.active = bool(payload["active"])

    db.add(part)
    db.commit()
    db.refresh(part)
    return part
