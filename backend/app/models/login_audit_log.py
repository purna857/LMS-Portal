import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class LoginAuditLog(BaseModel):
    __tablename__ = "login_audit_logs"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('login', 'logout', 'refresh', 'password_reset_request', 'password_reset')",
            name="login_audit_event_type_valid",
        ),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
