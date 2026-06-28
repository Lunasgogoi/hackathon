from typing import Literal

from pydantic import BaseModel, EmailStr, Field

class PhaseUpdateRequest(BaseModel):
    phase_name: str = Field(..., description="e.g., registration, round1, round2, finale")
    status: str = Field(..., description="e.g., locked, active, completed")
    
class BroadcastRequest(BaseModel):
    message: str = Field(..., description="The message to broadcast to all users")


class PrivilegedUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["admin", "judge"]
