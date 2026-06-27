# app/models/coding.py
import enum
from sqlalchemy import String, Integer, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class SubmissionStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    wrong_answer = "wrong_answer"
    time_limit = "time_limit_exceeded"
    error = "compilation_error"

class CodingProblem(Base):
    __tablename__ = "coding_problems"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # NEW: Link to the Assessment Parent
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"))
    
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    time_limit_seconds: Mapped[float] = mapped_column(Float, default=2.0)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, default=128)

    assessment = relationship("Assessment", back_populates="coding_problems")
    test_cases = relationship("TestCase", back_populates="problem", cascade="all, delete-orphan")
    submissions = relationship("CodingSubmission", back_populates="problem")
    
    
class TestCase(Base):
    __tablename__ = "test_cases"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    problem_id: Mapped[int] = mapped_column(ForeignKey("coding_problems.id", ondelete="CASCADE"))
    
    stdin: Mapped[str] = mapped_column(Text, nullable=False) # The input (e.g., "2 4")
    expected_stdout: Mapped[str] = mapped_column(Text, nullable=False) # Expected output (e.g., "6")
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=True) # Hide edge cases from participants!

    problem = relationship("CodingProblem", back_populates="test_cases")

class CodingSubmission(Base):
    __tablename__ = "coding_submissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )

    problem_id: Mapped[int] = mapped_column(
        ForeignKey("coding_problems.id", ondelete="CASCADE")
    )

    source_code: Mapped[str] = mapped_column(Text, nullable=False)
    language_id: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[SubmissionStatus] = mapped_column(default=SubmissionStatus.pending)
    execution_time: Mapped[float] = mapped_column(Float, nullable=True)

    problem = relationship("CodingProblem", back_populates="submissions")

    # ✅ Correct
    user = relationship("User", back_populates="coding_submissions")
    
