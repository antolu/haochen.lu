from __future__ import annotations

import typing
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import (
    APIRouter,
    FastAPI,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import (
    applications,
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
)
from app.api import (
    files as files_api,
)
from app.api import (
    settings as settings_api,
)
from app.config import settings
from app.core.oidc import oidc_client, oidc_validator
from app.core.progress import progress_manager
from app.core.rate_limiter import RateLimitMiddleware
from app.core.redis import close_redis, init_redis
from app.core.runtime_settings import SystemConfigService
from app.core.security import decode_token
from app.database import async_session_maker
from app.dependencies import _session_dependency


class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: typing.Callable[[Request], typing.Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> typing.AsyncGenerator[None, None]:
    await init_redis()
    await oidc_client.initialize()
    await oidc_validator.initialize()

    app.state.config_service = SystemConfigService()
    await app.state.config_service.load_from_db(async_session_maker)
    try:
        yield
    finally:
        await close_redis()


app = FastAPI(
    title="Portfolio API",
    description="A comprehensive portfolio and blog API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    contact={
        "name": "Portfolio API Support",
        "url": "https://github.com/antonlu/arcadia",
    },
    license_info={
        "name": "MIT",
    },
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["content-type", "authorization", "x-requested-with"],
)

# API routes are mounted under /api.
# Proxies should forward /api/* without stripping the prefix.
api_router = APIRouter()

# Custom auth routes
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

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
api_router.include_router(
    applications.router, prefix="/applications", tags=["applications"]
)
api_router.include_router(
    camera_aliases.router, prefix="/camera-aliases", tags=["camera-aliases"]
)
api_router.include_router(
    lens_aliases.router, prefix="/lens-aliases", tags=["lens-aliases"]
)
api_router.include_router(content.router)
api_router.include_router(locations.router, prefix="/locations", tags=["locations"])
api_router.include_router(files_api.router, prefix="/files", tags=["files"])

app.include_router(api_router, prefix="/api")


@app.get("/files/{filename}")
async def serve_file(
    filename: str,
    request: Request,
    db: AsyncSession = _session_dependency,
) -> FileResponse:
    return await files_api.serve_public_file(filename, request, db)


# Static files removed - now served through API with access control
# Files are now accessed via /api/photos/{photo_id}/file/{variant} endpoints


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Portfolio API", "version": "1.0.0"}


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat() + "Z"}


@app.websocket("/ws/uploads/{upload_id}")
async def uploads_progress_ws(websocket: WebSocket, upload_id: str) -> None:
    """WebSocket channel for real-time upload/compression progress."""
    # Accept connection first
    await websocket.accept()

    # Validate token from query parameter
    token = websocket.query_params.get("token")
    if not token:
        await websocket.send_json({"error": "Authentication required"})
        await websocket.close(code=1008)  # Policy violation
        return

    # Verify token — must be an access token specifically
    if decode_token(token, expected_type="access") is None:
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
async def api_health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "api": "ready",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
