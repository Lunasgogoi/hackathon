# app/models/assessment.py
from sqlalchemy import String, Text
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