from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CourseEnrollmentRequest(BaseModel):
    course_id: UUID


class CourseAssignmentRequest(BaseModel):
    course_id: UUID
    student_id: UUID


class EnrollmentResponse(BaseModel):
    id: str
    user_id: str
    course_id: str
    status: str
    enrolled_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    progress: float | None = None
    created_at: datetime
    updated_at: datetime


class EnrolledCourseItemResponse(BaseModel):
    enrollment_id: str
    course_id: str
    title: str
    slug: str
    short_description: str | None = None
    thumbnail_url: str | None = None
    status: str
    enrolled_at: datetime | None = None
    published_at: datetime | None = None
    primary_instructor_name: str | None = None
    progress: float | None = None


class StudentEnrollmentItemResponse(BaseModel):
    enrollment_id: str
    student_id: str
    student_name: str
    student_email: str
    status: str
    enrolled_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    progress: float | None = None


class EnrolledCoursesListResponse(BaseModel):
    items: list[EnrolledCourseItemResponse]
    total: int


class EnrolledStudentsListResponse(BaseModel):
    items: list[StudentEnrollmentItemResponse]
    total: int


class EnrollmentStatsResponse(BaseModel):
    total_enrollments: int
    active_enrollments: int
    completed_enrollments: int
    dropped_enrollments: int
    suspended_enrollments: int
