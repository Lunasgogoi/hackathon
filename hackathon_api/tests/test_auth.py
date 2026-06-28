import pytest


pytestmark = pytest.mark.asyncio


async def test_register_succeeds_when_registration_is_active(client, set_phase, monkeypatch):
    await set_phase("registration", "active")
    monkeypatch.setattr("app.api.auth.send_registration_email", lambda *args, **kwargs: None)

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "Password123!",
        },
    )

    assert response.status_code == 201
    assert response.json()["message"] == "User newuser created with role RoleEnum.participant"


async def test_register_fails_when_registration_is_locked(client, set_phase):
    await set_phase("registration", "locked")

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "blocked",
            "email": "blocked@example.com",
            "password": "Password123!",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Registration is currently closed."


async def test_register_rejects_duplicate_username_or_email(client, set_phase, create_user, monkeypatch):
    await set_phase("registration", "active")
    await create_user(username="taken", email="taken@example.com")
    monkeypatch.setattr("app.api.auth.send_registration_email", lambda *args, **kwargs: None)

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "taken",
            "email": "other@example.com",
            "password": "Password123!",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Username or email already registered"


async def test_login_returns_token_and_role(client, create_user):
    await create_user(username="login-user", password="Password123!")

    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "login-user", "password": "Password123!"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["access_token"]
    assert payload["token_type"] == "bearer"
    assert payload["role"] == "participant"
