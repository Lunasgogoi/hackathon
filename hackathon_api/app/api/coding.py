import asyncio
import httpx
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.user import User, RoleEnum
from app.models.coding import CodingSubmission, CodingProblem, TestCase, SubmissionStatus
from app.schemas.coding import CodeSubmitRequest
from app.api.deps import get_db, get_current_user
from app.api.assessment import ensure_assessment_attempt_is_editable

router = APIRouter(prefix="/coding", tags=["Coding Round"])

# Piston Public API (Rate limited, but great for dev. Self-host for prod!)
PISTON_URL = "https://emkc.org/api/v2/piston/execute"

# Map frontend IDs to Piston language identifiers
LANGUAGE_MAP = {
    71: {"language": "python", "version": "3.10.0", "local": "python"},
    54: {"language": "c++", "version": "10.2.0", "local": "cpp"},
    63: {"language": "javascript", "version": "18.15.0", "local": "javascript"}
}


def output_matches(actual_output: str, expected_output: str) -> bool:
    if actual_output == expected_output:
        return True

    expected_normalized = expected_output.strip().lower()
    actual_normalized = actual_output.strip().lower()

    if expected_normalized in {"true", "false"}:
        boolean_aliases = {
            "true": {"true", "1"},
            "false": {"false", "0"},
        }
        return actual_normalized in boolean_aliases[expected_normalized]

    return False


async def _run_process(command: list[str], stdin: str, timeout_seconds: float) -> dict:
    try:
        completed = await asyncio.to_thread(
            subprocess.run,
            command,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            encoding="utf-8",
            errors="replace",
        )
    except subprocess.TimeoutExpired:
        return {
            "code": 124,
            "stdout": "",
            "stderr": "Time limit exceeded",
            "output": "Time limit exceeded",
        }

    return {
        "code": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "output": completed.stderr or completed.stdout,
    }


async def run_code_locally(lang_config: dict, source_code: str, stdin: str, timeout_seconds: float) -> dict:
    local_language = lang_config["local"]

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        if local_language == "python":
            source_path = temp_path / "solution.py"
            source_path.write_text(source_code, encoding="utf-8")
            run = await _run_process([sys.executable, str(source_path)], stdin, timeout_seconds)
            return {"compile": {"code": 0, "output": ""}, "run": run}

        if local_language == "javascript":
            node_path = shutil.which("node")
            if not node_path:
                return {
                    "compile": {"code": 1, "output": "Node.js is not installed on the server."},
                    "run": {},
                }

            source_path = temp_path / "solution.js"
            source_path.write_text(source_code, encoding="utf-8")
            run = await _run_process([node_path, str(source_path)], stdin, timeout_seconds)
            return {"compile": {"code": 0, "output": ""}, "run": run}

        if local_language == "cpp":
            compiler_path = shutil.which("g++")
            if not compiler_path:
                return {
                    "compile": {"code": 1, "output": "g++ is not installed on the server."},
                    "run": {},
                }

            source_path = temp_path / "solution.cpp"
            output_path = temp_path / "solution.exe"
            source_path.write_text(source_code, encoding="utf-8")
            compile_result = await _run_process(
                [compiler_path, str(source_path), "-O2", "-std=c++17", "-o", str(output_path)],
                "",
                10,
            )
            if compile_result["code"] != 0:
                return {"compile": compile_result, "run": {}}

            run = await _run_process([str(output_path)], stdin, timeout_seconds)
            return {"compile": {"code": 0, "output": ""}, "run": run}

    return {"compile": {"code": 1, "output": "Unsupported local language."}, "run": {}}

@router.post("/submit")
async def submit_code(
    request: CodeSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only participants can submit code.")

    # 1. Verify problem & fetch test cases
    problem = (await db.execute(select(CodingProblem).where(CodingProblem.id == request.problem_id))).scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    await ensure_assessment_attempt_is_editable(db, current_user.id, problem.assessment_id)

    test_cases = (await db.execute(
        select(TestCase).where(TestCase.problem_id == problem.id).order_by(TestCase.id)
    )).scalars().all()
    if not test_cases:
        raise HTTPException(status_code=500, detail="No test cases configured.")

    # 2. Get Piston language config
    lang_config = LANGUAGE_MAP.get(request.language_id)
    if not lang_config:
        raise HTTPException(status_code=400, detail="Unsupported language ID")

    # 3. Create the initial submission record
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

    # 4. Execute every configured test case.
    case_results = []
    async with httpx.AsyncClient() as client:
        for test_case in test_cases:
            payload = {
                "language": lang_config["language"],
                "version": lang_config["version"],
                "files": [{"content": request.source_code}],
                "stdin": test_case.stdin,
                "compile_timeout": 10000,
                "run_timeout": int(problem.time_limit_seconds * 1000),
            }

            try:
                response = await client.post(PISTON_URL, json=payload, timeout=15.0)
                response.raise_for_status()
                result = response.json()
            except httpx.HTTPError:
                try:
                    result = await run_code_locally(
                        lang_config,
                        request.source_code,
                        test_case.stdin,
                        problem.time_limit_seconds,
                    )
                except Exception as exc:
                    result = {
                        "compile": {
                            "code": 1,
                            "output": f"Local execution failed: {exc}",
                        },
                        "run": {},
                    }

            compile_result = result.get("compile", {})
            run_result = result.get("run", {})
            expected_output = test_case.expected_stdout.strip()

            if compile_result.get("code") != 0 and compile_result.get("code") is not None:
                case_status = SubmissionStatus.error
                actual_output = compile_result.get("output", "Compilation Error")
            elif run_result.get("code") == 124:
                case_status = SubmissionStatus.time_limit
                actual_output = run_result.get("output", "Time limit exceeded")
            elif run_result.get("code") != 0:
                case_status = SubmissionStatus.error
                actual_output = run_result.get("output", "Runtime Error")
            else:
                actual_output = run_result.get("stdout", "").strip()
                case_status = (
                    SubmissionStatus.accepted
                    if output_matches(actual_output, expected_output)
                    else SubmissionStatus.wrong_answer
                )

            case_results.append({
                "id": test_case.id,
                "hidden": test_case.is_hidden,
                "passed": case_status == SubmissionStatus.accepted,
                "status": case_status,
                "input": test_case.stdin,
                "expected": test_case.expected_stdout,
                "output": actual_output,
            })

            if case_status in {SubmissionStatus.error, SubmissionStatus.time_limit}:
                break

    failed_result = next((case for case in case_results if not case["passed"]), None)
    if failed_result:
        submission.status = failed_result["status"]
    else:
        submission.status = SubmissionStatus.accepted

    # 7. Update Database and Return immediately to the frontend
    await db.commit()

    visible_results = []
    for index, result in enumerate(case_results, start=1):
        if result["hidden"]:
            visible_results.append({
                "id": index,
                "passed": result["passed"],
                "input": "Hidden test",
                "expected": "-",
                "output": "Passed" if result["passed"] else result["status"].value,
            })
        else:
            visible_results.append({
                "id": index,
                "passed": result["passed"],
                "input": result["input"],
                "expected": result["expected"],
                "output": result["output"],
            })

    return {
        "status": submission.status.value,
        "passed_cases": sum(1 for result in case_results if result["passed"]),
        "total_cases": len(test_cases),
        "details": visible_results,
    }
