import asyncio

from sqlalchemy import select

import app.models  # noqa: F401 - register all SQLAlchemy models for relationships
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.user import RoleEnum, User


async def create_master_admin() -> None:
    if not settings.MASTER_ADMIN_USERNAME or not settings.MASTER_ADMIN_EMAIL or not settings.MASTER_ADMIN_PASSWORD:
        raise RuntimeError(
            "Set MASTER_ADMIN_USERNAME, MASTER_ADMIN_EMAIL, and MASTER_ADMIN_PASSWORD before running this script."
        )

    async with SessionLocal() as db:
        user = (await db.execute(
            select(User).where(User.username == settings.MASTER_ADMIN_USERNAME)
        )).scalar_one_or_none()

        if user:
            user.email = settings.MASTER_ADMIN_EMAIL
            user.hashed_password = get_password_hash(settings.MASTER_ADMIN_PASSWORD)
            user.role = RoleEnum.admin
            user.is_master_admin = True
            action = "Updated"
        else:
            db.add(User(
                username=settings.MASTER_ADMIN_USERNAME,
                email=settings.MASTER_ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.MASTER_ADMIN_PASSWORD),
                role=RoleEnum.admin,
                is_master_admin=True,
            ))
            action = "Created"

        await db.commit()
        print(f"{action} master admin: {settings.MASTER_ADMIN_USERNAME}")


if __name__ == "__main__":
    asyncio.run(create_master_admin())
