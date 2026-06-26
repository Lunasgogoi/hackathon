# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import coding, admin , project , leaderboard , auth


app = FastAPI(
    title="Hackathon Management API",
    description="Backend engine for multi-round hackathon state management and automated grading.",
    version="1.0.0"
)

# Standard CORS setup for our future React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(coding.router,prefix="/api/v1")
app.include_router(admin.router,prefix="/api/v1")
app.include_router(project.router,prefix="/api/v1")
app.include_router(leaderboard.router,prefix="/api/v1")
app.include_router(auth.router,prefix="/api/v1")


@app.get("/")
async def health_check():
    return {
        "system_status": "online", 
        "current_phase": "initialization"
    }