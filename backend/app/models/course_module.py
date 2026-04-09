import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class CourseModule(BaseModel):
    __tablename__ = "course_modules"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published', 'archived')", name="course_modules_status_valid"),
        CheckConstraint("position > 0", name="course_modules_position_positive"),
        UniqueConstraint("course_id", "position", name="uq_course_modules_course_position"),
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    is_preview: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    course: Mapped["Course"] = relationship(back_populates="modules")
    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="Lesson.position",
    )
