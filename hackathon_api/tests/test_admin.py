import pytest


pytestmark = pytest.mark.asyncio


async def test_normal_admin_can_update_phase(client, create_user, auth_headers):
    await create_user(username="phase-admin", role="admin")
    headers = await auth_headers("phase-admin")

    response = await client.post(
        "/api/v1/admin/phase",
        headers=headers,
        json={"phase_name": "round1", "status": "active"},
    )

    assert response.status_code == 200
    assert response.json()["phase"] == "round1"
    assert response.json()["new_status"] == "active"


async def test_master_admin_can_create_privileged_user(
    client,
    create_user,
    auth_headers,
    monkeypatch,
):
    await create_user(username="master", role="admin", is_master_admin=True)
    headers = await auth_headers("master")
    monkeypatch.setattr("app.api.admin.send_privileged_user_created_email", lambda *args, **kwargs: None)

    response = await client.post(
        "/api/v1/admin/users",
        headers=headers,
        json={
            "username": "new-judge",
            "email": "new-judge@example.com",
            "password": "Password123!",
            "role": "judge",
        },
    )

    assert response.status_code == 201
    assert response.json()["user"]["role"] == "judge"
    assert response.json()["user"]["is_master_admin"] is False


async def test_non_master_admin_cannot_create_privileged_user(client, create_user, auth_headers):
    await create_user(username="plain-admin", role="admin", is_master_admin=False)
    headers = await auth_headers("plain-admin")

    response = await client.post(
        "/api/v1/admin/users",
        headers=headers,
        json={
            "username": "blocked-judge",
            "email": "blocked-judge@example.com",
            "password": "Password123!",
            "role": "judge",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only the master admin can manage admin and judge accounts."


async def test_non_admin_cannot_call_admin_endpoints(client, create_user, auth_headers):
    await create_user(username="participant-user")
    headers = await auth_headers("participant-user")

    response = await client.post(
        "/api/v1/admin/phase",
        headers=headers,
        json={"phase_name": "round1", "status": "active"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "You do not have permission to perform this action."
