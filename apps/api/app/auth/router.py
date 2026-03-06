from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import User
from app.security import (
    verify_password,
    create_access_token,
    decode_access_token,
)
from app.auth.schemas import LoginRequest, TokenResponse

router = APIRouter()
bearer = HTTPBearer()

# ---------- LOGIN ----------
@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == payload.email).first()

        if not user or not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )

        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )

        token = create_access_token(
            subject=user.id,
            extra_claims={
                "email": user.email,
                "role": user.role,
            },
        )

        return TokenResponse(access_token=token)
    finally:
        db.close()


from app.auth.deps import get_current_user
from app.auth.permissions import require_roles
from app.constants import ROLE_ADMIN, ROLE_EDITOR, ROLE_REGISTRADOR


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
    }


@router.get("/only-admin")
def only_admin(user: User = Depends(require_roles(ROLE_ADMIN))):
    return {"ok": True, "role": user.role}


@router.get("/admin-or-editor")
def admin_or_editor(user: User = Depends(require_roles(ROLE_ADMIN, ROLE_EDITOR))):
    return {"ok": True, "role": user.role}


@router.get("/only-registrador")
def only_registrador(user: User = Depends(require_roles(ROLE_REGISTRADOR))):
    return {"ok": True, "role": user.role}