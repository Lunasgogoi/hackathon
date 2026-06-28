# app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.api import assessment, coding, admin , project , leaderboard , auth , mcq, team, certificate
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from app.core.config import settings
from app.db.session import get_db
from app.models.system import SystemState
from app.core.websocket import manager

app = FastAPI(
    title="Hackathon Management API",
    description="Backend engine for multi-round hackathon state management and automated grading.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(coding.router,prefix="/api/v1")
app.include_router(assessment.router,prefix="/api/v1")
app.include_router(admin.router,prefix="/api/v1")
app.include_router(project.router,prefix="/api/v1")
app.include_router(leaderboard.router,prefix="/api/v1")
app.include_router(auth.router,prefix="/api/v1")
app.include_router(mcq.router, prefix="/api/v1")
app.include_router(team.router, prefix="/api/v1")
app.include_router(certificate.router, prefix="/api/v1")

@app.get("/api/v1/system/phases")
async def get_system_phases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemState))
    states = result.scalars().all()

    # Default fallback if the database is empty
    phases = {
        "registration": "active",
        "round1": "locked",
        "round2": "locked",
        "finale": "locked"
    }

    for state in states:
        phases[state.phase_name] = state.status

    return phases

@app.websocket("/api/v1/system/ws")
async def system_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
async def health_check():
    return {
        "system_status": "online", 
        "current_phase": "initialization"
    }
