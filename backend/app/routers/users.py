from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import require_roles
from app.models.user import User
from app.schemas.admin_user import AdminUserListResponse
from app.schemas.common import MessageResponse
from app.schemas.instructor_approval import InstructorApprovalReviewRequest
from app.services.user_service import UserService, UserServiceError


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=AdminUserListResponse)
async def list_users(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    role: str | None = Query(default=None),
    _: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> AdminUserListResponse:
    service = UserService(session)
    return await service.list_users(
        limit=limit,
        offset=offset,
        search=search,
        status=status_filter,
        role=role,
    )


@router.post("/{user_id}/block", response_model=MessageResponse)
async def block_user(
    user_id: UUID,
    current_admin: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot block your own account",
        )
    service = UserService(session)
    try:
        await service.update_user_status(user_id=user_id, blocked=True)
    except UserServiceError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return MessageResponse(message="User blocked successfully")


@router.post("/{user_id}/unblock", response_model=MessageResponse)
async def unblock_user(
    user_id: UUID,
    current_admin: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot unblock your own account",
        )
    service = UserService(session)
    try:
        await service.update_user_status(user_id=user_id, blocked=False)
    except UserServiceError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return MessageResponse(message="User unblocked successfully")


@router.post("/{user_id}/approve", response_model=MessageResponse)
async def approve_user(
    user_id: UUID,
    payload: InstructorApprovalReviewRequest,
    current_admin: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot approve your own account",
        )
    service = UserService(session)
    try:
        message = await service.approve_user_account(user_id, current_admin, payload.review_notes)
    except UserServiceError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return MessageResponse(message=message)


@router.post("/{user_id}/reject", response_model=MessageResponse)
async def reject_user(
    user_id: UUID,
    payload: InstructorApprovalReviewRequest,
    current_admin: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot reject your own account",
        )
    service = UserService(session)
    try:
        message = await service.reject_user_account(user_id, current_admin, payload.review_notes)
    except UserServiceError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return MessageResponse(message=message)


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: UUID,
    current_admin: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )
    service = UserService(session)
    try:
        message = await service.delete_user_account(user_id, current_admin)
    except UserServiceError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return MessageResponse(message=message)
