import asyncio
import json
from sqlalchemy import delete
from app.db.session import SessionLocal
import app.models  # noqa: F401 - register all SQLAlchemy models for relationships
from app.models.assessment import Assessment
from app.models.coding import CodingProblem, TestCase
from app.models.mcq import MCQQuestion

ASSESSMENT_TITLE = "Round 1: Online Assessment"
SEEDED_CODING_PROBLEM_IDS = [1, 3]
SEEDED_MCQ_QUESTION_IDS = [2]

async def seed_database():
    print("Starting database seed process for the decoupled architecture...")
    async with SessionLocal() as db:
        await db.execute(
            delete(TestCase).where(TestCase.problem_id.in_(SEEDED_CODING_PROBLEM_IDS))
        )
        await db.execute(
            delete(CodingProblem).where(CodingProblem.id.in_(SEEDED_CODING_PROBLEM_IDS))
        )
        await db.execute(
            delete(MCQQuestion).where(MCQQuestion.id.in_(SEEDED_MCQ_QUESTION_IDS))
        )
        await db.execute(delete(Assessment).where(Assessment.title == ASSESSMENT_TITLE))
        await db.flush()
        
        # ---------------------------------------------------------
        # 1. Create the Parent Assessment
        # ---------------------------------------------------------
        assessment = Assessment(
            title=ASSESSMENT_TITLE,
            description="A hybrid assessment containing algorithmic coding challenges and multiple-choice questions."
        )
        db.add(assessment)
        await db.flush() # Generates the assessment.id

        # ---------------------------------------------------------
        # QUESTION 1 (CODING): Counting Triplets (Forced ID: 1)
        # ---------------------------------------------------------
        q1 = CodingProblem(
            id=1,
            assessment_id=assessment.id,
            title="Counting Triplets",
            description="Given an integer array arr[n] and an integer d, count the number of distinct triplets (i, j, k) where:\n- 0 <= i < j < k < n\n- The sum arr[i] + arr[j] + arr[k] is divisible by d",
            time_limit_seconds=2.0,
            memory_limit_mb=128
        )
        db.add(q1)

        tc1 = TestCase(
            problem_id=1,
            stdin="5\n3 3 4 7 8\n5", 
            expected_stdout="3",
            is_hidden=False
        )
        db.add(tc1)
        print("Created Question 1 (Coding) - Counting Triplets")

        # ---------------------------------------------------------
        # QUESTION 2 (MCQ): Algorithmic Complexity (Forced ID: 2)
        # ---------------------------------------------------------
        mcq_options = {
            "A": "O(1)",
            "B": "O(log n)",
            "C": "O(n)",
            "D": "O(n log n)"
        }
        
        mcq1 = MCQQuestion(
            id=2,
            assessment_id=assessment.id,
            question_text="In a heavily unbalanced binary search tree, what is the worst-case time complexity for a search operation?",
            options=json.dumps(mcq_options),
            correct_option="C"
        )
        db.add(mcq1)
        print("Created Question 2 (MCQ) - Time Complexity")

        # ---------------------------------------------------------
        # QUESTION 3 (CODING): Valid Palindrome (Forced ID: 3)
        # ---------------------------------------------------------
        q3 = CodingProblem(
            id=3,
            assessment_id=assessment.id,
            title="Valid Palindrome",
            description="Determine if a given string is a valid palindrome, ignoring non-alphanumeric characters.",
            time_limit_seconds=2.0,
            memory_limit_mb=128
        )
        db.add(q3)

        tc3 = TestCase(
            problem_id=3,
            stdin="A man, a plan, a canal: Panama",
            expected_stdout="true", 
            is_hidden=False
        )
        db.add(tc3)
        print("Created Question 3 (Coding) - Valid Palindrome")

        # Commit all changes to the database
        await db.commit()
        print("Database successfully seeded!")

if __name__ == "__main__":
    asyncio.run(seed_database())
