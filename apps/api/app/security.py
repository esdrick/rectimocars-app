from __future__ import annotations

import os
import hashlib
import hmac
import base64

# Parámetros de seguridad
_ITERATIONS = 260_000
_SALT_SIZE = 16
_HASH_NAME = "sha256"


def hash_password(password: str) -> str:
    salt = os.urandom(_SALT_SIZE)
    dk = hashlib.pbkdf2_hmac(
        _HASH_NAME,
        password.encode(),
        salt,
        _ITERATIONS,
    )
    return base64.b64encode(salt + dk).decode()


def verify_password(password: str, stored_hash: str) -> bool:
    decoded = base64.b64decode(stored_hash.encode())
    salt = decoded[:_SALT_SIZE]
    stored_dk = decoded[_SALT_SIZE:]

    new_dk = hashlib.pbkdf2_hmac(
        _HASH_NAME,
        password.encode(),
        salt,
        _ITERATIONS,
    )
    return hmac.compare_digest(new_dk, stored_dk)

# ----------------------
# JWT helpers
# ----------------------

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.config import settings


def create_access_token(
    subject: str,
    expires_minutes: int | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Create a signed JWT.

    - subject becomes the `sub` claim (we'll store user_id there)
    - includes `exp` expiration
    - you can pass extra claims like role/email
    """
    minutes = expires_minutes if expires_minutes is not None else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)

    payload: dict[str, Any] = {"sub": subject, "exp": expire}
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode/verify a JWT. Raises ValueError if invalid/expired."""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as e:
        raise ValueError("Invalid or expired token") from e