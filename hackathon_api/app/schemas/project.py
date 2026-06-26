# app/schemas/project.py
from pydantic import BaseModel, HttpUrl

class ProjectCreate(BaseModel):
    title: str
    description: str
    repo_url: HttpUrl
    video_demo_url: HttpUrl | None = None
    tech_stack: str

class RubricSubmit(BaseModel):
    project_id: int
    ui_ux_score: float
    technical_complexity: float
    innovation: float
    feedback: str | None = None