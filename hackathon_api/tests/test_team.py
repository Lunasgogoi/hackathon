import pytest


pytestmark = pytest.mark.asyncio


async def test_participant_creates_team_during_registration(
    client,
    set_phase,
    create_user,
    auth_headers,
):
    await set_phase("registration", "active")
    await create_user(username="captain")
    headers = await auth_headers("captain")

    response = await client.post(
        "/api/v1/teams/create",
        headers=headers,
        json={
            "name": "Builders",
            "description": "Build team",
            "max_members": 4,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["team"]["name"] == "Builders"
    assert payload["team"]["member_count"] == 1
    assert payload["team"]["invite_code"]


async def test_participant_joins_team_by_invite_code(
    client,
    set_phase,
    create_user,
    create_team,
    auth_headers,
):
    await set_phase("registration", "active")
    captain = await create_user(username="team-captain")
    await create_team(name="Joinable", invite_code="JOINME", captain=captain)
    await create_user(username="joiner")
    headers = await auth_headers("joiner")

    response = await client.post(
        "/api/v1/teams/join",
        headers=headers,
        json={"invite_code": "joinme"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["team"]["name"] == "Joinable"
    assert payload["team"]["member_count"] == 2


async def test_team_payload_marks_leader_and_backfills_missing_captain(
    client,
    db_session,
    create_user,
    create_team,
    auth_headers,
):
    first_member = await create_user(username="legacy-first")
    second_member = await create_user(username="legacy-second")
    team = await create_team(name="Legacy Team", captain=None)
    first_member.team_id = team.id
    second_member.team_id = team.id
    await db_session.commit()
    headers = await auth_headers("legacy-first")

    response = await client.get("/api/v1/teams/me", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["current_user"]["is_captain"] is True
    assert payload["team"]["captain_id"] == first_member.id
    assert payload["team"]["members"][0]["is_captain"] is True
    assert payload["team"]["members"][1]["is_captain"] is False


async def test_team_creation_fails_outside_registration(
    client,
    set_phase,
    create_user,
    auth_headers,
):
    await set_phase("registration", "completed")
    await create_user(username="late-captain")
    headers = await auth_headers("late-captain")

    response = await client.post(
        "/api/v1/teams/create",
        headers=headers,
        json={"name": "Too Late", "max_members": 4},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Teams can only be created during registration."


async def test_team_join_fails_outside_registration(
    client,
    set_phase,
    create_user,
    create_team,
    auth_headers,
):
    await set_phase("registration", "completed")
    captain = await create_user(username="closed-captain")
    await create_team(name="Closed Join", invite_code="CLOSED", captain=captain)
    await create_user(username="closed-joiner")
    headers = await auth_headers("closed-joiner")

    response = await client.post(
        "/api/v1/teams/join",
        headers=headers,
        json={"invite_code": "CLOSED"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Teams can only be joined during registration."


async def test_full_team_cannot_be_joined(
    client,
    set_phase,
    create_user,
    create_team,
    auth_headers,
):
    await set_phase("registration", "active")
    captain = await create_user(username="full-captain")
    await create_team(name="Full Team", invite_code="FULLUP", max_members=1, captain=captain)
    extra = await create_user(username="extra")
    headers = await auth_headers(extra.username)

    response = await client.post(
        "/api/v1/teams/join",
        headers=headers,
        json={"invite_code": "FULLUP"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "This team is already full."
