from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_password_hash, verify_password
from app.models.instructor_approval_request import InstructorApprovalRequest
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.models.user_profile import UserProfile
from app.schemas.admin_user import AdminUserListItem, AdminUserListResponse
from app.schemas.instructor_approval import (
    InstructorApprovalActionResponse,
    InstructorApprovalItem,
    InstructorApprovalListResponse,
    InstructorApprovalReviewRequest,
)
from app.schemas.profile import ChangePasswordRequest, CurrentProfileResponse, UserProfilePayload, UserProfileUpdateRequest
from app.utils.datetime import utc_now


class UserServiceError(Exception):
    pass


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_current_profile(self, user_id: UUID) -> CurrentProfileResponse:
        user = await self._get_user_or_raise(user_id)
        return self._serialize_current_profile(user)

    async def update_current_profile(
        self,
        current_user: User,
        payload: UserProfileUpdateRequest,
    ) -> CurrentProfileResponse:
        user = await self._get_user_or_raise(current_user.id)
        profile = user.profile
        if profile is None:
            profile = UserProfile(user_id=user.id)
            self.session.add(profile)
            await self.session.flush()

        update_data = payload.model_dump(exclude_unset=True)

        for field_name in ("first_name", "last_name", "phone"):
            if field_name in update_data:
                value = update_data.pop(field_name)
                if isinstance(value, str):
                    value = value.strip()
                if field_name in {"first_name", "last_name"} and value == "":
                    raise UserServiceError(f"{field_name.replace('_', ' ').title()} cannot be empty")
                setattr(user, field_name, value)

        for field_name, value in update_data.items():
            setattr(profile, field_name, value)

        await self.session.commit()
        return await self.get_current_profile(user.id)

    async def change_password(
        self,
        current_user: User,
        payload: ChangePasswordRequest,
    ) -> None:
        user = await self._get_user_or_raise(current_user.id)

        if not verify_password(payload.current_password, user.password_hash):
            raise UserServiceError("Current password is incorrect")

        if payload.current_password == payload.new_password:
            raise UserServiceError("New password must be different from the current password")

        user.password_hash = get_password_hash(payload.new_password)
        user.last_password_changed_at = utc_now()

        revoke_statement = select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None),
        )
        refresh_tokens = (await self.session.execute(revoke_statement)).scalars().all()
        for token in refresh_tokens:
            token.revoked_at = utc_now()

        await self.session.commit()

    async def list_users(
        self,
        limit: int,
        offset: int,
        search: str | None,
        status: str | None,
        role: str | None,
    ) -> AdminUserListResponse:
        filters = []
        if search:
            search_term = f"%{search.strip()}%"
            filters.append(
                or_(
                    User.first_name.ilike(search_term),
                    User.last_name.ilike(search_term),
                    User.email.ilike(search_term),
                )
            )
        if status:
            filters.append(User.status == status)
        if role:
            filters.append(User.roles.any(UserRole.role.has(code=role)))

        total_statement = select(func.count(User.id))
        if filters:
            total_statement = total_statement.where(*filters)
        total = (await self.session.execute(total_statement)).scalar_one()

        statement = (
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .order_by(User.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if filters:
            statement = statement.where(*filters)

        users = (await self.session.execute(statement)).scalars().all()
        items = [
            AdminUserListItem(
                id=str(user.id),
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone=user.phone,
                status=user.status,
                email_verified=user.email_verified,
                is_superuser=user.is_superuser,
                roles=[assignment.role.code for assignment in user.roles],
                last_login_at=user.last_login_at,
                created_at=user.created_at,
            )
            for user in users
        ]
        return AdminUserListResponse(items=items, total=total, limit=limit, offset=offset)

    async def update_user_status(self, user_id: UUID, blocked: bool) -> CurrentProfileResponse:
        user = await self._get_user_or_raise(user_id)
        if user.is_superuser:
            raise UserServiceError("Superuser accounts cannot be blocked or unblocked")

        if blocked:
            user.status = "suspended"
        else:
            user.status = await self._resolve_unblocked_status(user)

        if blocked:
            revoke_statement = select(RefreshToken).where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
            )
            refresh_tokens = (await self.session.execute(revoke_statement)).scalars().all()
            for token in refresh_tokens:
                token.revoked_at = utc_now()

        await self.session.commit()
        return self._serialize_current_profile(user)

    async def list_instructor_approval_requests(
        self,
        status: str | None,
    ) -> InstructorApprovalListResponse:
        statement = (
            select(InstructorApprovalRequest)
            .options(selectinload(InstructorApprovalRequest.user))
            .order_by(InstructorApprovalRequest.created_at.desc())
        )
        if status:
            statement = statement.where(InstructorApprovalRequest.status == status)

        requests = (await self.session.execute(statement)).scalars().all()
        items = [
            InstructorApprovalItem(
                request_id=str(item.id),
                user_id=str(item.user.id),
                email=item.user.email,
                first_name=item.user.first_name,
                last_name=item.user.last_name,
                user_status=item.user.status,
                approval_status=item.status,
                headline=item.headline,
                expertise=item.expertise,
                experience_years=item.experience_years,
                linkedin_url=item.linkedin_url,
                portfolio_url=item.portfolio_url,
                resume_file_url=item.resume_file_url,
                submitted_at=item.submitted_at,
                reviewed_at=item.reviewed_at,
                review_notes=item.review_notes,
            )
            for item in requests
        ]
        return InstructorApprovalListResponse(items=items, total=len(items))

    async def approve_instructor_request(
        self,
        request_id: UUID,
        reviewer: User,
        payload: InstructorApprovalReviewRequest,
    ) -> InstructorApprovalActionResponse:
        approval_request = await self._get_approval_request_or_raise(request_id)
        if approval_request.status == "approved":
            raise UserServiceError("Instructor request is already approved")
        if approval_request.status == "rejected":
            raise UserServiceError("Rejected instructor requests cannot be approved directly")
        approval_request.status = "approved"
        approval_request.reviewed_at = utc_now()
        approval_request.reviewed_by = reviewer.id
        approval_request.review_notes = payload.review_notes
        approval_request.user.status = "active"
        await self.session.commit()
        return InstructorApprovalActionResponse(
            message="Instructor approved successfully",
            request_id=str(approval_request.id),
            user_id=str(approval_request.user.id),
            approval_status=approval_request.status,
            user_status=approval_request.user.status,
        )

    async def reject_instructor_request(
        self,
        request_id: UUID,
        reviewer: User,
        payload: InstructorApprovalReviewRequest,
    ) -> InstructorApprovalActionResponse:
        approval_request = await self._get_approval_request_or_raise(request_id)
        if approval_request.status == "rejected":
            raise UserServiceError("Instructor request is already rejected")
        if approval_request.status == "approved":
            raise UserServiceError("Approved instructors cannot be rejected from this endpoint")
        approval_request.status = "rejected"
        approval_request.reviewed_at = utc_now()
        approval_request.reviewed_by = reviewer.id
        approval_request.review_notes = payload.review_notes
        approval_request.user.status = "inactive"
        revoke_statement = select(RefreshToken).where(
            RefreshToken.user_id == approval_request.user.id,
            RefreshToken.revoked_at.is_(None),
        )
        refresh_tokens = (await self.session.execute(revoke_statement)).scalars().all()
        for token in refresh_tokens:
            token.revoked_at = utc_now()
        await self.session.commit()
        return InstructorApprovalActionResponse(
            message="Instructor request rejected",
            request_id=str(approval_request.id),
            user_id=str(approval_request.user.id),
            approval_status=approval_request.status,
            user_status=approval_request.user.status,
        )

    async def _get_user_or_raise(self, user_id: UUID) -> User:
        statement = (
            select(User)
            .options(
                selectinload(User.profile),
                selectinload(User.roles).selectinload(UserRole.role),
            )
            .where(User.id == user_id)
        )
        user = (await self.session.execute(statement)).scalar_one_or_none()
        if user is None:
            raise UserServiceError("User not found")
        return user

    async def _get_approval_request_or_raise(self, request_id: UUID) -> InstructorApprovalRequest:
        statement = (
            select(InstructorApprovalRequest)
            .options(selectinload(InstructorApprovalRequest.user))
            .where(InstructorApprovalRequest.id == request_id)
        )
        approval_request = (await self.session.execute(statement)).scalar_one_or_none()
        if approval_request is None:
            raise UserServiceError("Instructor approval request not found")
        return approval_request

    async def _resolve_unblocked_status(self, user: User) -> str:
        role_codes = {assignment.role.code for assignment in user.roles}
        if "instructor" not in role_codes:
            return "active"

        latest_request = await self._get_latest_instructor_approval_request(user.id)
        if latest_request is None:
            return "pending"
        if latest_request.status == "approved":
            return "active"
        if latest_request.status in {"submitted", "draft", "under_review"}:
            return "pending"

        raise UserServiceError(
            "Rejected instructor accounts cannot be unblocked until a new approval request is approved"
        )

    async def _get_latest_instructor_approval_request(
        self,
        user_id: UUID,
    ) -> InstructorApprovalRequest | None:
        statement = (
            select(InstructorApprovalRequest)
            .where(InstructorApprovalRequest.user_id == user_id)
            .order_by(InstructorApprovalRequest.created_at.desc())
        )
        return (await self.session.execute(statement)).scalars().first()

    def _serialize_current_profile(self, user: User) -> CurrentProfileResponse:
        profile_payload = None
        if user.profile is not None:
            profile_payload = UserProfilePayload.model_validate(user.profile)

        return CurrentProfileResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            status=user.status,
            email_verified=user.email_verified,
            is_superuser=user.is_superuser,
            roles=[assignment.role.code for assignment in user.roles],
            profile=profile_payload,
        )
