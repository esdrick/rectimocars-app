from sqlalchemy.orm import Session
from app.models import Service
from app.services.schemas import ServiceCreate, ServiceUpdate


def _normalize_option(value: str | None, allowed: set[str], label: str) -> str | None:
    if value is None:
        return None
    s = str(value).strip().upper()
    if s in {"NO APLICA", "NO_APLICA", "N/A", "NA"}:
        s = "NO_APLICA"
    if s not in allowed:
        raise ValueError(f"{label} inválido. Opciones: {', '.join(sorted(allowed))}")
    return s


ALLOWED_CILINDRAJE = {"4", "6", "8", "NO_APLICA"}
ALLOWED_VALVULAS = {"8", "12", "16", "24", "NO_APLICA"}
ALLOWED_SELLOS = {"2", "4", "NO_APLICA"}


def create_service(db: Session, data: ServiceCreate) -> Service:
    # Normalizar parámetros (las variantes se diferencian por este combo)
    cilindraje = _normalize_option(data.cilindraje, ALLOWED_CILINDRAJE, "Cilindraje")
    valvulas = _normalize_option(data.valvulas, ALLOWED_VALVULAS, "Válvulas")
    sellos = _normalize_option(data.sellos, ALLOWED_SELLOS, "Sellos")

    # Validación: no permitir variantes ACTIVAS duplicadas (mismo nombre + mismos parámetros)
    existing = (
        db.query(Service)
        .filter(
            Service.name.ilike(data.name),
            Service.cilindraje == cilindraje,
            Service.valvulas == valvulas,
            Service.sellos == sellos,
            Service.active.is_(True),
        )
        .first()
    )

    if existing:
        raise ValueError("Ya existe una variante activa con ese nombre y esos parámetros")

    service = Service(
        name=data.name,
        description=data.description,
        cilindraje=cilindraje,
        valvulas=valvulas,
        sellos=sellos,
        price_td=data.price_td,
        price_sc=data.price_sc,
        active=data.active,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def list_services(db: Session, only_active: bool = True) -> list[Service]:
    query = db.query(Service)
    if only_active:
        query = query.filter(Service.active.is_(True))
    return query.order_by(Service.created_at.desc()).all()


def get_service(db: Session, service_id: str) -> Service | None:
    return db.query(Service).filter(Service.id == service_id).first()


def update_service(db: Session, service: Service, data: ServiceUpdate) -> Service:
    payload = data.model_dump(exclude_unset=True)
    if "cilindraje" in payload:
        payload["cilindraje"] = _normalize_option(payload.get("cilindraje"), ALLOWED_CILINDRAJE, "Cilindraje")
    if "valvulas" in payload:
        payload["valvulas"] = _normalize_option(payload.get("valvulas"), ALLOWED_VALVULAS, "Válvulas")
    if "sellos" in payload:
        payload["sellos"] = _normalize_option(payload.get("sellos"), ALLOWED_SELLOS, "Sellos")
    for k, v in payload.items():
        setattr(service, k, v)

    # Validación: evitar convertir este servicio en una variante activa duplicada
    if service.active is True:
        dup = (
            db.query(Service)
            .filter(
                Service.id != service.id,
                Service.active.is_(True),
                Service.name.ilike(service.name),
                Service.cilindraje == service.cilindraje,
                Service.valvulas == service.valvulas,
                Service.sellos == service.sellos,
            )
            .first()
        )
        if dup:
            raise ValueError("Ya existe una variante activa con ese nombre y esos parámetros")

    db.commit()
    db.refresh(service)
    return service
