from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.schemas.common import HealthCheckResponse


router = APIRouter(prefix="/health")


@router.get("", response_model=HealthCheckResponse, summary="Basic service health check")
async def health_check(
    session: AsyncSession = Depends(get_db_session),
) -> HealthCheckResponse:
    try:
        await session.execute(select(1))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable",
        ) from exc

    return HealthCheckResponse(status="ok", service="lms-backend", database="ok")
