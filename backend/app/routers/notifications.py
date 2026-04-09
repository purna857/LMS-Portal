from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.notification import (
    AnnouncementResponse,
    CourseAnnouncementCreateRequest,
    NotificationListResponse,
    NotificationResponse,
    PlatformAnnouncementCreateRequest,
)
from app.services.notification_service import NotificationService, NotificationServiceError


router = APIRouter(tags=["Notifications"])


def _map_notification_error(detail: str) -> int:
    lowered = detail.lower()
    if "not found" in lowered:
        return status.HTTP_404_NOT_FOUND
    if "permission" in lowered:
        return status.HTTP_403_FORBIDDEN
    return status.HTTP_400_BAD_REQUEST


@router.post(
    "/announcements/platform",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_platform_announcement(
    payload: PlatformAnnouncementCreateRequest,
    current_user: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> AnnouncementResponse:
    service = NotificationService(session)
    try:
        return await service.create_platform_announcement(current_user, payload)
    except NotificationServiceError as exc:
        raise HTTPException(status_code=_map_notification_error(str(exc)), detail=str(exc)) from exc


@router.post(
    "/courses/{course_id}/announcements",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_course_announcement(
    course_id: UUID,
    payload: CourseAnnouncementCreateRequest,
    current_user: User = Depends(require_roles("instructor", "admin")),
    session: AsyncSession = Depends(get_db_session),
) -> AnnouncementResponse:
    service = NotificationService(session)
    try:
        return await service.create_course_announcement(course_id, current_user, payload)
    except NotificationServiceError as exc:
        raise HTTPException(status_code=_map_notification_error(str(exc)), detail=str(exc)) from exc


@router.get("/notifications/me", response_model=NotificationListResponse)
async def list_my_notifications(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> NotificationListResponse:
    service = NotificationService(session)
    return await service.list_user_notifications(current_user)


@router.post("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> NotificationResponse:
    service = NotificationService(session)
    try:
        return await service.mark_notification_read(notification_id, current_user)
    except NotificationServiceError as exc:
        raise HTTPException(status_code=_map_notification_error(str(exc)), detail=str(exc)) from exc
