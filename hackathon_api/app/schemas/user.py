# app/schemas/user.py
from pydantic import BaseModel, EmailStr
from app.models.user import RoleEnum

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.participant # Defaults to participant