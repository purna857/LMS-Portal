import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'active', 'suspended', 'inactive')",
            name="users_status_valid",
        ),
    )

    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserRole.user_id",
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    instructor_approval_requests: Mapped[list["InstructorApprovalRequest"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="InstructorApprovalRequest.user_id",
    )
    profile: Mapped["UserProfile"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )


class UserRole(BaseModel):
    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_user_roles_user_id_role_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    user: Mapped["User"] = relationship(back_populates="roles", foreign_keys=[user_id])
    role: Mapped["Role"] = relationship()
