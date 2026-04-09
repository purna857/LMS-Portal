from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.role import Role
from app.models.user import User, UserRole


async def seed_admin_user(session: AsyncSession) -> None:
    statement = select(User).where(User.email == settings.ADMIN_EMAIL.lower())
    existing_admin = (await session.execute(statement)).scalar_one_or_none()
    if existing_admin is not None:
        return

    admin_role = (await session.execute(select(Role).where(Role.code == "admin"))).scalar_one()

    admin_user = User(
        email=settings.ADMIN_EMAIL.lower(),
        password_hash=get_password_hash(settings.ADMIN_PASSWORD),
        first_name=settings.ADMIN_FIRST_NAME,
        last_name=settings.ADMIN_LAST_NAME,
        status="active",
        email_verified=True,
        is_superuser=True,
    )
    session.add(admin_user)
    await session.flush()

    session.add(
        UserRole(
            user_id=admin_user.id,
            role_id=admin_role.id,
            assigned_by=admin_user.id,
        )
    )
    await session.flush()
