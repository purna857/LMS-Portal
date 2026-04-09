from pydantic import BaseModel, ConfigDict


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    status: str
