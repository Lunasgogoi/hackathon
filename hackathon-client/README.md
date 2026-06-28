# HackCore Client

React frontend for the HackCore hackathon platform. It covers participant registration, team management, Round 1 assessment, Round 2 project submission, judge evaluation, admin controls, live leaderboard, and certificate access.

## Setup

Install dependencies:

```powershell
npm install
```

Create `.env` from `.env.example` and point it at the API:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_WS_BASE_URL=ws://127.0.0.1:8000/api/v1
```

`VITE_WS_BASE_URL` is optional. If omitted, the app derives the websocket URL from `VITE_API_BASE_URL`.

## Run

Start the local development server:

```powershell
npm run dev
```

Create a production build:

```powershell
npm run build
```

Preview the production build locally:

```powershell
npm run preview
```

Run lint checks:

```powershell
npm run lint
```

## Environment

- `VITE_API_BASE_URL`: REST API base URL, including `/api/v1`.
- `VITE_WS_BASE_URL`: websocket base URL, including `/api/v1`.
- `VITE_CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name for project assets.
- `VITE_CLOUDINARY_UPLOAD_PRESET`: unsigned upload preset for project assets.

## Deployment Notes

- Set `VITE_API_BASE_URL` to the deployed backend origin plus `/api/v1`.
- Use `wss://` for `VITE_WS_BASE_URL` when the frontend is served over HTTPS.
- Make sure the backend `BACKEND_CORS_ORIGINS` includes the deployed frontend origin.
- Build output is written to `dist/`.
