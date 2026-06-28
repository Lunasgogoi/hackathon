from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.admin import BroadcastRequest, PhaseUpdateRequest, PrivilegedUserCreateRequest
from app.models.system import SystemState
from app.core.websocket import manager
from app.db.session import get_db
from app.api.deps import get_current_admin, get_current_master_admin

from app.core.security import get_password_hash
from app.models.project import ProjectSubmission, RubricEvaluation
from app.models.team import Team
from app.models.user import RoleEnum, User
from app.api.assessment import calculate_team_average, get_round1_assessment
from app.core.email import send_privileged_user_created_email, send_round1_qualified_email
from pydantic import BaseModel, Field


router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/me")
async def get_admin_profile(
    current_user: User = Depends(get_current_admin),
):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_master_admin": current_user.is_master_admin,
    }


@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    registered_teams = (await db.execute(select(func.count(Team.id)))).scalar_one()
    active_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    projects_submitted = (
        await db.execute(select(func.count(ProjectSubmission.id)))
    ).scalar_one()
    judge_count = (
        await db.execute(select(func.count(User.id)).where(User.role == RoleEnum.judge))
    ).scalar_one()

    if judge_count == 0:
        pending_evaluations = projects_submitted
    else:
        evaluation_counts = (
            select(
                ProjectSubmission.id.label("project_id"),
                func.count(func.distinct(RubricEvaluation.judge_id)).label("judge_evaluations"),
            )
            .outerjoin(
                RubricEvaluation,
                RubricEvaluation.project_id == ProjectSubmission.id,
            )
            .group_by(ProjectSubmission.id)
            .subquery()
        )
        pending_evaluations = (
            await db.execute(
                select(func.count())
                .select_from(evaluation_counts)
                .where(evaluation_counts.c.judge_evaluations < judge_count)
            )
        ).scalar_one()

    return {
        "registered_teams": registered_teams,
        "active_users": active_users,
        "projects_submitted": projects_submitted,
        "pending_evaluations": pending_evaluations,
    }


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_privileged_user(
    payload: PrivilegedUserCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_master_admin),
):
    existing = await db.execute(
        select(User).where(
            (User.email == payload.email) | (User.username == payload.username)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already exists.")

    user = User(
        username=payload.username.strip(),
        email=str(payload.email),
        hashed_password=get_password_hash(payload.password),
        role=RoleEnum(payload.role),
        is_master_admin=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    background_tasks.add_task(
        send_privileged_user_created_email,
        user.email,
        user.username,
        user.role.value,
        payload.password,
    )

    return {
        "message": f"{payload.role.title()} account created. Login email queued.",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_master_admin": user.is_master_admin,
        },
    }


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
    background_tasks: BackgroundTasks,
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
        was_promoted = team.is_promoted_to_r2

        team.is_promoted_to_r2 = is_promoted
        if is_promoted:
            promoted_count += 1
            if not was_promoted:
                members = list((await db.execute(
                    select(User).where(User.team_id == team.id, User.role == RoleEnum.participant)
                )).scalars().all())
                for member in members:
                    background_tasks.add_task(
                        send_round1_qualified_email,
                        member.email,
                        member.username,
                        team.name,
                        team_summary["team_average"],
                    )

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
