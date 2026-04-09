from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.quiz import (
    QuizAttemptHistoryResponse,
    QuizAttemptResultResponse,
    QuizAttemptSubmitRequest,
    QuizCreateRequest,
    QuizDetailResponse,
    QuizListResponse,
    QuizQuestionCreateRequest,
    QuizQuestionResponse,
    QuizQuestionUpdateRequest,
    QuizUpdateRequest,
)
from app.services.quiz_service import QuizService, QuizServiceError


router = APIRouter(tags=["Quizzes"])


def _map_quiz_error(detail: str) -> int:
    lowered = detail.lower()
    if "not found" in lowered:
        return status.HTTP_404_NOT_FOUND
    if "permission" in lowered or "only students" in lowered or "not enrolled" in lowered:
        return status.HTTP_403_FORBIDDEN
    if "maximum quiz attempts reached" in lowered:
        return status.HTTP_409_CONFLICT
    return status.HTTP_400_BAD_REQUEST


@router.post("/courses/{course_id}/quizzes", response_model=QuizDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_quiz(
    course_id: UUID,
    payload: QuizCreateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> QuizDetailResponse:
    service = QuizService(session)
    try:
        return await service.create_quiz(course_id, current_user, payload)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc


@router.patch("/quizzes/{quiz_id}", response_model=QuizDetailResponse)
async def update_quiz(
    quiz_id: UUID,
    payload: QuizUpdateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> QuizDetailResponse:
    service = QuizService(session)
    try:
        return await service.update_quiz(quiz_id, current_user, payload)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc


@router.delete("/quizzes/{quiz_id}", response_model=MessageResponse)
async def delete_quiz(
    quiz_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    service = QuizService(session)
    try:
        await service.delete_quiz(quiz_id, current_user)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc
    return MessageResponse(message="Quiz deleted successfully")


@router.post("/quizzes/{quiz_id}/questions", response_model=QuizQuestionResponse, status_code=status.HTTP_201_CREATED)
async def add_question(
    quiz_id: UUID,
    payload: QuizQuestionCreateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> QuizQuestionResponse:
    service = QuizService(session)
    try:
        return await service.add_question(quiz_id, current_user, payload)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc


@router.patch("/quiz-questions/{question_id}", response_model=QuizQuestionResponse)
async def update_question(
    question_id: UUID,
    payload: QuizQuestionUpdateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> QuizQuestionResponse:
    service = QuizService(session)
    try:
        return await service.update_question(question_id, current_user, payload)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc


@router.delete("/quiz-questions/{question_id}", response_model=MessageResponse)
async def delete_question(
    question_id: UUID,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    service = QuizService(session)
    try:
        await service.delete_question(question_id, current_user)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc
    return MessageResponse(message="Quiz question deleted successfully")


@router.get("/courses/{course_id}/quizzes", response_model=QuizListResponse)
async def list_quizzes_by_course(
    course_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> QuizListResponse:
    service = QuizService(session)
    try:
        return await service.list_quizzes_by_course(course_id, current_user)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc


@router.get("/quizzes/{quiz_id}", response_model=QuizDetailResponse)
async def get_quiz_detail(
    quiz_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> QuizDetailResponse:
    service = QuizService(session)
    try:
        return await service.get_quiz_detail(quiz_id, current_user)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc


@router.post("/quizzes/{quiz_id}/attempts", response_model=QuizAttemptResultResponse)
async def submit_quiz_attempt(
    quiz_id: UUID,
    payload: QuizAttemptSubmitRequest,
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> QuizAttemptResultResponse:
    service = QuizService(session)
    try:
        return await service.submit_quiz_attempt(quiz_id, current_user, payload)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc


@router.get("/quizzes/{quiz_id}/attempts/me", response_model=QuizAttemptHistoryResponse)
async def get_attempt_history(
    quiz_id: UUID,
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> QuizAttemptHistoryResponse:
    service = QuizService(session)
    try:
        return await service.get_attempt_history(quiz_id, current_user)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc


@router.get("/quiz-attempts/{attempt_id}/result", response_model=QuizAttemptResultResponse)
async def get_attempt_result(
    attempt_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> QuizAttemptResultResponse:
    service = QuizService(session)
    try:
        return await service.get_attempt_result(attempt_id, current_user)
    except QuizServiceError as exc:
        raise HTTPException(status_code=_map_quiz_error(str(exc)), detail=str(exc)) from exc
