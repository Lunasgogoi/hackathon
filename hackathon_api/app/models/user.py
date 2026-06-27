# app/models/user.py
import enum
from typing import Optional
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from pydantic import BaseModel 

# Define our strict permission levels
class RoleEnum(str, enum.Enum):
    participant = "participant"
    judge = "judge"
    admin = "admin"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    
    # Assign the enum to the column, defaulting to participant
    role: Mapped[RoleEnum] = mapped_column(default=RoleEnum.participant)
    
    # A user can be part of ONE team (or no team yet)
    team_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)

    # Link back to the Team model
    team = relationship("Team", back_populates="members", foreign_keys=[team_id])
    
    # Add to app/models/user.py
    coding_submissions = relationship("CodingSubmission", back_populates="user") # Requires importing CodingSubmission at the top (or using a string reference
    
    # Add this to the bottom of the User class
    evaluations_given = relationship("RubricEvaluation", back_populates="judge")
    
    mcq_submissions = relationship("MCQSubmission", back_populates="user")