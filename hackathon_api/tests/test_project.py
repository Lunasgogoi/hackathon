import pytest


pytestmark = pytest.mark.asyncio


PROJECT_PAYLOAD = {
    "title": "HackCore Project",
    "description": "A project submission",
    "repo_url": "https://example.com/repo",
    "video_demo_url": "https://example.com/demo",
    "tech_stack": "FastAPI, React",
}


async def test_non_promoted_team_cannot_submit_project(
    client,
    set_phase,
    create_user,
    create_team,
    auth_headers,
):
    await set_phase("round2", "active")
    participant = await create_user(username="not-promoted")
    await create_team(name="Not Promoted", captain=participant, promoted=False)
    headers = await auth_headers("not-promoted")

    response = await client.post(
        "/api/v1/projects/submit",
        headers=headers,
        json=PROJECT_PAYLOAD,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Your team did not qualify for Round 2."


async def test_promoted_team_can_submit_project_once(
    client,
    set_phase,
    create_user,
    create_team,
    auth_headers,
    monkeypatch,
):
    await set_phase("round2", "active")
    participant = await create_user(username="promoted")
    await create_team(name="Promoted", captain=participant, promoted=True)
    headers = await auth_headers("promoted")
    monkeypatch.setattr("app.api.project.send_project_submitted_email", lambda *args, **kwargs: None)

    response = await client.post(
        "/api/v1/projects/submit",
        headers=headers,
        json=PROJECT_PAYLOAD,
    )

    assert response.status_code == 201
    assert response.json()["message"] == "Project submitted successfully. Your team is now under final review."


async def test_promoted_team_member_cannot_submit_project(
    client,
    db_session,
    set_phase,
    create_user,
    create_team,
    auth_headers,
):
    await set_phase("round2", "active")
    captain = await create_user(username="captain-submitter")
    member = await create_user(username="member-submitter")
    team = await create_team(name="Leader Submit Only", captain=captain, promoted=True)
    member.team_id = team.id
    await db_session.commit()
    headers = await auth_headers("member-submitter")

    response = await client.post(
        "/api/v1/projects/submit",
        headers=headers,
        json=PROJECT_PAYLOAD,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only team leaders can submit the project."


async def test_duplicate_project_submission_fails(
    client,
    set_phase,
    create_user,
    create_team,
    auth_headers,
    monkeypatch,
):
    await set_phase("round2", "active")
    participant = await create_user(username="duplicate-project")
    await create_team(name="Duplicate Team", captain=participant, promoted=True)
    headers = await auth_headers("duplicate-project")
    monkeypatch.setattr("app.api.project.send_project_submitted_email", lambda *args, **kwargs: None)

    first_response = await client.post(
        "/api/v1/projects/submit",
        headers=headers,
        json=PROJECT_PAYLOAD,
    )
    second_response = await client.post(
        "/api/v1/projects/submit",
        headers=headers,
        json={**PROJECT_PAYLOAD, "title": "Another Project"},
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 400
    assert second_response.json()["detail"] == "Your team has already submitted a project."


async def test_judge_can_evaluate_submitted_project(
    client,
    create_user,
    create_team,
    create_project,
    auth_headers,
    monkeypatch,
):
    participant = await create_user(username="project-owner")
    team = await create_team(name="Judged Team", captain=participant, promoted=True)
    project = await create_project(team=team)
    await create_user(username="judge-one", role="judge")
    headers = await auth_headers("judge-one")
    monkeypatch.setattr("app.api.project.send_project_judged_email", lambda *args, **kwargs: None)

    response = await client.post(
        "/api/v1/projects/evaluate",
        headers=headers,
        json={
            "project_id": project.id,
            "ui_ux_score": 8,
            "technical_complexity": 9,
            "innovation": 10,
            "feedback": "Strong build",
        },
    )

    assert response.status_code == 200
    assert response.json()["total_score"] == 27


async def test_same_judge_cannot_evaluate_same_project_twice(
    client,
    create_user,
    create_team,
    create_project,
    auth_headers,
):
    participant = await create_user(username="project-owner-two")
    team = await create_team(name="Twice Team", captain=participant, promoted=True)
    project = await create_project(team=team)
    await create_user(username="judge-two", role="judge")
    headers = await auth_headers("judge-two")
    payload = {
        "project_id": project.id,
        "ui_ux_score": 7,
        "technical_complexity": 8,
        "innovation": 9,
        "feedback": "Good",
    }

    first_response = await client.post("/api/v1/projects/evaluate", headers=headers, json=payload)
    second_response = await client.post("/api/v1/projects/evaluate", headers=headers, json=payload)

    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert second_response.json()["detail"] == "You have already evaluated this project."
