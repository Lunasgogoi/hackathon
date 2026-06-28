import json
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ensure_phase_active, get_current_user, get_db
from app.core.config import settings
from app.core.email import send_round1_qualified_email
from app.models.assessment import Assessment, AssessmentAttempt
from app.models.coding import CodingProblem, CodingSubmission, SubmissionStatus, TestCase
from app.models.mcq import MCQQuestion, MCQSubmission
from app.models.team import Team
from app.models.user import RoleEnum, User

router = APIRouter(prefix="/assessment", tags=["Assessment"])

CODING_POINTS = 50
MCQ_POINTS = 10
DEFAULT_ROUND2_CUTOFF_PERCENT = 50
FINAL_ATTEMPT_STATUSES = {"submitted", "evaluated"}


def parse_json_object(raw_value: str | None) -> dict:
    if not raw_value:
        return {}

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return {}

    return parsed if isinstance(parsed, dict) else {}


def serialize_attempt_score(attempt: AssessmentAttempt) -> dict:
    return {
        "user_id": attempt.user_id,
        "total_score": attempt.total_score,
        "max_score": attempt.max_score,
        "percentage": attempt.percentage,
        "status": attempt.status,
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
    }


def serialize_missing_assessment_score(user_id: int, attempt: AssessmentAttempt | None = None) -> dict:
    return {
        "user_id": user_id,
        "total_score": 0,
        "max_score": 0,
        "percentage": 0,
        "status": attempt.status if attempt else "not_started",
        "submitted_at": None,
    }


async def get_assessment_attempt(
    db: AsyncSession,
    user_id: int,
    assessment_id: int,
) -> AssessmentAttempt | None:
    return (await db.execute(
        select(AssessmentAttempt).where(
            AssessmentAttempt.user_id == user_id,
            AssessmentAttempt.assessment_id == assessment_id,
        )
    )).scalar_one_or_none()


async def get_or_create_assessment_attempt(
    db: AsyncSession,
    user_id: int,
    assessment_id: int,
) -> AssessmentAttempt:
    attempt = await get_assessment_attempt(db, user_id, assessment_id)

    if attempt:
        return attempt

    attempt = AssessmentAttempt(
        user_id=user_id,
        assessment_id=assessment_id,
        status="in_progress",
    )
    db.add(attempt)
    await db.flush()
    return attempt


async def ensure_assessment_attempt_is_editable(
    db: AsyncSession,
    user_id: int,
    assessment_id: int,
) -> AssessmentAttempt:
    attempt = await get_or_create_assessment_attempt(db, user_id, assessment_id)

    if attempt.status in FINAL_ATTEMPT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="This assessment has already been submitted and cannot be changed.",
        )

    return attempt


async def calculate_user_assessment_score(db: AsyncSession, user_id: int, assessment_id: int) -> dict:
    coding_problem_ids = list((await db.execute(
        select(CodingProblem.id).where(CodingProblem.assessment_id == assessment_id)
    )).scalars().all())
    mcq_question_ids = list((await db.execute(
        select(MCQQuestion.id).where(MCQQuestion.assessment_id == assessment_id)
    )).scalars().all())

    coding_score = 0
    if coding_problem_ids:
        coding_rows = (await db.execute(
            select(CodingSubmission.problem_id, CodingSubmission.status).where(
                CodingSubmission.user_id == user_id,
                CodingSubmission.problem_id.in_(coding_problem_ids),
            )
        )).all()
        accepted_problem_ids = {
            problem_id
            for problem_id, status in coding_rows
            if status == SubmissionStatus.accepted
        }
        coding_score = len(accepted_problem_ids) * CODING_POINTS

    mcq_score = 0
    if mcq_question_ids:
        mcq_score = len((await db.execute(
            select(MCQSubmission.id).where(
                MCQSubmission.user_id == user_id,
                MCQSubmission.question_id.in_(mcq_question_ids),
                MCQSubmission.is_correct == True,
            )
        )).scalars().all()) * MCQ_POINTS

    max_score = (len(coding_problem_ids) * CODING_POINTS) + (len(mcq_question_ids) * MCQ_POINTS)
    total_score = coding_score + mcq_score
    percentage = round((total_score / max_score) * 100, 2) if max_score else 0

    return {
        "user_id": user_id,
        "coding_score": coding_score,
        "mcq_score": mcq_score,
        "total_score": total_score,
        "max_score": max_score,
        "percentage": percentage,
    }


async def get_user_assessment_breakdown(db: AsyncSession, user_id: int, assessment_id: int) -> dict:
    coding_problem_ids = list((await db.execute(
        select(CodingProblem.id).where(CodingProblem.assessment_id == assessment_id)
    )).scalars().all())
    mcq_question_ids = list((await db.execute(
        select(MCQQuestion.id).where(MCQQuestion.assessment_id == assessment_id)
    )).scalars().all())

    coding_submission_rows = []
    if coding_problem_ids:
        coding_submission_rows = (await db.execute(
            select(CodingSubmission.problem_id, CodingSubmission.status).where(
                CodingSubmission.user_id == user_id,
                CodingSubmission.problem_id.in_(coding_problem_ids),
            )
        )).all()

    accepted_coding_problem_ids = {
        problem_id
        for problem_id, status in coding_submission_rows
        if status == SubmissionStatus.accepted
    }

    answered_mcq_rows = []
    if mcq_question_ids:
        answered_mcq_rows = (await db.execute(
            select(MCQSubmission.question_id, MCQSubmission.is_correct).where(
                MCQSubmission.user_id == user_id,
                MCQSubmission.question_id.in_(mcq_question_ids),
            )
        )).all()

    return {
        "total_questions": len(coding_problem_ids) + len(mcq_question_ids),
        "coding_questions": len(coding_problem_ids),
        "accepted_coding_questions": len(accepted_coding_problem_ids),
        "coding_submissions": len(coding_submission_rows),
        "mcq_questions": len(mcq_question_ids),
        "answered_mcq_questions": len({question_id for question_id, _ in answered_mcq_rows}),
        "correct_mcq_answers": sum(1 for _, is_correct in answered_mcq_rows if is_correct),
    }


async def calculate_team_average(db: AsyncSession, team_id: int, assessment_id: int) -> dict:
    members = list((await db.execute(
        select(User).where(User.team_id == team_id, User.role == RoleEnum.participant)
    )).scalars().all())

    member_scores = []
    for member in members:
        attempt = await get_assessment_attempt(db, member.id, assessment_id)

        if attempt and attempt.status in FINAL_ATTEMPT_STATUSES:
            member_scores.append(serialize_attempt_score(attempt))
        else:
            member_scores.append(serialize_missing_assessment_score(member.id, attempt))

    team_average = round(
        sum(score["percentage"] for score in member_scores) / len(member_scores),
        2
    ) if member_scores else 0

    return {
        "team_average": team_average,
        "member_scores": member_scores,
        "member_count": len(member_scores),
    }


async def get_round1_assessment(db: AsyncSession) -> Assessment:
    assessment = (await db.execute(
        select(Assessment).where(Assessment.title == "Round 1: Online Assessment")
    )).scalar_one_or_none()

    if not assessment:
        raise HTTPException(status_code=404, detail="Round 1 assessment not found.")

    return assessment


async def ensure_assessment_can_be_opened(
    db: AsyncSession,
    user_id: int,
    assessment_id: int,
) -> None:
    attempt = await get_assessment_attempt(db, user_id, assessment_id)
    if attempt and attempt.status in FINAL_ATTEMPT_STATUSES:
        raise HTTPException(
            status_code=403,
            detail="Your Round 1 submission is final. View your Round 1 status instead.",
        )


@router.get("/current")
async def get_current_assessment(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only participants can view assessments.")
    await ensure_phase_active(db, "round1", "Round 1 assessment is not active.")

    assessment = await get_round1_assessment(db)
    await ensure_assessment_can_be_opened(db, current_user.id, assessment.id)

    coding_problems = (await db.execute(
        select(CodingProblem).where(CodingProblem.assessment_id == assessment.id).order_by(CodingProblem.id)
    )).scalars().all()
    mcq_questions = (await db.execute(
        select(MCQQuestion).where(MCQQuestion.assessment_id == assessment.id).order_by(MCQQuestion.id)
    )).scalars().all()

    accepted_problem_ids = {
        problem_id
        for problem_id in (await db.execute(
            select(CodingSubmission.problem_id).where(
                CodingSubmission.user_id == current_user.id,
                CodingSubmission.status == SubmissionStatus.accepted,
                CodingSubmission.problem_id.in_([problem.id for problem in coding_problems] or [-1]),
            )
        )).scalars().all()
    }
    selected_mcq_options = {
        question_id: selected_option
        for question_id, selected_option in (await db.execute(
            select(MCQSubmission.question_id, MCQSubmission.selected_option).where(
                MCQSubmission.user_id == current_user.id,
                MCQSubmission.question_id.in_([question.id for question in mcq_questions] or [-1]),
            )
        )).all()
    }

    questions = []
    for index, problem in enumerate(coding_problems, start=1):
        visible_test_cases = (await db.execute(
            select(TestCase)
            .where(TestCase.problem_id == problem.id, TestCase.is_hidden.is_(False))
            .order_by(TestCase.id)
        )).scalars().all()

        questions.append({
            "id": problem.id,
            "type": "coding",
            "label": f"S{index}",
            "title": problem.title,
            "description": problem.description,
            "difficulty": "Coding",
            "points": CODING_POINTS,
            "time_limit_seconds": problem.time_limit_seconds,
            "memory_limit_mb": problem.memory_limit_mb,
            "starter_code": parse_json_object(problem.starter_code),
            "examples": [
                {
                    "input": test_case.stdin,
                    "output": test_case.expected_stdout,
                    "explanation": "",
                }
                for test_case in visible_test_cases
            ],
            "answered": problem.id in accepted_problem_ids,
        })

    for index, question in enumerate(mcq_questions, start=1):
        questions.append({
            "id": question.id,
            "type": "mcq",
            "label": f"M{index}",
            "title": f"Question {index}",
            "description": question.question_text,
            "difficulty": "MCQ",
            "points": MCQ_POINTS,
            "options": parse_json_object(question.options),
            "selected_option": selected_mcq_options.get(question.id),
            "answered": question.id in selected_mcq_options,
        })

    questions.sort(key=lambda item: item["id"])

    return {
        "id": assessment.id,
        "title": assessment.title,
        "description": assessment.description,
        "questions": questions,
    }


@router.get("/status")
async def get_assessment_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only participants can view assessment status.")

    assessment = await get_round1_assessment(db)
    attempt = await get_assessment_attempt(db, current_user.id, assessment.id)
    is_submitted = bool(attempt and attempt.status in FINAL_ATTEMPT_STATUSES)
    user_score = serialize_attempt_score(attempt) if is_submitted else None
    breakdown = await get_user_assessment_breakdown(db, current_user.id, assessment.id)

    team = None
    team_summary = None
    if current_user.team_id:
        team = (await db.execute(select(Team).where(Team.id == current_user.team_id))).scalar_one_or_none()
        team_summary = await calculate_team_average(db, current_user.team_id, assessment.id)

    return {
        "submitted": is_submitted,
        "attempt_status": attempt.status if attempt else "not_started",
        "qualified_for_round2": bool(team and team.is_promoted_to_r2),
        "cutoff_percent": DEFAULT_ROUND2_CUTOFF_PERCENT,
        "user_score": user_score,
        "breakdown": breakdown,
        "team": {
            "id": team.id,
            "name": team.name,
            "average_percent": team_summary["team_average"],
            "member_count": team_summary["member_count"],
        } if team and team_summary else None,
    }


@router.post("/submit")
async def submit_assessment(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only participants can submit assessments.")
    await ensure_phase_active(db, "round1", "Round 1 assessment submission is not active.")
    if not current_user.team_id:
        raise HTTPException(status_code=400, detail="You must be on a team before submitting Round 1.")

    assessment = await get_round1_assessment(db)
    attempt = await ensure_assessment_attempt_is_editable(db, current_user.id, assessment.id)
    user_score = await calculate_user_assessment_score(db, current_user.id, assessment.id)

    attempt.status = "evaluated"
    attempt.submitted_at = datetime.utcnow()
    attempt.total_score = user_score["total_score"]
    attempt.max_score = user_score["max_score"]
    attempt.percentage = user_score["percentage"]

    team_summary = await calculate_team_average(db, current_user.team_id, assessment.id)

    team = (await db.execute(select(Team).where(Team.id == current_user.team_id))).scalar_one()
    was_promoted = team.is_promoted_to_r2
    team.is_promoted_to_r2 = team_summary["team_average"] >= DEFAULT_ROUND2_CUTOFF_PERCENT
    team_members = []
    if team.is_promoted_to_r2 and not was_promoted:
        team_members = list((await db.execute(
            select(User).where(User.team_id == team.id, User.role == RoleEnum.participant)
        )).scalars().all())
    await db.commit()

    for member in team_members:
        background_tasks.add_task(
            send_round1_qualified_email,
            member.email,
            member.username,
            team.name,
            team_summary["team_average"],
        )

    return {
        "message": "Assessment submitted and evaluated.",
        "qualified_for_round2": team.is_promoted_to_r2,
        "cutoff_percent": DEFAULT_ROUND2_CUTOFF_PERCENT,
        "user_score": user_score,
        "team_average_percent": team_summary["team_average"],
        "member_scores": team_summary["member_scores"],
    }


@router.delete("/dev-reset")
async def reset_my_assessment_for_dev(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.ENABLE_DEV_ROUTES:
        raise HTTPException(status_code=404, detail="Not found.")

    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only participants can reset their assessment.")

    await db.execute(delete(CodingSubmission).where(CodingSubmission.user_id == current_user.id))
    await db.execute(delete(MCQSubmission).where(MCQSubmission.user_id == current_user.id))
    await db.execute(delete(AssessmentAttempt).where(AssessmentAttempt.user_id == current_user.id))

    if current_user.team_id:
        team = (await db.execute(select(Team).where(Team.id == current_user.team_id))).scalar_one_or_none()
        if team:
            team.is_promoted_to_r2 = False

    await db.commit()

    return {"message": "Your Round 1 submissions and development promotion state were reset."}
