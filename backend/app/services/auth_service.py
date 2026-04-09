from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    get_token_subject,
    validate_token_type,
    verify_password,
)
from app.models.instructor_approval_request import InstructorApprovalRequest
from app.models.login_audit_log import LoginAuditLog
from app.models.refresh_token import RefreshToken
from app.models.role import Role
from app.models.user import User, UserRole
from app.schemas.auth import (
    ForgotPasswordResponse,
    LoginRequest,
    ResetPasswordResponse,
    SignupInstructorRequest,
    SignupStudentRequest,
)
from app.utils.datetime import utc_now
from app.utils.hashing import sha256_digest


class AuthError(Exception):
    pass


@dataclass
class AuthTokens:
    access_token: str
    refresh_token: str
    access_token_expires_at: datetime
    refresh_token_expires_at: datetime


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def signup_student(self, payload: SignupStudentRequest) -> User:
        await self._ensure_email_available(payload.email)
        student_role = await self._get_role_or_raise("student")

        user = User(
            email=payload.email.lower(),
            password_hash=get_password_hash(payload.password),
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            phone=payload.phone,
            status="active",
            email_verified=False,
        )
        self.session.add(user)
        try:
            await self.session.flush()
            self.session.add(UserRole(user_id=user.id, role_id=student_role.id))
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise AuthError("Email is already registered") from exc
        return await self.get_user_with_roles(user.id)

    async def signup_instructor(self, payload: SignupInstructorRequest) -> User:
        await self._ensure_email_available(payload.email)
        instructor_role = await self._get_role_or_raise("instructor")

        user = User(
            email=payload.email.lower(),
            password_hash=get_password_hash(payload.password),
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            phone=payload.phone,
            status="pending",
            email_verified=False,
        )
        self.session.add(user)
        try:
            await self.session.flush()

            self.session.add(UserRole(user_id=user.id, role_id=instructor_role.id))
            self.session.add(
                InstructorApprovalRequest(
                    user_id=user.id,
                    headline=payload.headline,
                    bio=payload.bio,
                    expertise=payload.expertise,
                    experience_years=payload.experience_years,
                    linkedin_url=payload.linkedin_url,
                    portfolio_url=payload.portfolio_url,
                    resume_file_url=payload.resume_file_url,
                    status="submitted",
                    submitted_at=utc_now(),
                )
            )
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise AuthError("Email is already registered") from exc
        return await self.get_user_with_roles(user.id)

    async def login(
        self,
        payload: LoginRequest,
        ip_address: str | None,
        user_agent: str | None,
    ) -> tuple[User, AuthTokens]:
        user = await self.get_user_by_email(payload.email)
        failure_reason: str | None = None

        if user is None or not verify_password(payload.password, user.password_hash):
            failure_reason = "Invalid email or password"
            await self._write_audit_log(
                user=user,
                email=payload.email.lower(),
                event_type="login",
                success=False,
                ip_address=ip_address,
                user_agent=user_agent,
                failure_reason=failure_reason,
            )
            await self.session.commit()
            raise AuthError(failure_reason)

        role_codes = [assignment.role.code for assignment in user.roles]
        if not role_codes:
            failure_reason = "User has no assigned role"
        elif user.status != "active":
            failure_reason = "Account is not active"
        elif "instructor" in role_codes and not await self._is_instructor_approved(user.id):
            failure_reason = "Instructor account is pending admin approval"

        if failure_reason:
            await self._write_audit_log(
                user=user,
                email=user.email,
                event_type="login",
                success=False,
                ip_address=ip_address,
                user_agent=user_agent,
                failure_reason=failure_reason,
            )
            await self.session.commit()
            raise AuthError(failure_reason)

        access_token, access_expires_at = create_access_token(str(user.id), role_codes)
        refresh_token, refresh_expires_at = create_refresh_token(str(user.id))

        self.session.add(
            RefreshToken(
                user_id=user.id,
                token_hash=sha256_digest(refresh_token),
                device_info=user_agent,
                ip_address=ip_address,
                expires_at=refresh_expires_at,
            )
        )
        user.last_login_at = utc_now()

        await self._write_audit_log(
            user=user,
            email=user.email,
            event_type="login",
            success=True,
            ip_address=ip_address,
            user_agent=user_agent,
            failure_reason=None,
        )
        await self.session.commit()

        return user, AuthTokens(
            access_token=access_token,
            refresh_token=refresh_token,
            access_token_expires_at=access_expires_at,
            refresh_token_expires_at=refresh_expires_at,
        )

    async def logout(
        self,
        refresh_token: str,
        current_user: User,
        ip_address: str | None,
        user_agent: str | None,
    ) -> None:
        try:
            payload = decode_token(refresh_token)
            validate_token_type(payload, "refresh")
            subject = get_token_subject(payload)
        except ValueError as exc:
            raise AuthError(str(exc)) from exc

        if str(current_user.id) != subject:
            raise AuthError("Refresh token does not belong to the current user")

        statement = select(RefreshToken).where(
            RefreshToken.token_hash == sha256_digest(refresh_token),
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > utc_now(),
        )
        token_record = (await self.session.execute(statement)).scalar_one_or_none()
        if token_record is not None:
            token_record.revoked_at = utc_now()
        else:
            raise AuthError("Invalid or expired token")

        await self._write_audit_log(
            user=current_user,
            email=current_user.email,
            event_type="logout",
            success=True,
            ip_address=ip_address,
            user_agent=user_agent,
            failure_reason=None,
        )
        await self.session.commit()

    async def request_password_reset(self, email: str) -> ForgotPasswordResponse:
        user = await self.get_user_by_email(email)
        generic_message = "If an account exists for this email, a reset link has been generated"
        if user is None:
            return ForgotPasswordResponse(message=generic_message)

        reset_token, expires_at = create_password_reset_token(str(user.id))
        return ForgotPasswordResponse(
            message=generic_message,
            reset_token=reset_token if not settings.is_production else None,
            expires_at=expires_at if not settings.is_production else None,
        )

    async def reset_password(self, token: str, new_password: str) -> ResetPasswordResponse:
        try:
            payload = decode_token(token)
            validate_token_type(payload, "password_reset")
            subject = get_token_subject(payload)
        except ValueError as exc:
            raise AuthError(str(exc)) from exc

        user = await self.get_user_with_roles(subject)
        if verify_password(new_password, user.password_hash):
            raise AuthError("New password must be different from the current password")
        user.password_hash = get_password_hash(new_password)
        user.last_password_changed_at = utc_now()

        revoke_statement = select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None),
        )
        refresh_tokens = (await self.session.execute(revoke_statement)).scalars().all()
        for refresh_token in refresh_tokens:
            refresh_token.revoked_at = utc_now()

        await self.session.commit()
        return ResetPasswordResponse(message="Password reset successful")

    async def get_user_by_email(self, email: str) -> User | None:
        statement = (
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .where(func.lower(User.email) == email.lower())
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def get_user_with_roles(self, user_id: str | UUID) -> User:
        user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
        statement = (
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .where(User.id == user_uuid)
        )
        user = (await self.session.execute(statement)).scalar_one_or_none()
        if user is None:
            raise AuthError("User not found")
        return user

    async def _ensure_email_available(self, email: str) -> None:
        existing_user = await self.get_user_by_email(email)
        if existing_user is not None:
            raise AuthError("Email is already registered")

    async def _get_role_or_raise(self, code: str) -> Role:
        statement = select(Role).where(Role.code == code, Role.status == "active")
        role = (await self.session.execute(statement)).scalar_one_or_none()
        if role is None:
            raise AuthError(f"Required role '{code}' is not available")
        return role

    async def _is_instructor_approved(self, user_id: object) -> bool:
        statement = (
            select(InstructorApprovalRequest)
            .where(
                InstructorApprovalRequest.user_id == user_id,
                InstructorApprovalRequest.status == "approved",
            )
            .order_by(InstructorApprovalRequest.created_at.desc())
        )
        approval = (await self.session.execute(statement)).scalar_one_or_none()
        return approval is not None

    async def is_login_allowed(self, user: User) -> bool:
        role_codes = [assignment.role.code for assignment in user.roles]
        if not role_codes:
            return False
        if user.status != "active":
            return False
        if "instructor" in role_codes:
            return await self._is_instructor_approved(user.id)
        return True

    async def _write_audit_log(
        self,
        user: User | None,
        email: str,
        event_type: str,
        success: bool,
        ip_address: str | None,
        user_agent: str | None,
        failure_reason: str | None,
    ) -> None:
        self.session.add(
            LoginAuditLog(
                user_id=user.id if user else None,
                email=email,
                event_type=event_type,
                ip_address=ip_address,
                user_agent=user_agent,
                success=success,
                failure_reason=failure_reason,
            )
        )
