# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is a full-stack photography portfolio platform with FastAPI backend and React frontend. The system features:

- **Backend**: FastAPI with SQLAlchemy 2.0, PostgreSQL 15, Redis 7, async operations
- **Frontend**: React 18 with TypeScript, Vite, TanStack Query, Zustand, Leaflet maps
- **Infrastructure**: Docker Compose with nginx reverse proxy
- **Image Processing**: Multi-variant WebP generation (400px-2400px) with EXIF extraction

Core features include interactive photo mapping with clustering, location-based photo organization, project portfolio with GitHub integration, blog system, and comprehensive admin interface.

## Development Setup

### Environment Setup
Required environment variables (create `.env` file):
- `SECRET_KEY`: JWT signing key (minimum 32 characters)
- `SESSION_SECRET_KEY`: Session encryption key (minimum 32 characters)
- `ADMIN_PASSWORD`: Admin user password (minimum 8 characters)

### Development Commands

**Primary development workflow:**
```bash
# Start development environment with live reload
./dev.sh start

# View logs (optional service name and -f to follow)
./dev.sh logs [service] [-f]

# Stop development environment
./dev.sh stop

# Restart development environment
./dev.sh restart
```

**Manual Docker commands:**
```bash
# Start all services
docker compose -f docker-compose.dev.yml up -d

# Stop all services
docker compose -f docker-compose.dev.yml down

# View logs for specific service
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend
```

**Local development (without Docker):**
```bash
# Backend
cd backend
pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Database Management

```bash
# Create new migration
docker compose -f docker-compose.dev.yml exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head

# View migration history
docker compose -f docker-compose.dev.yml exec backend alembic history
```

### Testing

**Backend testing:**
```bash
# Via Docker
docker compose -f docker-compose.dev.yml exec backend python -m pytest
docker compose -f docker-compose.dev.yml exec backend python -m pytest tests/unit/
docker compose -f docker-compose.dev.yml exec backend python -m pytest tests/integration/

# Local
cd backend
pytest
pytest --cov=app tests/
```

**Frontend testing:**
```bash
cd frontend
npm run test              # Unit tests with Vitest
npm run test:e2e          # E2E tests with Playwright
npm run test:components   # Component tests only
npm run test:coverage     # Generate coverage report
```

### Code Quality

**Backend linting/formatting:**
```bash
# Run ruff with recommended flags
ruff check --fix --unsafe-fixes --preview
ruff format
mypy app/ tests/
```

**Frontend linting/formatting:**
```bash
cd frontend
npm run lint              # ESLint checking
npm run lint:fix          # ESLint with auto-fix
npm run format            # Prettier formatting
```

**Pre-commit hooks:**
```bash
pre-commit install
pre-commit run --all-files
```

## Testing Framework

**Backend pytest markers:**
- `unit`: Unit tests
- `integration`: Integration tests
- `security`: Security tests
- `performance`: Performance tests
- `auth`: Authentication tests
- `upload`: File upload tests
- `database`: Database tests
- `api`: API tests
- `image`: Image processing tests

Test configuration in `backend/pyproject.toml` with coverage requirements (40% minimum).

## Key File Locations

**Backend structure:**
- `backend/app/main.py`: FastAPI application entry point
- `backend/app/api/`: API route handlers (auth, photos, projects, blog, locations)
- `backend/app/core/`: Core services (security, image processing, Redis, location service)
- `backend/app/models/`: SQLAlchemy database models
- `backend/app/schemas/`: Pydantic request/response schemas
- `backend/app/crud/`: Database operations layer
- `backend/alembic/`: Database migration files

**Frontend structure:**
- `frontend/src/components/`: Reusable UI components
- `frontend/src/components/admin/`: Admin interface components
- `frontend/src/pages/`: Route-level components
- `frontend/src/hooks/`: Custom React hooks
- `frontend/src/api/`: API client with TypeScript types
- `frontend/src/stores/`: Zustand state management
- `frontend/src/types/`: TypeScript type definitions

**Storage:**
- `uploads/`: Original uploaded images
- `compressed/`: Processed WebP image variants

## API Architecture

**Key endpoints:**
- Authentication: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Photos: `/api/photos`, `/api/photos/locations` (optimized for map clustering)
- Location Services: `/api/locations/search`, `/api/locations/geocode`, `/api/locations/reverse`
- Projects: `/api/projects` (with GitHub/GitLab integration)
- Blog: `/api/blog`

**Image processing pipeline:**
1. Upload with EXIF extraction (GPS, camera settings, timestamps)
2. Auto-rotation correction and responsive variant generation
3. Automatic location name resolution via OpenStreetMap Nominatim
4. Storage with structured metadata in JSONB database column

## Access URLs

**Development:**
- Application: http://localhost
- Admin interface: http://localhost/admin
- API documentation: http://localhost/api/docs
- Direct backend: http://localhost:8000 (debugging)

## Code Conventions

- **Backend**: Python 3.11+, type hints required, use `from __future__ import annotations`
- **Frontend**: TypeScript strict mode, functional components with hooks
- **Imports**: Prefer absolute imports, avoid wildcard imports
- **Pre-commit**: All commits must pass pre-commit hooks (ruff, mypy, eslint, prettier, security checks)
- **Testing**: Functional tests preferred over class-based tests in Python

## Performance Considerations

- Photos processed into 5 WebP variants for responsive loading
- Location data optimized for map clustering at `/api/photos/locations`
- Redis caching for sessions and geocoding responses
- Virtualized photo grids for large collections
- Database indexes on location and timestamp fields

## Common Development Issues

### Tailwind CSS Classes Not Applied
If spacing/styling changes don't appear:
1. Clear Docker cache: `docker system prune -f`
2. Rebuild without cache: `docker compose build --no-cache`
3. Add missing classes to `/frontend/src/tailwind-safelist.css`
4. Check `/frontend/tailwind.config.js` safelist

**CRITICAL: Tailwind CSS v4 Configuration**
Tailwind v4 requires all reset styles inside `@layer base` in `/frontend/src/index.css`. Reset styles outside prevent padding/margin utilities from working. CSS bundle size should increase significantly (18KB → 43KB) when working correctly.

### MyPy Type Checking Issues
**Common Problems:**
- **Async Generator Return Types**: Use `AsyncGenerator[AsyncSession, None]` for functions that yield
- **Module Import Resolution**: Ensure `__init__.py` files exist in all test directories
- **Pydantic Schema Inheritance**: Avoid inheritance conflicts with explicit schemas

### Path Resolution Errors
**Backend File Processing:** Always use absolute paths (`Path(file_path).resolve()`) to prevent relative path failures.

### Database Migrations
- Create: `docker compose exec backend alembic revision --autogenerate -m "description"`
- Apply: `docker compose exec backend alembic upgrade head`
- History: `docker compose exec backend alembic history`

**IMPORTANT: Migration File Naming Convention**
- Migration files MUST use numeric format: `001_description.py`, `002_description.py`, etc.
- After autogeneration, manually rename files from hash format (e.g., `6d97478363ce_description.py`) to numeric format
- Update the `revision` variable in the file to match the new filename (e.g., `revision = "005_description"`)
- This ensures proper migration ordering and readability

### Image Upload Issues

**Common Upload Errors:**
1. **"undefined is not an object"**: Use composition over inheritance in TypeScript interfaces (contain File object, don't extend it)
2. **"NaN MB" displays**: Add defensive programming for file size formatting with proper validation
3. **"Request failed with status code 422"**: Sanitize and validate form data before submission (trim strings, provide fallbacks)
4. **UUID Serialization Errors**: Add field validators in Pydantic schemas to convert UUID objects to strings

**General Troubleshooting:**
- Check file size limits (50MB default) and upload directory permissions
- Check backend logs: `docker compose logs backend`
- EXIF processing requires valid image files
- Use browser dev tools to inspect FormData being sent

### File Upload Size Issues
If getting "File is too large" errors for files under 50MB:
- **Nginx Default Limit**: Add `client_max_body_size 50M;` to nginx.conf.template
- **HTTP 413 Payload Too Large**: Usually indicates nginx limit, not backend limit
- **Rebuild required**: Frontend container must be rebuilt after nginx config changes

### API Routing Issues
**Double API Prefix Problem** (`/api/api/endpoint`):
- **Root Cause**: FastAPI routes with `/api/` prefix + nginx proxy stripping
- **Solution**: Remove `/api/` prefixes from FastAPI router registrations in main.py
- **Nginx Config**: Ensure `proxy_pass ${BACKEND_URL}/;` has trailing slash to strip prefix
- **Frontend**: Set `VITE_API_URL=` (empty) to prevent double prefixing

### Authentication
- Default admin credentials: `admin` / `adminpassword`
- JWT tokens stored in browser localStorage
- Clear localStorage if auth issues persist
- normally there is no need to restart if we are doing superficial changes without new files
