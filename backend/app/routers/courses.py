from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.course import (
    CourseCreateRequest,
    CourseDetailResponse,
    CourseListResponse,
    CoursePublishActionResponse,
    CourseUpdateRequest,
)
from app.services.course_service import CourseService, CourseServiceError


router = APIRouter(prefix="/courses", tags=["Courses"])


@router.post("", response_model=CourseDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreateRequest,
    current_user: User = Depends(require_roles("instructor")),
    session: AsyncSession = Depends(get_db_session),
) -> CourseDetailResponse:
    service = CourseService(session)
    try:
        return await service.create_course(current_user, payload)
    except CourseServiceError as exc:
        detail = str(exc)
        status_code = status.HTTP_409_CONFLICT if "already exists" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.patch("/{course_id}", response_model=CourseDetailResponse)
async def update_course(
    course_id: UUID,
    payload: CourseUpdateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> CourseDetailResponse:
    service = CourseService(session)
    try:
        return await service.update_course(course_id, current_user, payload)
    except CourseServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        elif "already exists" in detail.lower():
            code = status.HTTP_409_CONFLICT
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.delete("/{course_id}", response_model=MessageResponse)
async def delete_course(
    course_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    service = CourseService(session)
    try:
        await service.delete_course(course_id, current_user)
    except CourseServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_403_FORBIDDEN
        raise HTTPException(status_code=code, detail=detail) from exc
    return MessageResponse(message="Course deleted successfully")


@router.post("/{course_id}/publish", response_model=CoursePublishActionResponse)
async def publish_course(
    course_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> CoursePublishActionResponse:
    service = CourseService(session)
    try:
        return await service.publish_course(course_id, current_user)
    except CourseServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_403_FORBIDDEN
        raise HTTPException(status_code=code, detail=detail) from exc


@router.post("/{course_id}/unpublish", response_model=CoursePublishActionResponse)
async def unpublish_course(
    course_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> CoursePublishActionResponse:
    service = CourseService(session)
    try:
        return await service.unpublish_course(course_id, current_user)
    except CourseServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_403_FORBIDDEN
        raise HTTPException(status_code=code, detail=detail) from exc


@router.get("", response_model=CourseListResponse)
async def list_courses(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None),
    category_id: str | None = Query(default=None),
    level: str | None = Query(default=None),
    language: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CourseListResponse:
    service = CourseService(session)
    try:
        return await service.list_courses(
            current_user=current_user,
            limit=limit,
            offset=offset,
            search=search,
            category_id=category_id,
            level=level,
            language=language,
            status=status_filter,
        )
    except CourseServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/mine", response_model=CourseListResponse)
async def list_instructor_courses(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_roles("instructor")),
    session: AsyncSession = Depends(get_db_session),
) -> CourseListResponse:
    service = CourseService(session)
    try:
        return await service.list_instructor_courses(current_user, limit, offset, status_filter)
    except CourseServiceError as exc:
        detail = str(exc)
        code = status.HTTP_403_FORBIDDEN if "only instructors" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.get("/{course_id}", response_model=CourseDetailResponse)
async def get_course_detail(
    course_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CourseDetailResponse:
    service = CourseService(session)
    try:
        return await service.get_course_detail(course_id, current_user)
    except CourseServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
