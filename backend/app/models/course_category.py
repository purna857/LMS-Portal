import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class CourseCategory(BaseModel):
    __tablename__ = "course_categories"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive')", name="course_categories_status_valid"),
        CheckConstraint("sort_order >= 0", name="course_categories_sort_order_non_negative"),
    )

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    parent: Mapped["CourseCategory | None"] = relationship(remote_side="CourseCategory.id")
    courses: Mapped[list["Course"]] = relationship(back_populates="category")
