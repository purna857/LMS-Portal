from datetime import datetime

from pydantic import BaseModel, Field


class PlatformAnnouncementCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)
    target_roles: list[str] | None = None


class CourseAnnouncementCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)
    include_students: bool = True
    include_instructors: bool = True


class NotificationResponse(BaseModel):
    id: str
    announcement_id: str | None = None
    course_id: str | None = None
    notification_type: str
    title: str
    body: str
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int


class AnnouncementResponse(BaseModel):
    id: str
    announcement_type: str
    course_id: str | None = None
    title: str
    body: str
    target_roles: list[str]
    include_students: bool
    include_instructors: bool
    created_by: str | None = None
    created_at: datetime
