import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class Announcement(BaseModel):
    __tablename__ = "announcements"
    __table_args__ = (
        CheckConstraint(
            "announcement_type IN ('platform', 'course')",
            name="announcements_type_valid",
        ),
        CheckConstraint(
            "(announcement_type = 'platform' AND course_id IS NULL) OR "
            "(announcement_type = 'course' AND course_id IS NOT NULL)",
            name="announcements_course_scope_valid",
        ),
    )

    announcement_type: Mapped[str] = mapped_column(String(20), nullable=False)
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    target_roles: Mapped[str | None] = mapped_column(Text, nullable=True)
    include_students: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    include_instructors: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="announcement",
        cascade="all, delete-orphan",
    )


class Notification(BaseModel):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            "notification_type IN ('platform_announcement', 'course_announcement', 'role_notification')",
            name="notifications_type_valid",
        ),
        CheckConstraint(
            "announcement_id IS NOT NULL",
            name="notifications_announcement_required",
        ),
        CheckConstraint(
            "(notification_type = 'course_announcement' AND course_id IS NOT NULL) OR "
            "(notification_type IN ('platform_announcement', 'role_notification') AND course_id IS NULL)",
            name="notifications_course_scope_valid",
        ),
        CheckConstraint(
            "(is_read = false AND read_at IS NULL) OR (is_read = true AND read_at IS NOT NULL)",
            name="notifications_read_state_valid",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    announcement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("announcements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    notification_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    announcement: Mapped["Announcement | None"] = relationship(back_populates="notifications")
