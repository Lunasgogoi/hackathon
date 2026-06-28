# HackCore API

FastAPI backend for registration, team formation, Round 1 assessment, Round 2 project submission, judging, leaderboard updates, and certificates.

## Setup

1. Create and activate a virtual environment.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies.

```powershell
pip install -r requirements.txt
```

3. Create `.env` from `.env.example` and set production-safe values.

Required values:

- `SECRET_KEY`: long random secret for JWT signing.
- `DATABASE_URL`: async SQLAlchemy URL, for example `postgresql+asyncpg://user:pass@host:5432/hackathon_db`.
- `BACKEND_CORS_ORIGINS`: comma-separated frontend origins allowed to call the API.
- `APP_PUBLIC_URL`: public frontend URL used in emails.

## Database

Alembic reads `DATABASE_URL` from `app.core.config`, so `.env` controls the migration target.

```powershell
alembic upgrade head
```

Seed the Round 1 assessment data and optional master admin from `.env`.

```powershell
python -m app.seed
```

Create or update only the master admin account:

```powershell
python -m app.create_master_admin
```

## Run

```powershell
uvicorn app.main:app --reload
```

For production, run behind a process manager or container entrypoint without `--reload`.

## Tests

Run the backend test suite:

```powershell
pytest
```

## Code Runner

By default, submissions use the remote Piston API:

```env
USE_PISTON_CODE_RUNNER=true
PISTON_EXECUTE_URL=https://emkc.org/api/v2/piston/execute
```

If `USE_PISTON_CODE_RUNNER=false`, submissions run inside Docker containers with network disabled and resource limits. Docker must be installed on the API host, and these images should be available:

- `PYTHON_RUNNER_IMAGE`
- `JAVASCRIPT_RUNNER_IMAGE`
- `CPP_RUNNER_IMAGE`

Piston failures return `503`; the API does not silently fall back to local execution.

## Deployment Notes

- Set `ENVIRONMENT=production`.
- Keep `ENABLE_DEV_ROUTES=false`; this disables development-only reset endpoints.
- Set `BACKEND_CORS_ORIGINS` to the real deployed frontend origin, not localhost.
- Rotate `SECRET_KEY` before deployment and never commit `.env`.
- Configure SMTP values only if email delivery is required.
