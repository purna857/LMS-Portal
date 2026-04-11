from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import require_roles
from app.models.user import User
from app.schemas.enrollment import (
    CourseAssignmentRequest,
    CourseEnrollmentRequest,
    EnrolledCoursesListResponse,
    EnrolledStudentsListResponse,
    EnrollmentResponse,
)
from app.services.enrollment_service import EnrollmentService, EnrollmentServiceError


router = APIRouter(tags=["Enrollments"])


def _map_error(detail: str) -> int:
    lowered = detail.lower()
    if "not found" in lowered:
        return status.HTTP_404_NOT_FOUND
    if "already enrolled" in lowered:
        return status.HTTP_409_CONFLICT
    if "published" in lowered:
        return status.HTTP_400_BAD_REQUEST
    if "permission" in lowered or "only admins" in lowered or "only students" in lowered:
        return status.HTTP_403_FORBIDDEN
    return status.HTTP_400_BAD_REQUEST


@router.post("/enroll", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def enroll_in_course(
    payload: CourseEnrollmentRequest,
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> EnrollmentResponse:
    service = EnrollmentService(session)
    try:
        return await service.enroll_in_course(payload.course_id, current_user)
    except EnrollmentServiceError as exc:
        raise HTTPException(status_code=_map_error(str(exc)), detail=str(exc)) from exc


@router.get("/my-courses", response_model=EnrolledCoursesListResponse)
async def list_my_courses(
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> EnrolledCoursesListResponse:
    service = EnrollmentService(session)
    try:
        return await service.list_student_enrolled_courses(current_user)
    except EnrollmentServiceError as exc:
        raise HTTPException(status_code=_map_error(str(exc)), detail=str(exc)) from exc


@router.get("/courses/{course_id}/enrollments", response_model=EnrolledStudentsListResponse)
async def list_course_enrollments(
    course_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> EnrolledStudentsListResponse:
    service = EnrollmentService(session)
    try:
        return await service.list_course_students(course_id, current_user)
    except EnrollmentServiceError as exc:
        raise HTTPException(status_code=_map_error(str(exc)), detail=str(exc)) from exc


@router.post("/assign-course", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_course(
    payload: CourseAssignmentRequest,
    current_user: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> EnrollmentResponse:
    service = EnrollmentService(session)
    try:
        return await service.assign_course_to_student(
            payload.course_id,
            payload.student_id,
            current_user,
        )
    except EnrollmentServiceError as exc:
        raise HTTPException(status_code=_map_error(str(exc)), detail=str(exc)) from exc
