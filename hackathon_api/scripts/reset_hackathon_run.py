import argparse
import asyncio
from pathlib import Path
import sys

from sqlalchemy import delete, func, select, update

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.db.session import SessionLocal
import app.models  # noqa: F401 - register SQLAlchemy models
from app.models.assessment import AssessmentAttempt
from app.models.coding import CodingSubmission
from app.models.mcq import MCQSubmission
from app.models.project import ProjectSubmission, RubricEvaluation
from app.models.system import SystemState
from app.models.team import Team
from app.models.user import User

DEFAULT_PHASES = {
    "registration": "active",
    "round1": "locked",
    "round2": "locked",
    "finale": "locked",
}


async def count_rows(db, model) -> int:
    return await db.scalar(select(func.count()).select_from(model)) or 0


async def set_default_phases(db) -> None:
    for phase_name, status in DEFAULT_PHASES.items():
        phase = (
            await db.execute(
                select(SystemState).where(SystemState.phase_name == phase_name)
            )
        ).scalar_one_or_none()

        if phase:
            phase.status = status
        else:
            db.add(SystemState(phase_name=phase_name, status=status))


async def reset_hackathon_run(clear_profiles: bool = False) -> dict[str, int]:
    async with SessionLocal() as db:
        before = {
            "rubric_evaluations": await count_rows(db, RubricEvaluation),
            "project_submissions": await count_rows(db, ProjectSubmission),
            "coding_submissions": await count_rows(db, CodingSubmission),
            "mcq_submissions": await count_rows(db, MCQSubmission),
            "assessment_attempts": await count_rows(db, AssessmentAttempt),
            "teams": await count_rows(db, Team),
        }

        await db.execute(delete(RubricEvaluation))
        await db.execute(delete(ProjectSubmission))
        await db.execute(delete(CodingSubmission))
        await db.execute(delete(MCQSubmission))
        await db.execute(delete(AssessmentAttempt))

        user_reset_values = {"team_id": None}
        if clear_profiles:
            user_reset_values.update({"avatar_url": None, "skills": None})

        await db.execute(update(User).values(**user_reset_values))
        await db.execute(delete(Team))
        await set_default_phases(db)

        await db.commit()
        return before


async def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Reset hackathon run data so the same accounts can test again from "
            "registration to finale."
        )
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Required confirmation flag. Without this, nothing is changed.",
    )
    parser.add_argument(
        "--clear-profiles",
        action="store_true",
        help="Also clear participant avatar URLs and skills.",
    )
    parser.add_argument(
        "--allow-production",
        action="store_true",
        help="Allow running when ENVIRONMENT=production.",
    )
    args = parser.parse_args()

    if settings.ENVIRONMENT == "production" and not args.allow_production:
        raise SystemExit("Refusing to reset production data without --allow-production.")

    print(f"DATABASE_URL: {settings.DATABASE_URL}")
    if not args.yes:
        print("Dry run only. Re-run with --yes to reset hackathon run data.")
        return

    deleted = await reset_hackathon_run(clear_profiles=args.clear_profiles)

    print("Reset complete. Cleared previous run data:")
    for table_name, count in deleted.items():
        print(f"- {table_name}: {count}")
    print("Phases reset to registration=active, round1/round2/finale=locked.")
    print("User accounts, admins, judges, assessments, questions, and test cases were kept.")


if __name__ == "__main__":
    asyncio.run(main())
