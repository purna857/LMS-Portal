import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class Assignment(BaseModel):
    __tablename__ = "assignments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'published', 'closed', 'archived')",
            name="assignments_status_valid",
        ),
        CheckConstraint("max_score >= 0", name="assignments_max_score_non_negative"),
        CheckConstraint(
            "pass_score IS NULL OR (pass_score >= 0 AND pass_score <= max_score)",
            name="assignments_pass_score_valid",
        ),
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    module_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_modules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_score: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=100)
    pass_score: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    allow_late_submission: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    course: Mapped["Course"] = relationship()
    module: Mapped["CourseModule | None"] = relationship()
    lesson: Mapped["Lesson | None"] = relationship()
    submissions: Mapped[list["AssignmentSubmission"]] = relationship(
        back_populates="assignment",
        cascade="all, delete-orphan",
    )


class AssignmentSubmission(BaseModel):
    __tablename__ = "assignment_submissions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('submitted', 'graded', 'late_submitted', 'returned')",
            name="assignment_submissions_status_valid",
        ),
        CheckConstraint("score IS NULL OR score >= 0", name="assignment_submissions_score_non_negative"),
        UniqueConstraint(
            "assignment_id",
            "enrollment_id",
            name="uq_assignment_submissions_assignment_enrollment",
        ),
    )

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    submission_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    submission_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    submission_file_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    submission_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    submission_file_size_bytes: Mapped[int | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="submitted")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    graded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    score: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_late: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    assignment: Mapped["Assignment"] = relationship(back_populates="submissions")
    enrollment: Mapped["Enrollment"] = relationship()
