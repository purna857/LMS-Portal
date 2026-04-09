from sqlalchemy.ext.asyncio import AsyncSession

from app.seed.admin_user import seed_admin_user
from app.seed.demo_data import seed_demo_data
from app.seed.roles import seed_roles


async def run_seed(session: AsyncSession) -> None:
    await seed_roles(session)
    await seed_admin_user(session)
    await seed_demo_data(session)
    await session.commit()
