from sqlalchemy.orm import Session
from app.models import Worker
from app.workers.schemas import WorkerCreate

def create_worker(db: Session, payload: WorkerCreate) -> Worker:
    worker = Worker(
        name=payload.name,
        phone=payload.phone,
        job_role=payload.job_role,
        active=True,
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker

def list_workers(db: Session) -> list[Worker]:
    return db.query(Worker).order_by(Worker.created_at.desc()).all()