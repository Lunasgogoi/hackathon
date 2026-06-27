from pydantic import BaseModel, Field, HttpUrl


class TeamCreate(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    max_members: int = Field(default=4, ge=2, le=6)


class TeamJoin(BaseModel):
    invite_code: str = Field(min_length=4, max_length=24)


class UserProfileUpdate(BaseModel):
    avatar_url: HttpUrl | None = None
    skills: str | None = Field(default=None, max_length=255)
