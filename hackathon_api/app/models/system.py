from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class SystemState(Base):
    __tablename__ = "system_states"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    phase_name: Mapped[str] = mapped_column(String(50), unique=True, index=True) # e.g., "round1"
    status: Mapped[str] = mapped_column(String(20)) # e.g., "active", "locked", "completed"
