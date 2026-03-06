from fastapi import Depends, HTTPException, status

from app.auth.deps import get_current_user
from app.models import User
from app.constants import ALL_ROLES

def require_roles(*allowed: str):
    def _checker(user: User = Depends(get_current_user)) -> User:
        # Validar que los roles usados existen
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