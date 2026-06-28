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
