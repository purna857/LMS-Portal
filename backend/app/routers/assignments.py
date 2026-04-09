from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.assignment import (
    AssignmentCreateRequest,
    AssignmentFeedbackRequest,
    AssignmentGradeRequest,
    AssignmentListResponse,
    AssignmentResponse,
    AssignmentUploadResponse,
    AdminAssignmentTrackerListResponse,
    AssignmentSubmissionListResponse,
    AssignmentSubmissionResponse,
    AssignmentSubmitRequest,
    AssignmentUpdateRequest,
    StudentAssignmentRecordListResponse,
)
from app.schemas.common import MessageResponse
from app.services.assignment_service import AssignmentService, AssignmentServiceError


router = APIRouter(tags=["Assignments"])


@router.post(
    "/courses/{course_id}/assignments",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_assignment(
    course_id: UUID,
    payload: AssignmentCreateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> AssignmentResponse:
    service = AssignmentService(session)
    try:
        return await service.create_assignment(course_id, current_user, payload)
    except AssignmentServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else (
            status.HTTP_403_FORBIDDEN if "permission" in detail.lower() else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=detail) from exc


@router.patch("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: UUID,
    payload: AssignmentUpdateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> AssignmentResponse:
    service = AssignmentService(session)
    try:
        return await service.update_assignment(assignment_id, current_user, payload)
    except AssignmentServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else (
            status.HTTP_403_FORBIDDEN if "permission" in detail.lower() else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=detail) from exc


@router.delete("/assignments/{assignment_id}", response_model=MessageResponse)
async def delete_assignment(
    assignment_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    service = AssignmentService(session)
    try:
        await service.delete_assignment(assignment_id, current_user)
    except AssignmentServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else (
            status.HTTP_403_FORBIDDEN if "permission" in detail.lower() else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=detail) from exc
    return MessageResponse(message="Assignment deleted successfully")


@router.get("/courses/{course_id}/assignments", response_model=AssignmentListResponse)
async def list_assignments_by_course(
    course_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AssignmentListResponse:
    service = AssignmentService(session)
    try:
        return await service.list_assignments_by_course(course_id, current_user)
    except AssignmentServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else (
            status.HTTP_403_FORBIDDEN if "permission" in detail.lower() else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=detail) from exc


@router.post("/assignments/{assignment_id}/submit", response_model=AssignmentSubmissionResponse)
async def submit_assignment(
    assignment_id: UUID,
    payload: AssignmentSubmitRequest,
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> AssignmentSubmissionResponse:
    service = AssignmentService(session)
    try:
        return await service.submit_assignment(assignment_id, current_user, payload)
    except AssignmentServiceError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            code = status.HTTP_404_NOT_FOUND
        elif "already been submitted" in detail.lower():
            code = status.HTTP_409_CONFLICT
        elif "only students" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        elif "not enrolled" in detail.lower():
            code = status.HTTP_403_FORBIDDEN
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.post("/assignments/uploads", response_model=AssignmentUploadResponse)
async def upload_assignment_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> AssignmentUploadResponse:
    service = AssignmentService(session)
    try:
        return await service.upload_submission_file(current_user, file)
    except AssignmentServiceError as exc:
        detail = str(exc)
        code = status.HTTP_403_FORBIDDEN if "only students" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.get(
    "/assignments/{assignment_id}/submissions",
    response_model=AssignmentSubmissionListResponse,
)
async def list_assignment_submissions(
    assignment_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> AssignmentSubmissionListResponse:
    service = AssignmentService(session)
    try:
        return await service.list_assignment_submissions(assignment_id, current_user)
    except AssignmentServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else (
            status.HTTP_403_FORBIDDEN if "permission" in detail.lower() else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=detail) from exc


@router.get("/assignments/submissions/me", response_model=StudentAssignmentRecordListResponse)
async def list_my_assignment_submissions(
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> StudentAssignmentRecordListResponse:
    service = AssignmentService(session)
    try:
        return await service.list_student_assignment_records(current_user)
    except AssignmentServiceError as exc:
        detail = str(exc)
        code = status.HTTP_403_FORBIDDEN if "only students" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.post("/assignment-submissions/{submission_id}/grade", response_model=AssignmentSubmissionResponse)
async def grade_submission(
    submission_id: UUID,
    payload: AssignmentGradeRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> AssignmentSubmissionResponse:
    service = AssignmentService(session)
    try:
        return await service.grade_submission(submission_id, current_user, payload)
    except AssignmentServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else (
            status.HTTP_403_FORBIDDEN if "permission" in detail.lower() else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=detail) from exc


@router.post(
    "/assignment-submissions/{submission_id}/feedback",
    response_model=AssignmentSubmissionResponse,
)
async def add_feedback(
    submission_id: UUID,
    payload: AssignmentFeedbackRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> AssignmentSubmissionResponse:
    service = AssignmentService(session)
    try:
        return await service.add_feedback(submission_id, current_user, payload)
    except AssignmentServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else (
            status.HTTP_403_FORBIDDEN if "permission" in detail.lower() else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=detail) from exc


@router.get("/admin/assignment-tracker", response_model=AdminAssignmentTrackerListResponse)
async def list_admin_assignment_tracker(
    current_user: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> AdminAssignmentTrackerListResponse:
    service = AssignmentService(session)
    try:
        return await service.list_admin_assignment_tracker(current_user)
    except AssignmentServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else (
            status.HTTP_403_FORBIDDEN if "permission" in detail.lower() else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=detail) from exc
