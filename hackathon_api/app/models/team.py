# app/models/team.py
from sqlalchemy import String , Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Team(Base):
    __tablename__ = "teams"
    is_promoted_to_r2: Mapped[bool] = mapped_column(Boolean, default=False)
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    repo_link: Mapped[str] = mapped_column(String(255), nullable=True)
    
    # One-to-Many relationship: One team has many users
    members = relationship("User", back_populates="team", foreign_keys="User.team_id")

    # Add this to the bottom of the Team class
    project = relationship("ProjectSubmission", back_populates="team", uselist=False)