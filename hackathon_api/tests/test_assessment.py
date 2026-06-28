import pytest
from sqlalchemy import select

from app.models.mcq import MCQSubmission


pytestmark = pytest.mark.asyncio


async def test_current_assessment_is_blocked_when_round1_is_locked(
    client,
    set_phase,
    create_user,
    auth_headers,
):
    await set_phase("round1", "locked")
    await create_user(username="blocked-participant")
    headers = await auth_headers("blocked-participant")

    response = await client.get("/api/v1/assessment/current", headers=headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Round 1 assessment is not active."


async def test_mcq_answer_is_saved_and_can_be_updated_before_submission(
    client,
    db_session,
    set_phase,
    create_user,
    create_round1_assessment,
    auth_headers,
):
    await set_phase("round1", "active")
    assessment_data = await create_round1_assessment()
    mcq = assessment_data["mcq"]
    await create_user(username="mcq-user")
    headers = await auth_headers("mcq-user")

    first_response = await client.post(
        "/api/v1/mcq/submit",
        headers=headers,
        json={"question_id": mcq.id, "selected_option": "B"},
    )
    second_response = await client.post(
        "/api/v1/mcq/submit",
        headers=headers,
        json={"question_id": mcq.id, "selected_option": "A"},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    submissions = (
        await db_session.execute(select(MCQSubmission).where(MCQSubmission.question_id == mcq.id))
    ).scalars().all()
    assert len(submissions) == 1
    assert submissions[0].selected_option == "A"
    assert submissions[0].is_correct is True


async def test_coding_submission_uses_mocked_code_runner(
    client,
    set_phase,
    create_user,
    create_round1_assessment,
    auth_headers,
    monkeypatch,
):
    await set_phase("round1", "active")
    assessment_data = await create_round1_assessment()
    problem = assessment_data["problem"]
    await create_user(username="coder")
    headers = await auth_headers("coder")
    calls = []

    async def fake_execute_code(lang_config, source_code, stdin, timeout_seconds):
        calls.append(stdin)
        return {
            "compile": {"code": 0, "output": ""},
            "run": {"code": 0, "stdout": stdin, "output": stdin},
        }

    monkeypatch.setattr("app.api.coding.execute_code", fake_execute_code)

    response = await client.post(
        "/api/v1/coding/submit",
        headers=headers,
        json={
            "problem_id": problem.id,
            "source_code": "print(input())",
            "language_id": 71,
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    assert calls == ["hello", "world"]


async def test_assessment_submit_calculates_score_and_locks_later_edits(
    client,
    set_phase,
    create_user,
    create_team,
    create_round1_assessment,
    auth_headers,
    monkeypatch,
):
    await set_phase("round1", "active")
    participant = await create_user(username="finisher")
    await create_team(name="Finishers", captain=participant)
    assessment_data = await create_round1_assessment()
    problem = assessment_data["problem"]
    mcq = assessment_data["mcq"]
    headers = await auth_headers("finisher")
    monkeypatch.setattr("app.core.email.send_round1_qualified_email", lambda *args, **kwargs: None)
    monkeypatch.setattr("app.api.assessment.send_round1_qualified_email", lambda *args, **kwargs: None)

    async def fake_execute_code(lang_config, source_code, stdin, timeout_seconds):
        return {
            "compile": {"code": 0, "output": ""},
            "run": {"code": 0, "stdout": stdin, "output": stdin},
        }

    monkeypatch.setattr("app.api.coding.execute_code", fake_execute_code)
    await client.post(
        "/api/v1/coding/submit",
        headers=headers,
        json={"problem_id": problem.id, "source_code": "ok", "language_id": 71},
    )
    await client.post(
        "/api/v1/mcq/submit",
        headers=headers,
        json={"question_id": mcq.id, "selected_option": "A"},
    )

    response = await client.post("/api/v1/assessment/submit", headers=headers)
    edit_response = await client.post(
        "/api/v1/mcq/submit",
        headers=headers,
        json={"question_id": mcq.id, "selected_option": "B"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_score"]["total_score"] == 60
    assert payload["team_average_percent"] == 100
    assert edit_response.status_code == 400
    assert edit_response.json()["detail"] == "This assessment has already been submitted and cannot be changed."


async def test_dev_reset_returns_404_by_default(client, create_user, auth_headers):
    await create_user(username="dev-reset-user")
    headers = await auth_headers("dev-reset-user")

    response = await client.delete("/api/v1/assessment/dev-reset", headers=headers)

    assert response.status_code == 404
