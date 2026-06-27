# app/models/mcq.py
from sqlalchemy import String, Text, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class MCQQuestion(Base):
    __tablename__ = "mcq_questions"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # NEW: Link to the Assessment Parent
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"))
    
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[str] = mapped_column(Text, nullable=False) 
    correct_option: Mapped[str] = mapped_column(String(1), nullable=False)

    assessment = relationship("Assessment", back_populates="mcq_questions")
    submissions = relationship("MCQSubmission", back_populates="question", cascade="all, delete-orphan")


# NEW: The Submission Tracker
class MCQSubmission(Base):
    __tablename__ = "mcq_submissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    question_id: Mapped[int] = mapped_column(ForeignKey("mcq_questions.id", ondelete="CASCADE"))
    
    selected_option: Mapped[str] = mapped_column(String(1), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)

    user = relationship("User", back_populates="mcq_submissions")
    question = relationship("MCQQuestion", back_populates="submissions")