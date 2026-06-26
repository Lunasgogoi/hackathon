# app/models/project.py
from sqlalchemy import String, Text, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class ProjectSubmission(Base):
    __tablename__ = "project_submissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), unique=True)
    
    # Project Details
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    repo_url: Mapped[str] = mapped_column(String(255), nullable=False)
    video_demo_url: Mapped[str] = mapped_column(String(255), nullable=True)
    tech_stack: Mapped[str] = mapped_column(String(255)) # e.g., "React, Node, Postgres"

    # A project can have multiple evaluations from different judges
    evaluations = relationship("RubricEvaluation", back_populates="project", cascade="all, delete-orphan")

class RubricEvaluation(Base):
    __tablename__ = "rubric_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project_submissions.id", ondelete="CASCADE"))
    judge_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    
    # The Rubric (e.g., Scored 1 to 10)
    ui_ux_score: Mapped[float] = mapped_column(Float, nullable=False)
    technical_complexity: Mapped[float] = mapped_column(Float, nullable=False)
    innovation: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Auto-calculated in the backend
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    feedback: Mapped[str] = mapped_column(Text, nullable=True)

    project = relationship("ProjectSubmission", back_populates="evaluations")