from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from app.models import User, WorkOrderMetaHistory
from sqlalchemy.orm import Session


def _json_safe(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value


def add_work_order_history(
    db: Session,
    order_id: str,
    changes: dict | None,
    actor_user_id: str | None = None,
) -> None:
    if not changes:
        return

    actor_label = "unknown"
    if actor_user_id:
        user = db.get(User, actor_user_id)
        actor_label = user.email if user and user.email else str(actor_user_id)

    history = WorkOrderMetaHistory(
        work_order_id=order_id,
        changed_by=actor_label,
        changes_json=_json_safe(changes),
    )
    db.add(history)
