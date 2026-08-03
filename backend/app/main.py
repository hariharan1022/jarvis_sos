from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os

from .config import settings
from .database import engine, Base, get_db
from .routes import auth, users, emergency, ai_routes
from .services.websocket_manager import manager
from . import models

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend emergency engine for SafeNova AI"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For easy local hosting across network boundaries
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST routes
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(emergency.router)
app.include_router(ai_routes.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "mode": "Jarvis Safety Guard"
    }

# WebSockets logic for real-time location stream
@app.websocket("/api/ws/track/{tracking_code}")
async def websocket_track(websocket: WebSocket, tracking_code: str):
    await manager.connect_session(tracking_code, websocket)
    try:
        while True:
            # Maintain active connection; discard incoming client messages or handle heartbeat
            data = await websocket.receive_text()
            # Echo heartbeat to ensure link stays active
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect_session(tracking_code, websocket)
    except Exception:
        manager.disconnect_session(tracking_code, websocket)

@app.websocket("/api/ws/admin")
async def websocket_admin(websocket: WebSocket):
    await manager.connect_admin(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)
    except Exception:
        manager.disconnect_admin(websocket)
