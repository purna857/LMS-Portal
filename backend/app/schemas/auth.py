from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SignupStudentRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=20)


class SignupInstructorRequest(SignupStudentRequest):
    headline: str | None = Field(default=None, max_length=150)
    bio: str | None = None
    expertise: str | None = None
    experience_years: int | None = Field(default=None, ge=0)
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    resume_file_url: str | None = None


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20)
    new_password: str = Field(min_length=8, max_length=128)


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    access_token_expires_at: datetime
    refresh_token_expires_at: datetime


class AuthenticatedUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    first_name: str
    last_name: str
    status: str
    is_superuser: bool
    roles: list[str]


class AuthResponse(BaseModel):
    user: AuthenticatedUserResponse
    tokens: TokenPairResponse


class SignupResponse(BaseModel):
    message: str
    user_id: str
    account_status: str
    approval_status: str | None = None


class LogoutResponse(BaseModel):
    message: str


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: str | None = None
    expires_at: datetime | None = None


class ResetPasswordResponse(BaseModel):
    message: str
