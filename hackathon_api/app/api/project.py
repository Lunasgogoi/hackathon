# app/api/project.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_db, get_current_user
from app.models.user import User, RoleEnum
from app.models.team import Team
from app.models.project import ProjectSubmission, RubricEvaluation
from app.schemas.project import ProjectCreate, RubricSubmit

router = APIRouter(prefix="/projects", tags=["Round 2: Build Phase"])

@router.post("/submit", status_code=status.HTTP_201_CREATED)
async def submit_project(
    request: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user) # Any logged in user
):
    from app.models.user import RoleEnum
    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only official participants can submit projects.")
    
    # 1. Ensure user is actually on a team
    if not current_user.team_id:
        raise HTTPException(status_code=400, detail="You must be on a team to submit.")

    # 2. Enforce the State Machine: Were they promoted?
    team_result = await db.execute(select(Team).where(Team.id == current_user.team_id))
    team = team_result.scalar_one()
    
    if not team.is_promoted_to_r2:
        raise HTTPException(status_code=403, detail="Your team did not qualify for Round 2.")

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
    await db.commit()
    return {"message": "Project submitted successfully!"}

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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Enforce Role-Based Access Control (Judges ONLY)
    if current_user.role != RoleEnum.judge:
        raise HTTPException(status_code=403, detail="Only official judges can submit evaluations.")

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
    await db.commit()
    return {"message": "Evaluation recorded.", "total_score": total}
