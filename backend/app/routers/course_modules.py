from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.course import (
    CourseModuleCreateRequest,
    CourseModuleListResponse,
    CourseModuleResponse,
    CourseModuleUpdateRequest,
)
from app.services.course_module_service import CourseModuleService, CourseModuleServiceError


router = APIRouter(tags=["Course Modules"])


@router.post(
    "/courses/{course_id}/modules",
    response_model=CourseModuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_module(
    course_id: UUID,
    payload: CourseModuleCreateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> CourseModuleResponse:
    service = CourseModuleService(session)
    try:
        return await service.create_module(course_id, current_user, payload)
    except CourseModuleServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.patch("/course-modules/{module_id}", response_model=CourseModuleResponse)
async def update_module(
    module_id: UUID,
    payload: CourseModuleUpdateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> CourseModuleResponse:
    service = CourseModuleService(session)
    try:
        return await service.update_module(module_id, current_user, payload)
    except CourseModuleServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.delete("/course-modules/{module_id}", response_model=MessageResponse)
async def delete_module(
    module_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    service = CourseModuleService(session)
    try:
        await service.delete_module(module_id, current_user)
    except CourseModuleServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
    return MessageResponse(message="Course module deleted successfully")


@router.get("/courses/{course_id}/modules", response_model=CourseModuleListResponse)
async def list_modules_by_course(
    course_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CourseModuleListResponse:
    service = CourseModuleService(session)
    try:
        return await service.list_modules_by_course(course_id, current_user)
    except CourseModuleServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
