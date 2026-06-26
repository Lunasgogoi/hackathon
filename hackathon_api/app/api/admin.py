from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.admin import PhaseUpdateRequest, BroadcastRequest
from app.models.system import SystemState
from app.core.websocket import manager
from app.db.session import get_db
from app.api.deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/phase")
async def update_hackathon_phase(
    payload: PhaseUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    valid_phases = ["registration", "round1", "round2", "finale"]
    valid_statuses = ["locked", "active", "completed"]

    if payload.phase_name not in valid_phases:
        raise HTTPException(status_code=400, detail="Invalid phase name.")
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status.")

    # --- 1. UPDATE POSTGRESQL ---
    result = await db.execute(
        select(SystemState).where(SystemState.phase_name == payload.phase_name)
    )
    state_record = result.scalar_one_or_none()

    if not state_record:
        state_record = SystemState(phase_name=payload.phase_name, status=payload.status)
        db.add(state_record)
    else:
        state_record.status = payload.status

    await db.commit()
    await db.refresh(state_record)

    # --- 2. WEBSOCKET BROADCAST ---
    # Instantly tell all React clients to update their UI
    await manager.broadcast(
        {"type": "phase_update", "phase": payload.phase_name, "status": payload.status}
    )

    return {
        "message": f"{payload.phase_name} is now {payload.status}",
        "phase": payload.phase_name,
        "new_status": payload.status,
    }


@router.post("/broadcast")
async def broadcast_message(
    payload: BroadcastRequest,
    current_user = Depends(get_current_admin)
):
    # --- WEBSOCKET BROADCAST ---
    # Blast the custom message to all React clients
    await manager.broadcast({"type": "global_announcement", "message": payload.message})

    return {"message": "Broadcast sent successfully."}
