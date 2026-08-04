from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import os
import time
from collections import defaultdict

from .config import settings
from .database import engine, Base, get_db, SessionLocal
from .routes import auth, users, emergency, ai_routes, admin
from .services.websocket_manager import manager
from . import models

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend emergency engine for SafeNova AI",
    version="1.0.0"
)

# ─── In-process sliding-window rate limiter (no Redis dependency) ─────────────
_rate_buckets: dict = defaultdict(list)

def _is_rate_limited(key: str, max_calls: int, window_seconds: int) -> bool:
    now = time.time()
    _rate_buckets[key] = [t for t in _rate_buckets[key] if now - t < window_seconds]
    if len(_rate_buckets[key]) >= max_calls:
        return True
    _rate_buckets[key].append(now)
    return False

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Limit SOS trigger: 5 requests per minute per IP
    if request.url.path == "/api/emergency/trigger" and request.method == "POST":
        client_ip = request.client.host if request.client else "unknown"
        if _is_rate_limited(f"sos:{client_ip}", max_calls=5, window_seconds=60):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many emergency triggers. Please wait before retrying."}
            )
    return await call_next(request)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST routes
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(emergency.router)
app.include_router(ai_routes.router)
app.include_router(admin.router)

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        from .auth import get_password_hash
        import uuid
        admin_email = "admin@safenova.com"
        admin_user = db.query(models.User).filter(models.User.email == admin_email).first()
        if not admin_user:
            admin_user = models.User(
                name="Super Admin",
                email=admin_email,
                hashed_password=get_password_hash("admin123"),
                role="SUPER_ADMIN",
                tracking_code=str(uuid.uuid4())[:8].upper()
            )
            db.add(admin_user)
            db.commit()
    finally:
        db.close()

    # Security check: warn if using default secret key
    if settings.SECRET_KEY == "super-secret-nova-guardian-key-128-bits":
        print("=" * 70)
        print("⚠️  [SECURITY] SECRET_KEY is still the default placeholder!")
        print("   Generate a real key:  python -c \"import secrets; print(secrets.token_hex(32))\"")
        print("   Then set it in:  backend/.env  →  SECRET_KEY=<your_new_key>")
        print("=" * 70)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "mode": "Jarvis Safety Guard"
    }

@app.get("/health")
def health_check():
    """Lightweight health probe for uptime monitoring and container orchestration."""
    return {"status": "healthy", "service": settings.PROJECT_NAME, "version": "1.0.0"}

# ─── WebSockets ────────────────────────────────────────────────────────────────
@app.websocket("/api/ws/track/{tracking_code}")
async def websocket_track(websocket: WebSocket, tracking_code: str):
    await manager.connect_session(tracking_code, websocket)
    try:
        while True:
            data = await websocket.receive_text()
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
