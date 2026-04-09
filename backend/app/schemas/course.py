from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseCategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=150)
    description: str | None = None
    status: str = Field(default="active", pattern="^(active|inactive)$")
    sort_order: int = Field(default=0, ge=0)
    parent_id: str | None = None


class CourseCategoryUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    status: str | None = Field(default=None, pattern="^(active|inactive)$")
    sort_order: int | None = Field(default=None, ge=0)
    parent_id: str | None = None


class CourseCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    parent_id: str | None = None
    name: str
    slug: str
    description: str | None = None
    status: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class CourseCreateRequest(BaseModel):
    category_id: str | None = None
    title: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255)
    short_description: str | None = Field(default=None, max_length=500)
    description: str | None = None
    thumbnail_url: str | None = None
    level: str = Field(default="beginner", pattern="^(beginner|intermediate|advanced)$")
    language: str = Field(default="en", max_length=20)
    visibility: str = Field(default="public", pattern="^(public|private|restricted)$")
    estimated_duration_minutes: int | None = Field(default=None, ge=0)
    is_featured: bool = False


class CourseUpdateRequest(BaseModel):
    category_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    short_description: str | None = Field(default=None, max_length=500)
    description: str | None = None
    thumbnail_url: str | None = None
    level: str | None = Field(default=None, pattern="^(beginner|intermediate|advanced)$")
    language: str | None = Field(default=None, max_length=20)
    visibility: str | None = Field(default=None, pattern="^(public|private|restricted)$")
    estimated_duration_minutes: int | None = Field(default=None, ge=0)
    is_featured: bool | None = None


class CoursePublishActionResponse(BaseModel):
    message: str
    course_id: str
    status: str


class CourseListItemResponse(BaseModel):
    id: str
    category_id: str | None = None
    category_name: str | None = None
    title: str
    slug: str
    short_description: str | None = None
    level: str
    language: str
    status: str
    visibility: str
    estimated_duration_minutes: int | None = None
    is_featured: bool
    published_at: datetime | None = None
    created_at: datetime
    primary_instructor_id: str | None = None
    primary_instructor_name: str | None = None


class CourseListResponse(BaseModel):
    items: list[CourseListItemResponse]
    total: int
    limit: int
    offset: int


class CourseDetailResponse(BaseModel):
    id: str
    category: CourseCategoryResponse | None = None
    title: str
    slug: str
    short_description: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    level: str
    language: str
    status: str
    visibility: str
    estimated_duration_minutes: int | None = None
    is_featured: bool
    published_at: datetime | None = None
    archived_at: datetime | None = None
    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime
    updated_at: datetime
    instructor_ids: list[str]


class CourseModuleCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    position: int | None = Field(default=None, ge=1)
    status: str = Field(default="draft", pattern="^(draft|published|archived)$")
    is_preview: bool = False


class CourseModuleUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    position: int | None = Field(default=None, ge=1)
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")
    is_preview: bool | None = None


class CourseModuleResponse(BaseModel):
    id: str
    course_id: str
    title: str
    description: str | None = None
    position: int
    status: str
    is_preview: bool
    created_at: datetime
    updated_at: datetime


class CourseModuleListResponse(BaseModel):
    items: list[CourseModuleResponse]
    total: int
