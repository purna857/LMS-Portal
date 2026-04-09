from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.course import (
    CourseCategoryCreateRequest,
    CourseCategoryResponse,
    CourseCategoryUpdateRequest,
)
from app.services.course_service import CourseService, CourseServiceError


router = APIRouter(prefix="/categories", tags=["Course Categories"])


@router.get("", response_model=list[CourseCategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[CourseCategoryResponse]:
    service = CourseService(session)
    active_only = not (current_user.is_superuser or any(role.role.code == "admin" for role in current_user.roles))
    return await service.list_categories(active_only=active_only)


@router.post("", response_model=CourseCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CourseCategoryCreateRequest,
    _: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> CourseCategoryResponse:
    service = CourseService(session)
    try:
        return await service.create_category(payload)
    except CourseServiceError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if "already exists" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.patch("/{category_id}", response_model=CourseCategoryResponse)
async def update_category(
    category_id: UUID,
    payload: CourseCategoryUpdateRequest,
    _: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> CourseCategoryResponse:
    service = CourseService(session)
    try:
        return await service.update_category(category_id, payload)
    except CourseServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else (
            status.HTTP_409_CONFLICT if "already exists" in detail.lower() else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=detail) from exc


@router.delete("/{category_id}", response_model=MessageResponse)
async def delete_category(
    category_id: UUID,
    _: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    service = CourseService(session)
    try:
        await service.delete_category(category_id)
    except CourseServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
    return MessageResponse(message="Category deleted successfully")
