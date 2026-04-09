from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role


DEFAULT_ROLES = [
    {
        "name": "Admin",
        "code": "admin",
        "description": "Full access to LMS administration",
        "is_system": True,
    },
    {
        "name": "Instructor",
        "code": "instructor",
        "description": "Can teach and manage courses after approval",
        "is_system": True,
    },
    {
        "name": "Student",
        "code": "student",
        "description": "Can consume course content and submit work",
        "is_system": True,
    },
]


async def seed_roles(session: AsyncSession) -> None:
    for role_data in DEFAULT_ROLES:
        statement = select(Role).where(Role.code == role_data["code"])
        existing_role = (await session.execute(statement)).scalar_one_or_none()
        if existing_role is None:
            session.add(Role(status="active", **role_data))
    await session.flush()
