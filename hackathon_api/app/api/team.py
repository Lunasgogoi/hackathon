import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.team import Team
from app.models.user import RoleEnum, User
from app.schemas.team import TeamCreate, TeamJoin, UserProfileUpdate

router = APIRouter(prefix="/teams", tags=["Teams"])

INVITE_ALPHABET = string.ascii_uppercase + string.digits


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
        code = "".join(secrets.choice(INVITE_ALPHABET) for _ in range(8))
        existing = await db.execute(select(Team.id).where(Team.invite_code == code))
        if existing.scalar_one_or_none() is None:
            return code


async def serialize_team(db: AsyncSession, team: Team) -> dict:
    members = list((await db.execute(
        select(User).where(User.team_id == team.id).order_by(User.id)
    )).scalars().all())

    return {
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "invite_code": team.invite_code,
        "max_members": team.max_members,
        "member_count": len(members),
        "is_promoted_to_r2": team.is_promoted_to_r2,
        "captain_id": team.captain_id,
        "members": [serialize_member(member, team.captain_id) for member in members],
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
    if current_user.team_id:
        team = (await db.execute(select(Team).where(Team.id == current_user.team_id))).scalar_one_or_none()
        if team:
            team_payload = await serialize_team(db, team)

    return {
        "current_user": serialize_member(current_user, None),
        "team": team_payload,
    }


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_team(
    request: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_participant(current_user)

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
    if current_user.team_id:
        team = (await db.execute(select(Team).where(Team.id == current_user.team_id))).scalar_one_or_none()
        if team:
            team_payload = await serialize_team(db, team)

    return {
        "message": "Profile updated.",
        "current_user": serialize_member(current_user, None),
        "team": team_payload,
    }
