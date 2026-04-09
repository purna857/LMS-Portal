from datetime import datetime

from pydantic import BaseModel, Field


class LessonCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    lesson_type: str = Field(pattern="^(video|text|resource_link)$")
    content: str | None = None
    video_url: str | None = None
    resource_url: str | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    position: int | None = Field(default=None, ge=1)
    status: str = Field(default="draft", pattern="^(draft|published|archived)$")
    is_preview: bool = False


class LessonUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    lesson_type: str | None = Field(default=None, pattern="^(video|text|resource_link)$")
    content: str | None = None
    video_url: str | None = None
    resource_url: str | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    position: int | None = Field(default=None, ge=1)
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")
    is_preview: bool | None = None


class LessonResponse(BaseModel):
    id: str
    module_id: str
    title: str
    lesson_type: str
    content: str | None = None
    video_url: str | None = None
    resource_url: str | None = None
    duration_minutes: int | None = None
    position: int
    status: str
    is_preview: bool
    created_at: datetime
    updated_at: datetime


class LessonListResponse(BaseModel):
    items: list[LessonResponse]
    total: int
