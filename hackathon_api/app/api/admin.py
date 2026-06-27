from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.admin import PhaseUpdateRequest, BroadcastRequest
from app.models.system import SystemState
from app.core.websocket import manager
from app.db.session import get_db
from app.api.deps import get_current_admin

from app.models.team import Team
from app.api.assessment import calculate_team_average, get_round1_assessment
from pydantic import BaseModel, Field


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

class AutoPromoteRequest(BaseModel):
    cutoff_score: int = Field(50, description="Minimum team average percentage required to advance to Round 2")

@router.post("/auto-promote")
async def auto_promote_teams(
    payload: AutoPromoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin)
):
    """
    Evaluates every team by averaging the Round 1 percentages of its participants.
    """
    assessment = await get_round1_assessment(db)
    result = await db.execute(select(Team))
    teams = result.scalars().all()

    promoted_count = 0
    evaluated = []

    for team in teams:
        team_summary = await calculate_team_average(db, team.id, assessment.id)
        is_promoted = team_summary["team_average"] >= payload.cutoff_score

        team.is_promoted_to_r2 = is_promoted
        if is_promoted:
            promoted_count += 1

        evaluated.append({
            "team_id": team.id,
            "team_name": team.name,
            "team_average_percent": team_summary["team_average"],
            "member_count": team_summary["member_count"],
            "promoted": is_promoted,
        })

    # Save all promotions to the database
    await db.commit()

    # 6. Broadcast the update to all connected React clients
    await manager.broadcast({
        "type": "global_announcement", 
        "message": f"Round 1 results are in! {promoted_count} teams have been promoted to Round 2. Refresh your dashboard to see if you qualified!"
    })

    return {
        "message": "Auto-promotion complete.",
        "teams_evaluated": len(teams),
        "teams_promoted": promoted_count,
        "cutoff_percent": payload.cutoff_score,
        "results": evaluated,
    }
