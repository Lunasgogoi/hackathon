# app/api/project.py
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import ensure_phase_active, get_db, get_current_user
from app.api.leaderboard import fetch_top_teams, manager
from app.core.email import send_project_judged_email, send_project_submitted_email
from app.models.user import User, RoleEnum
from app.models.team import Team
from app.models.project import ProjectSubmission, RubricEvaluation
from app.schemas.project import ProjectCreate, RubricSubmit

router = APIRouter(prefix="/projects", tags=["Round 2: Build Phase"])

@router.post("/submit", status_code=status.HTTP_201_CREATED)
async def submit_project(
    request: ProjectCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user) # Any logged in user
):
    from app.models.user import RoleEnum
    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only official participants can submit projects.")
    await ensure_phase_active(db, "round2", "Project submissions are only allowed while Round 2 is active.")
    
    # 1. Ensure user is actually on a team
    if not current_user.team_id:
        raise HTTPException(status_code=400, detail="You must be on a team to submit.")

    # 2. Enforce the State Machine: Were they promoted?
    team_result = await db.execute(select(Team).where(Team.id == current_user.team_id))
    team = team_result.scalar_one()
    if not team.captain_id:
        first_member = (await db.execute(
            select(User).where(User.team_id == team.id, User.role == RoleEnum.participant).order_by(User.id)
        )).scalars().first()
        if first_member:
            team.captain_id = first_member.id
    
    if not team.is_promoted_to_r2:
        raise HTTPException(status_code=403, detail="Your team did not qualify for Round 2.")
    if team.captain_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only team leaders can submit the project.")

    # 3. Prevent duplicate submissions
    existing_proj = await db.execute(select(ProjectSubmission).where(ProjectSubmission.team_id == team.id))
    if existing_proj.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Your team has already submitted a project.")

    # 4. Save the project
    new_project = ProjectSubmission(
        team_id=team.id,
        title=request.title,
        description=request.description,
        repo_url=str(request.repo_url),
        video_demo_url=str(request.video_demo_url) if request.video_demo_url else None,
        tech_stack=request.tech_stack,
        asset_url=str(request.asset_url) if request.asset_url else None
    )
    db.add(new_project)
    team_members = list((await db.execute(
        select(User).where(User.team_id == team.id, User.role == RoleEnum.participant)
    )).scalars().all())
    await db.commit()

    for member in team_members:
        background_tasks.add_task(
            send_project_submitted_email,
            member.email,
            member.username,
            team.name,
            new_project.title,
        )

    return {"message": "Project submitted successfully. Your team is now under final review."}

@router.get("/pending")
async def get_pending_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != RoleEnum.judge:
        raise HTTPException(status_code=403, detail="Only official judges can view pending projects.")

    evaluated_result = await db.execute(
        select(RubricEvaluation.project_id).where(RubricEvaluation.judge_id == current_user.id)
    )
    evaluated_project_ids = set(evaluated_result.scalars().all())

    projects_result = await db.execute(select(ProjectSubmission))
    projects = projects_result.scalars().all()

    return [
        {
            "id": project.id,
            "team_id": project.team_id,
            "title": project.title,
            "description": project.description,
            "repo_url": project.repo_url,
            "video_demo_url": project.video_demo_url,
            "tech_stack": project.tech_stack,
            "asset_url": project.asset_url,
        }
        for project in projects
        if project.id not in evaluated_project_ids
    ]

@router.post("/evaluate")
async def evaluate_project(
    request: RubricSubmit,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Enforce Role-Based Access Control (Judges ONLY)
    if current_user.role != RoleEnum.judge:
        raise HTTPException(status_code=403, detail="Only official judges can submit evaluations.")

    project = (await db.execute(
        select(ProjectSubmission).where(ProjectSubmission.id == request.project_id)
    )).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    # 2. Prevent a judge from grading the same project twice
    existing_eval = await db.execute(
        select(RubricEvaluation).where(
            RubricEvaluation.project_id == request.project_id,
            RubricEvaluation.judge_id == current_user.id
        )
    )
    if existing_eval.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already evaluated this project.")

    # 3. Calculate total and save
    total = request.ui_ux_score + request.technical_complexity + request.innovation
    
    evaluation = RubricEvaluation(
        project_id=request.project_id,
        judge_id=current_user.id,
        ui_ux_score=request.ui_ux_score,
        technical_complexity=request.technical_complexity,
        innovation=request.innovation,
        total_score=total,
        feedback=request.feedback
    )
    db.add(evaluation)
    await db.flush()

    team = (await db.execute(select(Team).where(Team.id == project.team_id))).scalar_one()
    team_members = list((await db.execute(
        select(User).where(User.team_id == team.id, User.role == RoleEnum.participant)
    )).scalars().all())

    judge_count = (await db.execute(
        select(func.count(User.id)).where(User.role == RoleEnum.judge)
    )).scalar_one()
    evaluations_count = (await db.execute(
        select(func.count(func.distinct(RubricEvaluation.judge_id))).where(
            RubricEvaluation.project_id == project.id
        )
    )).scalar_one()
    final_score = (await db.execute(
        select(func.coalesce(func.sum(RubricEvaluation.total_score), 0)).where(
            RubricEvaluation.project_id == project.id
        )
    )).scalar_one()
    judging_complete = judge_count > 0 and evaluations_count >= judge_count

    await db.commit()

    if judging_complete:
        for member in team_members:
            background_tasks.add_task(
                send_project_judged_email,
                member.email,
                member.username,
                team.name,
                project.title,
                final_score,
            )

    current_board = await fetch_top_teams(db)
    await manager.broadcast_leaderboard({
        "type": "live_update",
        "data": current_board,
    })

    return {"message": "Evaluation recorded.", "total_score": total}
