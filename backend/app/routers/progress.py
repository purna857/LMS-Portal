from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.progress import (
    CourseLessonProgressResponse,
    CourseProgressResponse,
    ProgressSummaryResponse,
    StudentCourseProgressListResponse,
)
from app.services.progress_service import ProgressService, ProgressServiceError


router = APIRouter(prefix="/progress", tags=["Progress"])


def _map_progress_error(detail: str) -> int:
    lowered = detail.lower()
    if "not found" in lowered:
        return status.HTTP_404_NOT_FOUND
    if "permission" in lowered or "not enrolled" in lowered or "only students" in lowered:
        return status.HTTP_403_FORBIDDEN
    return status.HTTP_400_BAD_REQUEST


@router.post("/lessons/{lesson_id}/complete", response_model=CourseProgressResponse)
async def complete_lesson(
    lesson_id: UUID,
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> CourseProgressResponse:
    service = ProgressService(session)
    try:
        return await service.complete_lesson(lesson_id, current_user)
    except ProgressServiceError as exc:
        raise HTTPException(status_code=_map_progress_error(str(exc)), detail=str(exc)) from exc


@router.get("/courses/{course_id}/me", response_model=CourseProgressResponse)
async def get_my_course_progress(
    course_id: UUID,
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> CourseProgressResponse:
    service = ProgressService(session)
    try:
        return await service.get_student_course_progress(course_id, current_user)
    except ProgressServiceError as exc:
        raise HTTPException(status_code=_map_progress_error(str(exc)), detail=str(exc)) from exc


@router.get("/courses/{course_id}/lessons/me", response_model=CourseLessonProgressResponse)
async def get_my_course_lesson_progress(
    course_id: UUID,
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> CourseLessonProgressResponse:
    service = ProgressService(session)
    try:
        return await service.get_student_course_lesson_progress(course_id, current_user)
    except ProgressServiceError as exc:
        raise HTTPException(status_code=_map_progress_error(str(exc)), detail=str(exc)) from exc


@router.get("/courses/{course_id}/students", response_model=StudentCourseProgressListResponse)
async def list_course_student_progress(
    course_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> StudentCourseProgressListResponse:
    service = ProgressService(session)
    try:
        return await service.list_course_student_progress(course_id, current_user)
    except ProgressServiceError as exc:
        raise HTTPException(status_code=_map_progress_error(str(exc)), detail=str(exc)) from exc


@router.get("/summary", response_model=ProgressSummaryResponse)
async def get_progress_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProgressSummaryResponse:
    service = ProgressService(session)
    try:
        return await service.get_progress_summary(current_user)
    except ProgressServiceError as exc:
        raise HTTPException(status_code=_map_progress_error(str(exc)), detail=str(exc)) from exc
