# app/models/team.py
from typing import Optional

from sqlalchemy import String , Boolean, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Team(Base):
    __tablename__ = "teams"
    is_promoted_to_r2: Mapped[bool] = mapped_column(Boolean, default=False)
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    invite_code: Mapped[Optional[str]] = mapped_column(String(24), unique=True, index=True, nullable=True)
    max_members: Mapped[int] = mapped_column(Integer, default=4)
    captain_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    repo_link: Mapped[str] = mapped_column(String(255), nullable=True)
    
    # One-to-Many relationship: One team has many users
    members = relationship("User", back_populates="team", foreign_keys="User.team_id")

    # Add this to the bottom of the Team class
    project = relationship("ProjectSubmission", back_populates="team", uselist=False)
