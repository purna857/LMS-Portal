from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import settings
from app.db.init_db import ensure_runtime_schema
from app.core.logging import configure_logging
from app.middleware.cors import setup_cors


def create_app() -> FastAPI:
    configure_logging()

    application = FastAPI(
        title=settings.APP_NAME,
        debug=settings.APP_DEBUG,
        version="1.0.0",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url="/docs" if settings.APP_DEBUG else None,
        redoc_url="/redoc" if settings.APP_DEBUG else None,
    )

    setup_cors(application)
    uploads_root = Path(__file__).resolve().parents[1] / "uploads"
    uploads_root.mkdir(parents=True, exist_ok=True)
    application.mount("/uploads", StaticFiles(directory=uploads_root), name="uploads")
    application.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @application.on_event("startup")
    async def _ensure_runtime_schema() -> None:
        await ensure_runtime_schema()

    return application


app = create_app()
