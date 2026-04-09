from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.profile import ChangePasswordRequest, CurrentProfileResponse, UserProfileUpdateRequest
from app.services.user_service import UserService, UserServiceError


router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("/me", response_model=CurrentProfileResponse)
async def get_current_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CurrentProfileResponse:
    service = UserService(session)
    return await service.get_current_profile(current_user.id)


@router.patch("/me", response_model=CurrentProfileResponse)
async def update_current_profile(
    payload: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CurrentProfileResponse:
    service = UserService(session)
    try:
        return await service.update_current_profile(current_user, payload)
    except UserServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    service = UserService(session)
    try:
        await service.change_password(current_user, payload)
    except UserServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MessageResponse(message="Password changed successfully")
