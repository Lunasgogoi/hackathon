from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.models.mcq import MCQQuestion, MCQSubmission # Updated import
from app.models.user import User, RoleEnum
from app.schemas.coding import MCQSubmitRequest
from app.api.deps import ensure_phase_active, get_current_user
from app.api.assessment import ensure_assessment_attempt_is_editable

router = APIRouter(prefix="/mcq", tags=["MCQ Round"])

@router.post("/submit")
async def submit_mcq(
    request: MCQSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only participants can submit.")
    await ensure_phase_active(db, "round1", "MCQ submissions are only allowed while Round 1 is active.")

    # 1. Fetch the question
    result = await db.execute(select(MCQQuestion).where(MCQQuestion.id == request.question_id))
    question = result.scalar_one_or_none()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    await ensure_assessment_attempt_is_editable(db, current_user.id, question.assessment_id)

    # 2. Check if user already submitted an answer for this question
    existing_sub = await db.execute(
        select(MCQSubmission).where(
            MCQSubmission.user_id == current_user.id,
            MCQSubmission.question_id == question.id
        )
    )
    existing_submission = existing_sub.scalar_one_or_none()

    # 3. Validate and Save
    is_correct = request.selected_option.upper() == question.correct_option.upper()

    if existing_submission:
        existing_submission.selected_option = request.selected_option.upper()
        existing_submission.is_correct = is_correct
    else:
        submission = MCQSubmission(
            user_id=current_user.id,
            question_id=question.id,
            selected_option=request.selected_option.upper(),
            is_correct=is_correct
        )
        db.add(submission)

    await db.commit()

    return {
        "question_id": request.question_id,
        "selected_option": request.selected_option.upper(),
        "message": "Answer saved."
    }
