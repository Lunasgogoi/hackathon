import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ensure_phase_active, get_current_user, get_db
from app.models.project import ProjectSubmission
from app.models.team import Team
from app.models.user import RoleEnum, User
from app.schemas.team import TeamCreate, TeamJoin, UserProfileUpdate

router = APIRouter(prefix="/teams", tags=["Teams"])

INVITE_ALPHABET = string.ascii_uppercase
INVITE_CODE_LENGTH = 6


def serialize_member(member: User, captain_id: int | None) -> dict:
    return {
        "id": member.id,
        "username": member.username,
        "email": member.email,
        "avatar_url": member.avatar_url,
        "skills": member.skills,
        "is_captain": member.id == captain_id,
    }


async def generate_invite_code(db: AsyncSession) -> str:
    while True:
        code = "".join(secrets.choice(INVITE_ALPHABET) for _ in range(INVITE_CODE_LENGTH))
        existing = await db.execute(select(Team.id).where(Team.invite_code == code))
        if existing.scalar_one_or_none() is None:
            return code


async def ensure_team_invite_code(db: AsyncSession, team: Team) -> None:
    if team.invite_code:
        return

    team.invite_code = await generate_invite_code(db)
    await db.commit()
    await db.refresh(team)


async def ensure_team_captain(db: AsyncSession, team: Team, members: list[User]) -> int | None:
    if team.captain_id:
        return team.captain_id
    if not members:
        return None

    team.captain_id = members[0].id
    await db.commit()
    await db.refresh(team)
    return team.captain_id


async def serialize_team(db: AsyncSession, team: Team) -> dict:
    await ensure_team_invite_code(db, team)

    members = list((await db.execute(
        select(User).where(User.team_id == team.id).order_by(User.id)
    )).scalars().all())
    captain_id = await ensure_team_captain(db, team, members)
    has_project_submission = (await db.execute(
        select(ProjectSubmission.id).where(ProjectSubmission.team_id == team.id)
    )).scalar_one_or_none() is not None

    return {
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "invite_code": team.invite_code,
        "max_members": team.max_members,
        "member_count": len(members),
        "is_promoted_to_r2": team.is_promoted_to_r2,
        "captain_id": captain_id,
        "has_project_submission": has_project_submission,
        "members": [serialize_member(member, captain_id) for member in members],
    }


def ensure_participant(current_user: User) -> None:
    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only participants can manage teams.")


@router.get("/me")
async def get_my_team(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_participant(current_user)

    team_payload = None
    captain_id = None
    if current_user.team_id:
        team = (await db.execute(select(Team).where(Team.id == current_user.team_id))).scalar_one_or_none()
        if team:
            team_payload = await serialize_team(db, team)
            captain_id = team_payload["captain_id"]

    return {
        "current_user": serialize_member(current_user, captain_id),
        "team": team_payload,
    }


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_team(
    request: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_participant(current_user)
    await ensure_phase_active(db, "registration", "Teams can only be created during registration.")

    if current_user.team_id:
        raise HTTPException(status_code=400, detail="You are already in a team.")

    existing_name = await db.execute(
        select(Team.id).where(func.lower(Team.name) == request.name.strip().lower())
    )
    if existing_name.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="A team with this name already exists.")

    team = Team(
        name=request.name.strip(),
        description=request.description.strip() if request.description else None,
        max_members=request.max_members,
        invite_code=await generate_invite_code(db),
        captain_id=current_user.id,
    )
    db.add(team)
    await db.flush()

    current_user.team_id = team.id
    await db.commit()

    return {
        "message": "Team created.",
        "team": await serialize_team(db, team),
    }


@router.post("/join")
async def join_team(
    request: TeamJoin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_participant(current_user)
    await ensure_phase_active(db, "registration", "Teams can only be joined during registration.")

    if current_user.team_id:
        raise HTTPException(status_code=400, detail="You are already in a team.")

    team = (await db.execute(
        select(Team).where(Team.invite_code == request.invite_code.strip().upper())
    )).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team invite code not found.")

    member_count = (await db.execute(
        select(func.count(User.id)).where(User.team_id == team.id)
    )).scalar_one()
    if member_count >= team.max_members:
        raise HTTPException(status_code=400, detail="This team is already full.")

    current_user.team_id = team.id
    await db.commit()

    return {
        "message": "Joined team.",
        "team": await serialize_team(db, team),
    }


@router.patch("/profile")
async def update_team_profile(
    request: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_participant(current_user)

    current_user.avatar_url = str(request.avatar_url) if request.avatar_url else None
    current_user.skills = request.skills.strip() if request.skills else None
    await db.commit()

    team_payload = None
    captain_id = None
    if current_user.team_id:
        team = (await db.execute(select(Team).where(Team.id == current_user.team_id))).scalar_one_or_none()
        if team:
            team_payload = await serialize_team(db, team)
            captain_id = team_payload["captain_id"]

    return {
        "message": "Profile updated.",
        "current_user": serialize_member(current_user, captain_id),
        "team": team_payload,
    }
