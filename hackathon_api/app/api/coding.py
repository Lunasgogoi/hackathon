# app/api/coding.py
import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import SessionLocal
from app.models.user import User
from app.models.coding import CodingSubmission, CodingProblem, SubmissionStatus
from app.schemas.coding import CodeSubmitRequest, Judge0WebhookResponse

# Assuming you brought over get_db and get_current_user from your last project
from app.api.deps import get_db, get_current_user

router = APIRouter(prefix="/coding", tags=["Coding Round"])

JUDGE0_URL = "https://judge0-ce.p.rapidapi.com"
JUDGE0_HEADERS = {
    "X-RapidAPI-Key": "YOUR_RAPIDAPI_KEY",  # You'd put this in your .env file
    "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
    "Content-Type": "application/json",
}

# The URL Judge0 will call when it finishes grading
# In production, this would be your actual domain (e.g., https://api.myhackathon.com/...)
WEBHOOK_URL = "https://YOUR_NGROK_URL/api/v1/coding/webhook"


@router.post("/submit")
async def submit_code(
    request: CodeSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    from app.models.user import RoleEnum

    if current_user.role != RoleEnum.participant:
        raise HTTPException(
            status_code=403, detail="Only official participants can submit code."
        )
    # 1. Verify the problem exists
    problem_check = await db.execute(
        select(CodingProblem).where(CodingProblem.id == request.problem_id)
    )
    problem = problem_check.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # 2. Save the pending submission to the database
    submission = CodingSubmission(
        user_id=current_user.id,
        problem_id=request.problem_id,
        source_code=request.source_code,
        language_id=request.language_id,
        status=SubmissionStatus.pending,
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    # 3. Send payload to Judge0 (Using test case 1 for simplicity here)
    # The 'callback_url' is the magic piece. It tells Judge0 where to send the results.
    judge0_payload = {
        "source_code": request.source_code,
        "language_id": request.language_id,
        "stdin": "2 4",  # Ideally pulled dynamically from your TestCase table
        "expected_output": "6",
        "callback_url": f"{WEBHOOK_URL}?submission_id={submission.id}",
    }

    # async with httpx.AsyncClient() as client:
    #     response = await client.post(
    #         f"{JUDGE0_URL}/submissions/?base64_encoded=false",
    #         json=judge0_payload,
    #         headers=JUDGE0_HEADERS
    #     )

    #     if response.status_code != 201:
    #         # If Judge0 is down, mark as error
    #         submission.status = SubmissionStatus.error
    #         await db.commit()
    #         raise HTTPException(status_code=500, detail="Grading engine offline")
    print(f"MOCK: Sent submission {submission.id} to Judge0!")

    # 4. Return immediately to the user while Judge0 grades in the background
    return {"message": "Code submitted for evaluation!", "submission_id": submission.id}


@router.put("/webhook")
async def judge0_webhook(
    submission_id: int,
    result: Judge0WebhookResponse,
    db: AsyncSession = Depends(get_db),
):
    """
    Judge0 calls this automatically.
    Status ID 3 = Accepted (Pass). Anything else = Fail/Error.
    """
    # Find the pending submission
    db_result = await db.execute(
        select(CodingSubmission).where(CodingSubmission.id == submission_id)
    )
    submission = db_result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Map Judge0 status to our database Enum
    if result.status.id == 3:
        submission.status = SubmissionStatus.accepted
    elif result.status.id == 4:
        submission.status = SubmissionStatus.wrong_answer
    elif result.status.id == 5:
        submission.status = SubmissionStatus.time_limit
    else:
        submission.status = SubmissionStatus.error

    # Save the execution time if it passed
    if result.time:
        submission.execution_time = float(result.time)

    await db.commit()

    # Return 200 so Judge0 knows we received the webhook successfully
    return {"status": "Webhook received and database updated"}
