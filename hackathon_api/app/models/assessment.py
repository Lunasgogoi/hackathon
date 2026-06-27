# app/models/assessment.py
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    # An assessment can have multiple coding problems and multiple MCQs
    coding_problems = relationship("CodingProblem", back_populates="assessment", cascade="all, delete-orphan")
    mcq_questions = relationship("MCQQuestion", back_populates="assessment", cascade="all, delete-orphan")
    attempts = relationship("AssessmentAttempt", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"
    __table_args__ = (
        UniqueConstraint("assessment_id", "user_id", name="uq_assessment_attempt_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_score: Mapped[float] = mapped_column(Float, default=0)
    max_score: Mapped[float] = mapped_column(Float, default=0)
    percentage: Mapped[float] = mapped_column(Float, default=0)

    assessment = relationship("Assessment", back_populates="attempts")
    user = relationship("User", back_populates="assessment_attempts")
