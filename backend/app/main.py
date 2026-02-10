from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime

import jwt
from fastapi import APIRouter, FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import (
    auth,
    blog,
    camera_aliases,
    content,
    hero_images,
    lens_aliases,
    locations,
    photos,
    profile_pictures,
    projects,
    subapp_integration,
    subapps,
)
from app.api import (
    settings as settings_api,
)
from app.config import settings
from app.core.progress import progress_manager
from app.core.rate_limiter import RateLimitMiddleware
from app.core.redis import close_redis, init_redis
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.users import auth_backend, fastapi_users


class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_redis()
    yield
    # Shutdown
    await close_redis()


app = FastAPI(
    title="Portfolio API",
    description="A comprehensive portfolio and blog API",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiting middleware for file access
app.add_middleware(RateLimitMiddleware)

# No cache middleware for API endpoints
app.add_middleware(NoCacheMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes without /api prefix (nginx handles the prefix)
api_router = APIRouter()

# Custom auth routes (must come before fastapi-users routes)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# FastAPI Users auth routes
api_router.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)
api_router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
api_router.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
api_router.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
api_router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

api_router.include_router(photos.router, prefix="/photos", tags=["photos"])
api_router.include_router(settings_api.router, prefix="/settings", tags=["settings"])
api_router.include_router(
    profile_pictures.router, prefix="/profile-pictures", tags=["profile-pictures"]
)
api_router.include_router(
    hero_images.router, prefix="/hero-images", tags=["hero-images"]
)
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(blog.router, prefix="/blog", tags=["blog"])
api_router.include_router(subapps.router, prefix="/subapps", tags=["subapps"])
api_router.include_router(
    subapp_integration.router, prefix="/subapp-integration", tags=["subapp-integration"]
)
api_router.include_router(
    camera_aliases.router, prefix="/camera-aliases", tags=["camera-aliases"]
)
api_router.include_router(
    lens_aliases.router, prefix="/lens-aliases", tags=["lens-aliases"]
)
api_router.include_router(content.router)
api_router.include_router(locations.router, prefix="/locations", tags=["locations"])

app.include_router(api_router, prefix="/api")

# Static files removed - now served through API with access control
# Files are now accessed via /api/photos/{photo_id}/file/{variant} endpoints


@app.get("/")
async def root():
    return {"message": "Portfolio API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat() + "Z"}


@app.websocket("/ws/uploads/{upload_id}")
async def uploads_progress_ws(websocket: WebSocket, upload_id: str):
    """WebSocket channel for real-time upload/compression progress."""
    # Accept connection first
    await websocket.accept()

    # Validate token from query parameter
    token = websocket.query_params.get("token")
    if not token:
        await websocket.send_json({"error": "Authentication required"})
        await websocket.close(code=1008)  # Policy violation
        return

    # Verify token using fastapi-users JWT strategy
    try:
        jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except Exception:
        await websocket.send_json({"error": "Invalid or expired token"})
        await websocket.close(code=1008)
        return

    # Connect to progress manager
    await progress_manager.connect(upload_id, websocket)
    try:
        while True:
            # Keep the connection alive; clients don't need to send messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        await progress_manager.disconnect(upload_id, websocket)


@app.get("/api/health")
async def api_health_check():
    return {
        "status": "healthy",
        "api": "ready",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
