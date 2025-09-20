from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import (
    auth,
    blog,
    camera_aliases,
    content,
    lens_aliases,
    locations,
    photos,
    projects,
    subapp_integration,
    subapps,
)
from app.config import settings
from app.core.rate_limiter import RateLimitMiddleware
from app.core.redis import close_redis, init_redis


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

# Routes
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(photos.router, prefix="/photos", tags=["photos"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(blog.router, prefix="/blog", tags=["blog"])
app.include_router(subapps.router, prefix="/subapps", tags=["subapps"])
app.include_router(
    subapp_integration.router, prefix="/subapp-integration", tags=["subapp-integration"]
)
app.include_router(
    camera_aliases.router, prefix="/camera-aliases", tags=["camera-aliases"]
)
app.include_router(lens_aliases.router, prefix="/lens-aliases", tags=["lens-aliases"])
app.include_router(content.router)
app.include_router(locations.router, prefix="", tags=["locations"])

# Static files removed - now served through API with access control
# Files are now accessed via /api/photos/{photo_id}/file/{variant} endpoints


@app.get("/")
async def root():
    return {"message": "Portfolio API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": "2025-09-09T07:30:00Z"}


@app.get("/api/health")
async def api_health_check():
    return {"status": "healthy", "api": "ready", "timestamp": "2025-09-09T07:30:00Z"}
