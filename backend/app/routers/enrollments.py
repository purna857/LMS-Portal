from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.enrollment import (
    EnrolledCoursesListResponse,
    EnrolledStudentsListResponse,
    EnrollmentResponse,
    EnrollmentStatsResponse,
)
from app.services.enrollment_service import EnrollmentService, EnrollmentServiceError


router = APIRouter(prefix="/enrollments", tags=["Enrollments"])


@router.post("/courses/{course_id}", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def enroll_in_course(
    course_id: UUID,
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> EnrollmentResponse:
    service = EnrollmentService(session)
    try:
        return await service.enroll_in_course(course_id, current_user)
    except EnrollmentServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "already enrolled" in detail.lower():
            code = status.HTTP_409_CONFLICT
        elif "published" in detail.lower():
            code = status.HTTP_400_BAD_REQUEST
        else:
            code = status.HTTP_403_FORBIDDEN
        raise HTTPException(status_code=code, detail=detail) from exc


@router.get("/me/courses", response_model=EnrolledCoursesListResponse)
async def list_my_enrolled_courses(
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> EnrolledCoursesListResponse:
    service = EnrollmentService(session)
    try:
        return await service.list_student_enrolled_courses(current_user)
    except EnrollmentServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/courses/{course_id}/students", response_model=EnrolledStudentsListResponse)
async def list_course_students(
    course_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> EnrolledStudentsListResponse:
    service = EnrollmentService(session)
    try:
        return await service.list_course_students(course_id, current_user)
    except EnrollmentServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.get("/stats", response_model=EnrollmentStatsResponse)
async def get_enrollment_stats(
    course_id: UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EnrollmentStatsResponse:
    service = EnrollmentService(session)
    try:
        return await service.get_enrollment_stats(current_user=current_user, course_id=course_id)
    except EnrollmentServiceError as exc:
        detail = str(exc)
        if "required" in detail.lower():
            code = status.HTTP_400_BAD_REQUEST
        elif "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "permission" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
