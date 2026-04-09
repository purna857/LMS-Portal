from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import require_roles
from app.models.user import User
from app.schemas.instructor_approval import (
    InstructorApprovalActionResponse,
    InstructorApprovalListResponse,
    InstructorApprovalReviewRequest,
)
from app.services.user_service import UserService, UserServiceError


router = APIRouter(prefix="/instructor-approvals", tags=["Instructor Approvals"])


@router.get("", response_model=InstructorApprovalListResponse)
async def list_instructor_approval_requests(
    status_filter: str | None = Query(default=None, alias="status"),
    _: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> InstructorApprovalListResponse:
    service = UserService(session)
    return await service.list_instructor_approval_requests(status=status_filter)


@router.post("/{request_id}/approve", response_model=InstructorApprovalActionResponse)
async def approve_instructor_request(
    request_id: UUID,
    payload: InstructorApprovalReviewRequest,
    current_admin: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> InstructorApprovalActionResponse:
    service = UserService(session)
    try:
        return await service.approve_instructor_request(request_id, current_admin, payload)
    except UserServiceError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/{request_id}/reject", response_model=InstructorApprovalActionResponse)
async def reject_instructor_request(
    request_id: UUID,
    payload: InstructorApprovalReviewRequest,
    current_admin: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> InstructorApprovalActionResponse:
    service = UserService(session)
    try:
        return await service.reject_instructor_request(request_id, current_admin, payload)
    except UserServiceError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
