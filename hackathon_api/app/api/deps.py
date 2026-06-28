from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db # if defined elsewhere
from app.core.config import settings
from app.models.system import SystemState
from app.models.user import User

from fastapi.security import OAuth2PasswordBearer
from app.models.user import RoleEnum

DEFAULT_PHASE_STATUSES = {
    "registration": "active",
    "round1": "locked",
    "round2": "locked",
    "finale": "locked",
}

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception

    except JWTError as e:
        print("JWT ERROR:", e)   # Temporary debug
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id == int(user_id))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_phase_status(db: AsyncSession, phase_name: str) -> str:
    phase = (await db.execute(
        select(SystemState).where(SystemState.phase_name == phase_name)
    )).scalar_one_or_none()

    if phase:
        return phase.status

    return DEFAULT_PHASE_STATUSES.get(phase_name, "locked")


async def ensure_phase_active(
    db: AsyncSession,
    phase_name: str,
    detail: str | None = None,
) -> None:
    status_value = await get_phase_status(db, phase_name)

    if status_value != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail or f"{phase_name} is not active.",
        )

async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != RoleEnum.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )
    return current_user


async def get_current_master_admin(
    current_user: User = Depends(get_current_admin),
) -> User:
    if not current_user.is_master_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the master admin can manage admin and judge accounts.",
        )
    return current_user

