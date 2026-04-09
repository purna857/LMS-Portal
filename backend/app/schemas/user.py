from pydantic import BaseModel, ConfigDict, Field

from app.schemas.role import RoleRead


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    first_name: str
    last_name: str
    status: str
    email_verified: bool
    is_superuser: bool
    roles: list[RoleRead] = Field(default_factory=list)
