# app/schemas/project.py
from pydantic import BaseModel, Field, HttpUrl

class ProjectCreate(BaseModel):
    title: str
    description: str
    repo_url: HttpUrl
    video_demo_url: HttpUrl | None = None
    tech_stack: str
    asset_url: HttpUrl | None = None # NEW: Accept from React payload

class RubricSubmit(BaseModel):
    project_id: int
    ui_ux_score: float = Field(..., ge=1, le=10)
    technical_complexity: float = Field(..., ge=1, le=10)
    innovation: float = Field(..., ge=1, le=10)
    feedback: str | None = None
