from datetime import datetime

from pydantic import BaseModel


class AdminUserListItem(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone: str | None = None
    status: str
    email_verified: bool
    is_superuser: bool
    roles: list[str]
    last_login_at: datetime | None = None
    created_at: datetime


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int
    limit: int
    offset: int
