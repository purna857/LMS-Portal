import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class Lesson(BaseModel):
    __tablename__ = "lessons"
    __table_args__ = (
        CheckConstraint(
            "lesson_type IN ('video', 'text', 'resource_link')",
            name="lessons_type_valid",
        ),
        CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name="lessons_status_valid",
        ),
        CheckConstraint("position > 0", name="lessons_position_positive"),
        CheckConstraint(
            "duration_minutes IS NULL OR duration_minutes >= 0",
            name="lessons_duration_non_negative",
        ),
        UniqueConstraint("module_id", "position", name="uq_lessons_module_position"),
    )

    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_modules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    lesson_type: Mapped[str] = mapped_column(String(30), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    resource_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    is_preview: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    module: Mapped["CourseModule"] = relationship(back_populates="lessons")
