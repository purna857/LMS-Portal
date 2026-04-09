from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token, get_token_subject, validate_token_type
from app.db.session import get_db_session
from app.models.user import User
from app.services.auth_service import AuthError, AuthService


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
        )

    try:
        payload = decode_token(credentials.credentials)
        validate_token_type(payload, "access")
        subject = get_token_subject(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    service = AuthService(session)
    try:
        user = await service.get_user_with_roles(subject)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    if not await service.is_login_allowed(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not allowed to access this resource",
        )

    return user


def require_roles(*allowed_roles: str) -> Callable[[User], User]:
    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        role_codes = {user_role.role.code for user_role in current_user.roles}
        if current_user.is_superuser or role_codes.intersection(allowed_roles):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource",
        )

    return dependency
