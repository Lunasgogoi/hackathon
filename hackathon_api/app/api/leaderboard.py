# app/api/leaderboard.py
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import json


from app.api.deps import get_db, get_current_admin
from app.models.team import Team
from app.models.project import ProjectSubmission, RubricEvaluation
from app.models.user import RoleEnum, User

router = APIRouter(prefix="/leaderboard", tags=["Round 3: Live Finals"])

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_leaderboard(self, data: dict):
        payload = json.dumps(data)
        disconnected: list[WebSocket] = []

        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)

# Initialize a single global manager
manager = ConnectionManager()

# Helper function to calculate current standings
async def fetch_top_teams(db: AsyncSession, limit: int = 10):
    judge_count = (await db.execute(
        select(func.count(User.id)).where(User.role == RoleEnum.judge)
    )).scalar_one()

    if judge_count == 0:
        return []

    query = (
        select(
            Team.id.label("team_id"),
            Team.name,
            func.coalesce(func.sum(RubricEvaluation.total_score), 0).label("total_points"),
            func.count(func.distinct(RubricEvaluation.judge_id)).label("evaluations_count"),
        )
        .join(ProjectSubmission, ProjectSubmission.team_id == Team.id)
        .outerjoin(RubricEvaluation, RubricEvaluation.project_id == ProjectSubmission.id)
        .where(Team.is_promoted_to_r2.is_(True))
        .group_by(Team.id, ProjectSubmission.id)
        .having(func.count(func.distinct(RubricEvaluation.judge_id)) >= judge_count)
        .order_by(func.sum(RubricEvaluation.total_score).desc())
        .limit(limit)
    )
    
    result = await db.execute(query)
    standings = result.all()
    
    # Format the data into a clean JSON structure
    leaderboard = [
        {
            "rank": index + 1,
            "team_id": row.team_id,
            "team": row.name,
            "score": row.total_points,
            "evaluations_count": row.evaluations_count,
            "required_evaluations": judge_count,
        }
        for index, row in enumerate(standings)
    ]
    return leaderboard

# The WebSocket Endpoint (Frontend connects to this)
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    await manager.connect(websocket)
    try:
        # As soon as they connect, send them the current standings
        initial_board = await fetch_top_teams(db)
        await websocket.send_text(json.dumps({"type": "initial_load", "data": initial_board}))
        
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# The Trigger Endpoint (Admins can hit this to force an update broadcast)
@router.post("/broadcast-update")
async def trigger_live_update(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    current_board = await fetch_top_teams(db)
    
    # Tell the manager to push the new data to every connected WebSocket
    await manager.broadcast_leaderboard({
        "type": "live_update", 
        "data": current_board
    })
    
    return {"message": "Leaderboard broadcast successful"}

