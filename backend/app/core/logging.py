import logging

import structlog

from app.core.config import settings


def configure_logging() -> None:
    timestamper = structlog.processors.TimeStamper(fmt="iso")

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            timestamper,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.LOG_LEVEL.upper())
        ),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(level=settings.LOG_LEVEL.upper())
