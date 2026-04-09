from sqlalchemy import Boolean, CheckConstraint, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class Role(BaseModel):
    __tablename__ = "roles"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive')", name="roles_status_valid"),
    )

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
