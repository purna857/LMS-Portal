from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    AuthenticatedUserResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutRequest,
    LogoutResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    SignupInstructorRequest,
    SignupResponse,
    SignupStudentRequest,
    TokenPairResponse,
)
from app.services.auth_service import AuthError, AuthService


router = APIRouter(prefix="/auth", tags=["Authentication"])


def _client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if settings.TRUST_PROXY_HEADERS and forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


def _serialize_user(user: User) -> AuthenticatedUserResponse:
    return AuthenticatedUserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        status=user.status,
        is_superuser=user.is_superuser,
        roles=[assignment.role.code for assignment in user.roles],
    )


@router.post("/signup/student", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_student(
    payload: SignupStudentRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SignupResponse:
    service = AuthService(session)
    try:
        user = await service.signup_student(payload)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return SignupResponse(
        message="Student account created successfully",
        user_id=str(user.id),
        account_status=user.status,
    )


@router.post(
    "/signup/instructor",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def signup_instructor(
    payload: SignupInstructorRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SignupResponse:
    service = AuthService(session)
    try:
        user = await service.signup_instructor(payload)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return SignupResponse(
        message="Instructor registration submitted for admin approval",
        user_id=str(user.id),
        account_status=user.status,
        approval_status="submitted",
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> AuthResponse:
    service = AuthService(session)
    try:
        user, tokens = await service.login(
            payload=payload,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except AuthError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_403_FORBIDDEN
            if detail in {"Account is not active", "Instructor account is pending admin approval"}
            else status.HTTP_401_UNAUTHORIZED
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc

    return AuthResponse(
        user=_serialize_user(user),
        tokens=TokenPairResponse(
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            access_token_expires_at=tokens.access_token_expires_at,
            refresh_token_expires_at=tokens.refresh_token_expires_at,
        ),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
) -> ForgotPasswordResponse:
    service = AuthService(session)
    return await service.request_password_reset(payload.email)


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
) -> ResetPasswordResponse:
    service = AuthService(session)
    try:
        return await service.reset_password(payload.token, payload.new_password)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    payload: LogoutRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LogoutResponse:
    service = AuthService(session)
    try:
        await service.logout(
            refresh_token=payload.refresh_token,
            current_user=current_user,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return LogoutResponse(message="Logout successful")


@router.get("/me", response_model=AuthenticatedUserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> AuthenticatedUserResponse:
    return _serialize_user(current_user)
