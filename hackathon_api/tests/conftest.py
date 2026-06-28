import os
import uuid
from collections.abc import AsyncIterator, Callable

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("PROJECT_NAME", "HackCoreTest")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_hackcore.db")
os.environ.setdefault("ENABLE_DEV_ROUTES", "false")
os.environ.setdefault("USE_PISTON_CODE_RUNNER", "false")

import app.models  # noqa: E402,F401 - register SQLAlchemy models
from app.core.security import get_password_hash  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.assessment import Assessment  # noqa: E402
from app.models.coding import CodingProblem, TestCase  # noqa: E402
from app.models.mcq import MCQQuestion  # noqa: E402
from app.models.project import ProjectSubmission, RubricEvaluation  # noqa: E402
from app.models.system import SystemState  # noqa: E402
from app.models.team import Team  # noqa: E402
from app.models.user import RoleEnum, User  # noqa: E402

TEST_DATABASE_URL = os.environ["DATABASE_URL"]

test_engine = create_async_engine(TEST_DATABASE_URL, future=True, echo=False)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(autouse=True)
async def reset_database() -> AsyncIterator[None]:
    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def create_user(db_session: AsyncSession) -> Callable[..., object]:
    async def _create_user(
        *,
        username: str = "participant",
        email: str | None = None,
        password: str = "Password123!",
        role: RoleEnum | str = RoleEnum.participant,
        is_master_admin: bool = False,
    ) -> User:
        role_value = RoleEnum(role)
        user = User(
            username=username,
            email=email or f"{username}@example.com",
            hashed_password=get_password_hash(password),
            role=role_value,
            is_master_admin=is_master_admin,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    return _create_user


@pytest.fixture
def auth_headers(client: AsyncClient) -> Callable[..., object]:
    async def _auth_headers(username: str, password: str = "Password123!") -> dict[str, str]:
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password},
        )
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return _auth_headers


@pytest.fixture
def set_phase(db_session: AsyncSession) -> Callable[..., object]:
    async def _set_phase(name: str, status: str) -> SystemState:
        result = await db_session.execute(
            select(SystemState).where(SystemState.phase_name == name)
        )
        phase = result.scalar_one_or_none()
        if phase is None:
            phase = SystemState(phase_name=name, status=status)
            db_session.add(phase)
        else:
            phase.status = status
        await db_session.commit()
        await db_session.refresh(phase)
        return phase

    return _set_phase


@pytest.fixture
def create_team(db_session: AsyncSession) -> Callable[..., object]:
    async def _create_team(
        *,
        name: str = "Team Alpha",
        invite_code: str | None = None,
        max_members: int = 4,
        captain: User | None = None,
        promoted: bool = False,
    ) -> Team:
        team = Team(
            name=name,
            invite_code=invite_code or uuid.uuid4().hex[:6].upper(),
            max_members=max_members,
            is_promoted_to_r2=promoted,
            captain_id=captain.id if captain else None,
        )
        db_session.add(team)
        await db_session.flush()
        if captain:
            captain.team_id = team.id
        await db_session.commit()
        await db_session.refresh(team)
        return team

    return _create_team


@pytest.fixture
def create_round1_assessment(db_session: AsyncSession) -> Callable[..., object]:
    async def _create_round1_assessment() -> dict[str, object]:
        assessment = Assessment(
            title="Round 1: Online Assessment",
            description="Test assessment",
        )
        db_session.add(assessment)
        await db_session.flush()

        problem = CodingProblem(
            assessment_id=assessment.id,
            title="Echo",
            description="Echo input",
            starter_code="{}",
            time_limit_seconds=2,
        )
        db_session.add(problem)
        await db_session.flush()

        visible_case = TestCase(
            problem_id=problem.id,
            stdin="hello",
            expected_stdout="hello",
            is_hidden=False,
        )
        hidden_case = TestCase(
            problem_id=problem.id,
            stdin="world",
            expected_stdout="world",
            is_hidden=True,
        )
        mcq = MCQQuestion(
            assessment_id=assessment.id,
            question_text="Pick A",
            options='{"A":"Correct","B":"Wrong"}',
            correct_option="A",
        )
        db_session.add_all([visible_case, hidden_case, mcq])
        await db_session.commit()

        return {
            "assessment": assessment,
            "problem": problem,
            "mcq": mcq,
        }

    return _create_round1_assessment


@pytest.fixture
def create_project(db_session: AsyncSession) -> Callable[..., object]:
    async def _create_project(*, team: Team, title: str = "Project") -> ProjectSubmission:
        project = ProjectSubmission(
            team_id=team.id,
            title=title,
            description="A project",
            repo_url="https://example.com/repo",
            tech_stack="FastAPI, React",
        )
        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)
        return project

    return _create_project


@pytest.fixture
def create_evaluation(db_session: AsyncSession) -> Callable[..., object]:
    async def _create_evaluation(
        *,
        project: ProjectSubmission,
        judge: User,
        total_score: float = 24,
    ) -> RubricEvaluation:
        evaluation = RubricEvaluation(
            project_id=project.id,
            judge_id=judge.id,
            ui_ux_score=total_score / 3,
            technical_complexity=total_score / 3,
            innovation=total_score / 3,
            total_score=total_score,
            feedback="Good work",
        )
        db_session.add(evaluation)
        await db_session.commit()
        await db_session.refresh(evaluation)
        return evaluation

    return _create_evaluation
