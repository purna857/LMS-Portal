from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str, role_codes: list[str]) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "roles": role_codes,
        "type": "access",
        "jti": str(uuid4()),
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expires_at


def create_refresh_token(subject: str) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": "refresh",
        "jti": str(uuid4()),
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expires_at


def create_password_reset_token(subject: str) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "type": "password_reset",
        "jti": str(uuid4()),
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expires_at


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc


def validate_token_type(payload: dict[str, Any], expected_type: str) -> None:
    if payload.get("type") != expected_type:
        raise ValueError(f"Invalid {expected_type} token")


def get_token_subject(payload: dict[str, Any]) -> str:
    subject = payload.get("sub")
    if not subject or not isinstance(subject, str):
        raise ValueError("Token subject is missing")
    return subject
