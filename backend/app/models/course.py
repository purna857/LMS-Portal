import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class Course(BaseModel):
    __tablename__ = "courses"
    __table_args__ = (
        CheckConstraint(
            "level IN ('beginner', 'intermediate', 'advanced')",
            name="courses_level_valid",
        ),
        CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name="courses_status_valid",
        ),
        CheckConstraint(
            "visibility IN ('public', 'private', 'restricted')",
            name="courses_visibility_valid",
        ),
        CheckConstraint(
            "estimated_duration_minutes IS NULL OR estimated_duration_minutes >= 0",
            name="courses_estimated_duration_non_negative",
        ),
    )

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    short_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    level: Mapped[str] = mapped_column(String(20), nullable=False, default="beginner")
    language: Mapped[str] = mapped_column(String(20), nullable=False, default="en")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="public")
    estimated_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    category: Mapped["CourseCategory | None"] = relationship(back_populates="courses")
    modules: Mapped[list["CourseModule"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseModule.position",
    )
    instructors: Mapped[list["CourseInstructor"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
    )


class CourseInstructor(BaseModel):
    __tablename__ = "course_instructors"
    __table_args__ = (
        UniqueConstraint("course_id", "instructor_id", name="uq_course_instructors_course_instructor"),
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    instructor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    course: Mapped["Course"] = relationship(back_populates="instructors")
    instructor: Mapped["User"] = relationship()
