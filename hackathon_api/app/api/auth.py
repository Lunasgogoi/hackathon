# app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import UserCreate
from app.models.system import SystemState # NEW: Import SystemState

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    
    # 1. Enforce the Phase Logic: Is Registration Open?
    phase_result = await db.execute(
        select(SystemState).where(SystemState.phase_name == "registration")
    )
    registration_state = phase_result.scalar_one_or_none()

    # If the phase is locked (or doesn't exist yet), block registration
    if not registration_state or registration_state.status != "active":
        raise HTTPException(
            status_code=403, 
            detail="Registration is currently closed."
        )

    # 2. Check for duplicate emails/usernames
    result = await db.execute(
        select(User).where((User.email == user_in.email) | (User.username == user_in.username))
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    # 3. Create the user
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role
    )
    db.add(db_user)
    await db.commit()
    return {"message": f"User {db_user.username} created with role {db_user.role}"}

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}