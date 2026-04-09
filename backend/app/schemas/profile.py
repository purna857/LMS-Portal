from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class UserProfileUpdateRequest(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    avatar_url: str | None = None
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    postal_code: str | None = Field(default=None, max_length=20)
    timezone: str | None = Field(default=None, max_length=100)
    language: str | None = Field(default=None, max_length=20)
    headline: str | None = Field(default=None, max_length=150)
    bio: str | None = None
    website_url: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserProfilePayload(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    avatar_url: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    country: str | None = None
    state: str | None = None
    city: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    postal_code: str | None = None
    timezone: str | None = None
    language: str | None = None
    headline: str | None = None
    bio: str | None = None
    website_url: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CurrentProfileResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone: str | None = None
    status: str
    email_verified: bool
    is_superuser: bool
    roles: list[str]
    profile: UserProfilePayload | None = None
