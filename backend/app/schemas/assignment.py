from datetime import datetime

from pydantic import BaseModel, Field


class AssignmentCreateRequest(BaseModel):
    module_id: str | None = None
    lesson_id: str | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    instructions: str | None = None
    max_score: float = Field(default=100, ge=0)
    pass_score: float | None = Field(default=None, ge=0)
    due_at: datetime | None = None
    allow_late_submission: bool = False
    status: str = Field(default="draft", pattern="^(draft|published|closed|archived)$")


class AssignmentUpdateRequest(BaseModel):
    module_id: str | None = None
    lesson_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    instructions: str | None = None
    max_score: float | None = Field(default=None, ge=0)
    pass_score: float | None = Field(default=None, ge=0)
    due_at: datetime | None = None
    allow_late_submission: bool | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|closed|archived)$")


class AssignmentSubmitRequest(BaseModel):
    submission_text: str | None = None
    submission_link: str | None = None
    submission_file_url: str | None = None
    submission_file_name: str | None = None
    submission_file_size_bytes: int | None = None


class AssignmentGradeRequest(BaseModel):
    score: float = Field(ge=0)
    feedback: str | None = None


class AssignmentFeedbackRequest(BaseModel):
    feedback: str = Field(min_length=1)


class AssignmentResponse(BaseModel):
    id: str
    course_id: str
    module_id: str | None = None
    lesson_id: str | None = None
    title: str
    description: str | None = None
    instructions: str | None = None
    max_score: float
    pass_score: float | None = None
    due_at: datetime | None = None
    allow_late_submission: bool
    status: str
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


class AssignmentListResponse(BaseModel):
    items: list[AssignmentResponse]
    total: int


class AssignmentSubmissionResponse(BaseModel):
    id: str
    assignment_id: str
    enrollment_id: str
    submission_text: str | None = None
    submission_link: str | None = None
    submission_file_url: str | None = None
    submission_file_name: str | None = None
    submission_file_size_bytes: int | None = None
    status: str
    submitted_at: datetime
    graded_at: datetime | None = None
    graded_by: str | None = None
    score: float | None = None
    feedback: str | None = None
    is_late: bool
    created_at: datetime
    updated_at: datetime


class AssignmentSubmissionListItemResponse(BaseModel):
    submission_id: str
    student_id: str
    student_name: str
    student_email: str
    submission_text: str | None = None
    submission_link: str | None = None
    submission_file_url: str | None = None
    submission_file_name: str | None = None
    submission_file_size_bytes: int | None = None
    feedback: str | None = None
    status: str
    submitted_at: datetime
    graded_at: datetime | None = None
    score: float | None = None
    is_late: bool


class AssignmentSubmissionListResponse(BaseModel):
    items: list[AssignmentSubmissionListItemResponse]
    total: int


class AssignmentUploadResponse(BaseModel):
    file_url: str
    file_name: str
    file_size_bytes: int


class StudentAssignmentRecordResponse(BaseModel):
    submission_id: str
    assignment_id: str
    assignment_title: str
    course_id: str
    course_title: str
    submission_text: str | None = None
    submission_link: str | None = None
    submission_file_url: str | None = None
    submission_file_name: str | None = None
    submission_file_size_bytes: int | None = None
    status: str
    submitted_at: datetime
    graded_at: datetime | None = None
    score: float | None = None
    feedback: str | None = None
    is_late: bool


class StudentAssignmentRecordListResponse(BaseModel):
    items: list[StudentAssignmentRecordResponse]
    total: int


class AdminAssignmentTrackerItemResponse(BaseModel):
    submission_id: str
    assignment_id: str
    assignment_title: str
    course_id: str
    course_title: str
    student_id: str
    student_name: str
    student_email: str
    status: str
    submitted_at: datetime
    graded_at: datetime | None = None
    score: float | None = None
    max_score: float
    feedback: str | None = None
    is_late: bool
    submission_file_url: str | None = None
    submission_file_name: str | None = None


class AdminAssignmentTrackerListResponse(BaseModel):
    items: list[AdminAssignmentTrackerItemResponse]
    total: int
