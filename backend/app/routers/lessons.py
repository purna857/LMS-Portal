from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.lesson import LessonCreateRequest, LessonListResponse, LessonResponse, LessonUpdateRequest
from app.services.lesson_service import LessonService, LessonServiceError


router = APIRouter(tags=["Lessons"])


@router.post(
    "/course-modules/{module_id}/lessons",
    response_model=LessonResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_lesson(
    module_id: UUID,
    payload: LessonCreateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> LessonResponse:
    service = LessonService(session)
    try:
        return await service.create_lesson(module_id, current_user, payload)
    except LessonServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.patch("/lessons/{lesson_id}", response_model=LessonResponse)
async def update_lesson(
    lesson_id: UUID,
    payload: LessonUpdateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> LessonResponse:
    service = LessonService(session)
    try:
        return await service.update_lesson(lesson_id, current_user, payload)
    except LessonServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.delete("/lessons/{lesson_id}", response_model=MessageResponse)
async def delete_lesson(
    lesson_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    service = LessonService(session)
    try:
        await service.delete_lesson(lesson_id, current_user)
    except LessonServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
    return MessageResponse(message="Lesson deleted successfully")


@router.get("/course-modules/{module_id}/lessons", response_model=LessonListResponse)
async def list_lessons_by_module(
    module_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LessonListResponse:
    service = LessonService(session)
    try:
        return await service.list_lessons_by_module(module_id, current_user)
    except LessonServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
