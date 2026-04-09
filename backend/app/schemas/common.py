from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class HealthCheckResponse(APIModel):
    status: str
    service: str
    database: str | None = None


class MessageResponse(APIModel):
    message: str
