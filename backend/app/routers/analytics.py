from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import require_roles
from app.models.user import User
from app.schemas.analytics import (
    AdminDashboardStatsResponse,
    InstructorDashboardStatsResponse,
    StudentDashboardStatsResponse,
)
from app.services.analytics_service import AnalyticsService, AnalyticsServiceError


router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _map_analytics_error(detail: str) -> int:
    if "permission" in detail.lower() or "only students" in detail.lower():
        return status.HTTP_403_FORBIDDEN
    return status.HTTP_400_BAD_REQUEST


@router.get("/admin/dashboard", response_model=AdminDashboardStatsResponse)
async def get_admin_dashboard_stats(
    current_user: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> AdminDashboardStatsResponse:
    service = AnalyticsService(session)
    try:
        return await service.get_admin_dashboard_stats(current_user)
    except AnalyticsServiceError as exc:
        raise HTTPException(status_code=_map_analytics_error(str(exc)), detail=str(exc)) from exc


@router.get("/instructor/dashboard", response_model=InstructorDashboardStatsResponse)
async def get_instructor_dashboard_stats(
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> InstructorDashboardStatsResponse:
    service = AnalyticsService(session)
    try:
        return await service.get_instructor_dashboard_stats(current_user)
    except AnalyticsServiceError as exc:
        raise HTTPException(status_code=_map_analytics_error(str(exc)), detail=str(exc)) from exc


@router.get("/student/dashboard", response_model=StudentDashboardStatsResponse)
async def get_student_dashboard_stats(
    current_user: User = Depends(require_roles("student")),
    session: AsyncSession = Depends(get_db_session),
) -> StudentDashboardStatsResponse:
    service = AnalyticsService(session)
    try:
        return await service.get_student_dashboard_stats(current_user)
    except AnalyticsServiceError as exc:
        raise HTTPException(status_code=_map_analytics_error(str(exc)), detail=str(exc)) from exc
