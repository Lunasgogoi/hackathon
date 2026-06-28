import asyncio
import httpx
import subprocess
import tempfile
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.user import User, RoleEnum
from app.models.coding import CodingSubmission, CodingProblem, TestCase, SubmissionStatus
from app.schemas.coding import CodeSubmitRequest
from app.api.deps import ensure_phase_active, get_db, get_current_user
from app.api.assessment import ensure_assessment_attempt_is_editable

router = APIRouter(prefix="/coding", tags=["Coding Round"])

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


def _docker_image_for_language(local_language: str) -> str:
    images = {
        "python": settings.PYTHON_RUNNER_IMAGE,
        "javascript": settings.JAVASCRIPT_RUNNER_IMAGE,
        "cpp": settings.CPP_RUNNER_IMAGE,
    }
    return images[local_language]


def _build_docker_command(
    *,
    image: str,
    workspace: Path,
    container_name: str,
    shell_command: str,
) -> list[str]:
    return [
        "docker",
        "run",
        "--rm",
        "--name",
        container_name,
        "--network",
        "none",
        "--memory",
        settings.CODE_RUNNER_MEMORY_LIMIT,
        "--cpus",
        settings.CODE_RUNNER_CPUS,
        "--pids-limit",
        str(settings.CODE_RUNNER_PIDS_LIMIT),
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--read-only",
        "--tmpfs",
        f"/tmp:rw,nosuid,size={settings.CODE_RUNNER_TMPFS_SIZE}",
        "-i",
        "-v",
        f"{workspace}:/workspace:rw",
        "-w",
        "/workspace",
        image,
        "sh",
        "-lc",
        shell_command,
    ]


async def _run_docker_command(
    *,
    image: str,
    workspace: Path,
    shell_command: str,
    stdin: str,
    timeout_seconds: float,
) -> dict:
    container_name = f"hackcore-code-{uuid.uuid4().hex}"
    command = _build_docker_command(
        image=image,
        workspace=workspace,
        container_name=container_name,
        shell_command=shell_command,
    )

    try:
        return await _run_process(command, stdin, timeout_seconds)
    except FileNotFoundError:
        return {
            "code": 1,
            "stdout": "",
            "stderr": "Docker is not installed or is not available to the API process.",
            "output": "Docker is not installed or is not available to the API process.",
        }
    finally:
        try:
            await asyncio.to_thread(
                subprocess.run,
                ["docker", "rm", "-f", container_name],
                capture_output=True,
                text=True,
            )
        except FileNotFoundError:
            pass


async def run_code_in_docker(lang_config: dict, source_code: str, stdin: str, timeout_seconds: float) -> dict:
    local_language = lang_config["local"]
    image = _docker_image_for_language(local_language)

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        if local_language == "python":
            (temp_path / "solution.py").write_text(source_code, encoding="utf-8")
            run = await _run_docker_command(
                image=image,
                workspace=temp_path,
                shell_command="python /workspace/solution.py",
                stdin=stdin,
                timeout_seconds=timeout_seconds,
            )
            return {"compile": {"code": 0, "output": ""}, "run": run}

        if local_language == "javascript":
            (temp_path / "solution.js").write_text(source_code, encoding="utf-8")
            run = await _run_docker_command(
                image=image,
                workspace=temp_path,
                shell_command="node /workspace/solution.js",
                stdin=stdin,
                timeout_seconds=timeout_seconds,
            )
            return {"compile": {"code": 0, "output": ""}, "run": run}

        if local_language == "cpp":
            (temp_path / "solution.cpp").write_text(source_code, encoding="utf-8")
            compile_result = await _run_docker_command(
                image=image,
                workspace=temp_path,
                shell_command="g++ /workspace/solution.cpp -O2 -std=c++17 -o /workspace/solution",
                stdin="",
                timeout_seconds=settings.CODE_RUNNER_COMPILE_TIMEOUT_SECONDS,
            )
            if compile_result["code"] != 0:
                return {"compile": compile_result, "run": {}}

            run = await _run_docker_command(
                image=image,
                workspace=temp_path,
                shell_command="/workspace/solution",
                stdin=stdin,
                timeout_seconds=timeout_seconds,
            )
            return {"compile": {"code": 0, "output": ""}, "run": run}

    return {"compile": {"code": 1, "output": "Unsupported Docker language."}, "run": {}}


async def execute_code(lang_config: dict, source_code: str, stdin: str, timeout_seconds: float) -> dict:
    if settings.USE_PISTON_CODE_RUNNER:
        payload = {
            "language": lang_config["language"],
            "version": lang_config["version"],
            "files": [{"content": source_code}],
            "stdin": stdin,
            "compile_timeout": 10000,
            "run_timeout": int(timeout_seconds * 1000),
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(settings.PISTON_EXECUTE_URL, json=payload, timeout=15.0)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Piston code runner is unavailable: {exc}",
            ) from exc

    try:
        return await run_code_in_docker(
            lang_config,
            source_code,
            stdin,
            timeout_seconds,
        )
    except Exception as exc:
        return {
            "compile": {
                "code": 1,
                "output": f"Docker execution failed: {exc}",
            },
            "run": {},
        }

@router.post("/submit")
async def submit_code(
    request: CodeSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only participants can submit code.")
    await ensure_phase_active(db, "round1", "Code submissions are only allowed while Round 1 is active.")

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
    for test_case in test_cases:
        try:
            result = await execute_code(
                lang_config,
                request.source_code,
                test_case.stdin,
                problem.time_limit_seconds,
            )
        except HTTPException:
            submission.status = SubmissionStatus.error
            await db.commit()
            raise

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
