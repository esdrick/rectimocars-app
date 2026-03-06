from sqlalchemy.orm import Session
from app.models import EngineModel
from app.engine_models.schemas import EngineModelCreate, EngineModelUpdate


def create_engine_model(db: Session, data: EngineModelCreate) -> EngineModel:
    label = str(data.label).strip()
    if not label:
        raise ValueError("El nombre del tipo de motor es obligatorio")

    exists = db.query(EngineModel).filter(EngineModel.label == label).first()
    if exists:
        raise ValueError("Ya existe un tipo de motor con ese nombre")

    model = EngineModel(
        label=label,
        active=bool(data.active) if data.active is not None else True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


def list_engine_models(db: Session, include_inactive: bool = False) -> list[EngineModel]:
    q = db.query(EngineModel)
    if not include_inactive:
        q = q.filter(EngineModel.active == True)  # noqa: E712
    return q.order_by(EngineModel.label.asc()).all()


def get_engine_model(db: Session, engine_model_id: str) -> EngineModel | None:
    return db.query(EngineModel).filter(EngineModel.id == engine_model_id).first()


def update_engine_model(db: Session, model: EngineModel, data: EngineModelUpdate) -> EngineModel:
    payload = data.model_dump(exclude_unset=True)

    if "label" in payload and payload["label"] is not None:
        label = str(payload["label"]).strip()
        if not label:
            raise ValueError("El nombre del tipo de motor es obligatorio")

        exists = (
            db.query(EngineModel)
            .filter(EngineModel.label == label, EngineModel.id != model.id)
            .first()
        )
        if exists:
            raise ValueError("Ya existe un tipo de motor con ese nombre")

        model.label = label

    if "active" in payload and payload["active"] is not None:
        model.active = bool(payload["active"])

    db.add(model)
    db.commit()
    db.refresh(model)
    return model
