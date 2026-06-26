# app/api/leaderboard.py
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from httpx import request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List
import json


from app.api.deps import get_db, get_current_admin
from app.models.team import Team
from app.models.project import RubricEvaluation

router = APIRouter(prefix="/leaderboard", tags=["Round 3: Live Finals"])

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        # Store all active connections
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_leaderboard(self, data: dict):
        # Push the JSON data to every connected screen instantly
        for connection in self.active_connections:
            await connection.send_text(json.dumps(data))

# Initialize a single global manager
manager = ConnectionManager()

# Helper function to calculate current standings
async def fetch_top_teams(db: AsyncSession, limit: int = 10):
    # This query joins Teams and their RubricEvaluations, summing the scores
    query = (
        select(
            Team.name,
            func.coalesce(func.sum(RubricEvaluation.total_score), 0).label("total_points")
        )
        .outerjoin(RubricEvaluation, RubricEvaluation.project_id == Team.id) 
        .where(Team.is_promoted_to_r2 == True)
        .group_by(Team.id)
        .order_by(func.sum(RubricEvaluation.total_score).desc())
        .limit(limit)
    )
    
    result = await db.execute(query)
    standings = result.all()
    
    # Format the data into a clean JSON structure
    leaderboard = [
        {"rank": index + 1, "team": row.name, "score": row.total_points}
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
        
        # Keep connection open and listen for incoming messages (if any)
        while True:
            data = await websocket.receive_text()
            # In a leaderboard, clients usually just listen, but we need this loop to keep the socket alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# The Trigger Endpoint (Admins can hit this to force an update broadcast)
@router.post("/broadcast-update")
async def trigger_live_update(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    # print(request.headers)
    current_board = await fetch_top_teams(db)
    
    # Tell the manager to push the new data to every connected WebSocket
    await manager.broadcast_leaderboard({
        "type": "live_update", 
        "data": current_board
    })
    
    return {"message": "Leaderboard broadcast successful"}