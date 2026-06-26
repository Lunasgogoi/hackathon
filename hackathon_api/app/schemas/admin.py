from pydantic import BaseModel, Field

class PhaseUpdateRequest(BaseModel):
    phase_name: str = Field(..., description="e.g., registration, round1, round2, finale")
    status: str = Field(..., description="e.g., locked, active, completed")
    
class BroadcastRequest(BaseModel):
    message: str = Field(..., description="The message to broadcast to all users")