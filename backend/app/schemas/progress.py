from datetime import datetime

from pydantic import BaseModel


class CourseProgressResponse(BaseModel):
    course_id: str
    enrollment_id: str
    total_lessons: int
    completed_lessons: int
    progress_percentage: float
    progress_status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None


class StudentCourseProgressItemResponse(BaseModel):
    student_id: str
    student_name: str
    student_email: str
    enrollment_id: str
    total_lessons: int
    completed_lessons: int
    progress_percentage: float
    progress_status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None


class StudentCourseProgressListResponse(BaseModel):
    items: list[StudentCourseProgressItemResponse]
    total: int


class ProgressSummaryResponse(BaseModel):
    total_courses: int
    completed_courses: int
    in_progress_courses: int
    average_progress_percentage: float


class LessonProgressItemResponse(BaseModel):
    lesson_id: str
    completed_at: datetime | None = None


class CourseLessonProgressResponse(BaseModel):
    course_id: str
    enrollment_id: str
    completed_lesson_ids: list[str]
    completed_module_ids: list[str]
    items: list[LessonProgressItemResponse]
