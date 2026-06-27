from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.admin import PhaseUpdateRequest, BroadcastRequest
from app.models.system import SystemState
from app.core.websocket import manager
from app.db.session import get_db
from app.api.deps import get_current_admin

from sqlalchemy import func
from app.models.team import Team
from app.models.user import User
from app.models.coding import CodingSubmission, SubmissionStatus
from app.models.mcq import MCQSubmission
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
    cutoff_score: int = Field(50, description="Minimum score required to advance to Round 2")

@router.post("/auto-promote")
async def auto_promote_teams(
    payload: AutoPromoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin)
):
    """
    Evaluates all teams based on Round 1 performance.
    Coding = 50 pts, MCQ = 10 pts.
    """
    # 1. Fetch all teams and their members
    result = await db.execute(select(Team))
    teams = result.scalars().all()

    promoted_count = 0

    for team in teams:
        team_score = 0
        
        # 2. Fetch all members of this team
        members_result = await db.execute(select(User).where(User.team_id == team.id))
        members = members_result.scalars().all()
        member_ids = [m.id for m in members]

        if not member_ids:
            continue

        # 3. Calculate Coding Score (e.g., 50 points per Accepted submission)
        coding_result = await db.execute(
            select(func.count(CodingSubmission.id))
            .where(
                CodingSubmission.user_id.in_(member_ids),
                CodingSubmission.status == SubmissionStatus.accepted
            )
        )
        accepted_codes = coding_result.scalar() or 0
        team_score += (accepted_codes * 50)

        # 4. Calculate MCQ Score (e.g., 10 points per Correct MCQ)
        mcq_result = await db.execute(
            select(func.count(MCQSubmission.id))
            .where(
                MCQSubmission.user_id.in_(member_ids),
                MCQSubmission.is_correct == True
            )
        )
        correct_mcqs = mcq_result.scalar() or 0
        team_score += (correct_mcqs * 10)

        # 5. Evaluate against the cutoff
        if team_score >= payload.cutoff_score:
            team.is_promoted_to_r2 = True
            promoted_count += 1
        else:
            team.is_promoted_to_r2 = False

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
        "teams_promoted": promoted_count
    }
