from datetime import datetime

from pydantic import BaseModel, Field


class InstructorApprovalReviewRequest(BaseModel):
    review_notes: str | None = None


class InstructorApprovalItem(BaseModel):
    request_id: str
    user_id: str
    email: str
    first_name: str
    last_name: str
    user_status: str
    approval_status: str
    headline: str | None = None
    expertise: str | None = None
    experience_years: int | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    resume_file_url: str | None = None
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    review_notes: str | None = None


class InstructorApprovalListResponse(BaseModel):
    items: list[InstructorApprovalItem]
    total: int


class InstructorApprovalActionResponse(BaseModel):
    message: str
    request_id: str
    user_id: str
    approval_status: str
    user_status: str
