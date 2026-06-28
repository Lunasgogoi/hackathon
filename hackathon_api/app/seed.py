import asyncio
import json
from sqlalchemy import delete, select
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
import app.models  # noqa: F401 - register all SQLAlchemy models for relationships
from app.models.assessment import Assessment
from app.models.coding import CodingProblem, TestCase
from app.models.mcq import MCQQuestion
from app.models.user import RoleEnum, User

ASSESSMENT_TITLE = "Round 1: Online Assessment"
SEEDED_CODING_PROBLEM_IDS = [1, 3]
SEEDED_MCQ_QUESTION_IDS = [2]

COUNTING_TRIPLETS_STARTERS = {
    "Python 3": """import sys


def solve(arr, d):
    count = 0
    # Write your solution here
    return count


if __name__ == "__main__":
    data = sys.stdin.read().strip().split()
    n = int(data[0])
    arr = list(map(int, data[1:1 + n]))
    d = int(data[1 + n])
    print(solve(arr, d))""",
    "JavaScript": """const fs = require('fs');
const data = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);

const n = data[0];
const arr = data.slice(1, 1 + n);
const d = data[1 + n];

function solve(arr, d) {
  let count = 0;
  // Write your solution here
  return count;
}

console.log(solve(arr, d));""",
    "C++": """#include <bits/stdc++.h>
using namespace std;

long long solve(vector<int>& arr, int d) {
    long long count = 0;
    // Write your solution here
    return count;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    vector<int> arr(n);
    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }

    int d;
    cin >> d;

    cout << solve(arr, d) << '\\n';
    return 0;
}""",
}

VALID_PALINDROME_STARTERS = {
    "Python 3": """import sys


def solve(s):
    # Write your solution here
    return "false"


if __name__ == "__main__":
    s = sys.stdin.read().strip()
    print(solve(s))""",
    "JavaScript": """const fs = require('fs');
const s = fs.readFileSync(0, 'utf8').trim();

function solve(s) {
  // Write your solution here
  return 'false';
}

console.log(solve(s));""",
    "C++": """#include <bits/stdc++.h>
using namespace std;

string solve(string s) {
    // Write your solution here
    return "false";
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string s;
    getline(cin, s);

    cout << solve(s) << '\\n';
    return 0;
}""",
}

async def seed_database():
    print("Starting database seed process for the decoupled architecture...")
    async with SessionLocal() as db:
        if settings.MASTER_ADMIN_USERNAME and settings.MASTER_ADMIN_EMAIL and settings.MASTER_ADMIN_PASSWORD:
            master_admin = (await db.execute(
                select(User).where(User.username == settings.MASTER_ADMIN_USERNAME)
            )).scalar_one_or_none()

            if master_admin:
                master_admin.email = settings.MASTER_ADMIN_EMAIL
                master_admin.role = RoleEnum.admin
                master_admin.is_master_admin = True
                master_admin.hashed_password = get_password_hash(settings.MASTER_ADMIN_PASSWORD)
                print(f"Updated master admin: {settings.MASTER_ADMIN_USERNAME}")
            else:
                db.add(User(
                    username=settings.MASTER_ADMIN_USERNAME,
                    email=settings.MASTER_ADMIN_EMAIL,
                    hashed_password=get_password_hash(settings.MASTER_ADMIN_PASSWORD),
                    role=RoleEnum.admin,
                    is_master_admin=True,
                ))
                print(f"Created master admin: {settings.MASTER_ADMIN_USERNAME}")
        else:
            print("Master admin seed skipped. Set MASTER_ADMIN_USERNAME, MASTER_ADMIN_EMAIL, and MASTER_ADMIN_PASSWORD to create one.")

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
            starter_code=json.dumps(COUNTING_TRIPLETS_STARTERS),
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
            starter_code=json.dumps(VALID_PALINDROME_STARTERS),
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
