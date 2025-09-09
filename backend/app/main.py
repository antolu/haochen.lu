from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, photos, projects, blog, subapps
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="Photography Portfolio API",
    description="A comprehensive photography portfolio and blog API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(photos.router, prefix="/api/photos", tags=["photos"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(blog.router, prefix="/api/blog", tags=["blog"])
app.include_router(subapps.router, prefix="/api/subapps", tags=["subapps"])

# Static files
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
app.mount("/compressed", StaticFiles(directory=settings.compressed_dir), name="compressed")


@app.get("/")
async def root():
    return {"message": "Photography Portfolio API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": "2025-09-09T07:30:00Z"}

@app.get("/api/health")
async def api_health_check():
    return {"status": "healthy", "api": "ready", "timestamp": "2025-09-09T07:30:00Z"}