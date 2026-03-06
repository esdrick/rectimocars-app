from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import User
from app.security import decode_access_token
from app.constants import ALL_ROLES

bearer = HTTPBearer()


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_token_payload(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    try:
        return decode_access_token(creds.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )


def get_current_user(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> User:
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido (sin sub)",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no existe",
        )

    return user


def require_roles(*allowed: str):
    """Dependency to restrict an endpoint to specific roles."""

    def _checker(user: User = Depends(get_current_user)) -> User:
        # Validate that the declared roles exist
        for r in allowed:
            if r not in ALL_ROLES:
                raise ValueError(f"Rol inválido en require_roles(): {r}")

        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No autorizado. Requiere roles: {list(allowed)}",
            )
        return user

    return _checker