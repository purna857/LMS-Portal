import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class InstructorApprovalRequest(BaseModel):
    __tablename__ = "instructor_approval_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')",
            name="instructor_approval_status_valid",
        ),
        CheckConstraint(
            "experience_years IS NULL OR experience_years >= 0",
            name="instructor_approval_experience_years_non_negative",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    headline: Mapped[str | None] = mapped_column(String(150), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    expertise: Mapped[str | None] = mapped_column(Text, nullable=True)
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_file_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="submitted")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(
        back_populates="instructor_approval_requests",
        foreign_keys=[user_id],
    )
