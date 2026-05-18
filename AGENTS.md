# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is a full-stack photography portfolio platform with FastAPI backend and React frontend. The system features:

- **Backend**: FastAPI with SQLAlchemy 2.0, PostgreSQL 15, Redis 7, async operations
- **Frontend**: React 19 with TypeScript, Vite, TanStack Query, Zustand, MapLibre, Tailwind CSS v4
- **Auth**: Keycloak 26 (OIDC, RS256 tokens via JWKS). Dev realm bootstrapped automatically; prod managed via Terraform.
- **Infrastructure**: Docker Compose with nginx and supervisord
- **Image Processing**: Multi-variant WebP generation (400px-2400px) with EXIF extraction

Core features include interactive photo mapping with clustering, location-based photo organization, project portfolio with GitHub integration, blog system, and comprehensive admin interface.

## Development Setup

### Environment Setup
Required environment variables (create `.env` file):
- `SECRET_KEY`: signing key for app OAuth tokens (minimum 32 characters)
- `SESSION_SECRET_KEY`: session encryption key (minimum 32 characters)
- `ADMIN_PASSWORD`: backend admin password (minimum 8 characters)
- `POSTGRES_USER`: database role name (default: `postgres`)
- `POSTGRES_PASSWORD`: database role password (required)
- `POSTGRES_HOST`: database host (default: `localhost`; use `db` in Docker)
- `POSTGRES_PORT`: database port (default: `5432`)
- `POSTGRES_DB`: database name (default: `portfolio`)

Keycloak OIDC variables (dev defaults — match `keycloak/arcadia-realm.json`):
- `OIDC_ENDPOINT=http://keycloak:8080` — internal container URL for token validation
- `OIDC_PUBLIC_ENDPOINT=http://localhost:9091` — browser-facing URL, also used for `iss` claim validation
- `OIDC_REALM=arcadia`
- `OIDC_CLIENT_ID=haochen-lu`
- `OIDC_CLIENT_SECRET=dev-client-secret`
- `OIDC_REDIRECT_URI=http://localhost/api/auth/callback`

### Development Commands

**Primary development workflow:**
```bash
# Start development environment (nginx, Vite, and Uvicorn in one container)
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

# View logs for the main application
docker compose -f docker-compose.dev.yml logs -f app
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

**Production Image Build:**
```bash
# Build production image with git context
docker compose -f docker-compose.build.yml build

# Build production image with custom tag
docker compose -f docker-compose.build.yml build
docker tag antonlu/arcadia-app:latest antonlu/arcadia-app:v1.0.0

# Push to registry
docker push antonlu/arcadia-app:latest
docker push antonlu/arcadia-app:v1.0.0
```

**Note:** Multi-platform builds and releases are automated via GitHub Actions when pushing version tags (e.g., `git tag v1.0.0 && git push origin v1.0.0`).

### Database Management

```bash
# Create new migration
docker compose -f docker-compose.dev.yml exec app alembic revision --autogenerate -m "description"

# Apply migrations
docker compose -f docker-compose.dev.yml exec app alembic upgrade head

# View migration history
docker compose -f docker-compose.dev.yml exec app alembic history
```

### Testing

**Backend unit tests:**
```bash
# Via Docker
docker compose -f docker-compose.dev.yml exec app pytest /app/backend/tests/unit/
docker compose -f docker-compose.dev.yml exec app pytest /app/backend/tests/security/

# Local
cd backend
pytest tests/unit/
pytest --cov=app tests/unit/
```

**Integration tests (full stack):**
```bash
# Run all integration tests (recommended)
./.github/scripts/test-integration.sh

# Run via Docker Compose directly (most reliable)
docker compose -f docker-compose.test.yml run --rm backend pytest

# Run specific test file
docker compose -f docker-compose.test.yml run --rm backend pytest tests/integration/api/test_photos_integration.py

# Clean up test containers
docker compose -f docker-compose.test.yml down -v
```

Integration tests run in Docker Compose with:
- PostgreSQL test database with seeded data
- Redis for caching
- Backend API server
- Fixture test images

**Frontend testing:**
```bash
cd frontend
npm run test              # Unit tests with Vitest
npm run test:components   # Component tests only
npm run test:coverage     # Generate coverage report
```

**CI/CD Integration Tests:**
Integration tests run automatically on:
- Every push to master
- Every pull request
- Daily at 2 AM UTC (scheduled)

The CI workflow uses the same Docker Compose environment as local testing,
ensuring consistent behavior.

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
- `compressed/`: Processed WebP/AVIF photo variants
- `file_uploads/`: Arbitrary uploaded files (PDFs, docs, ZIPs, etc.)

## API Architecture

**Key endpoints:**
- Authentication: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Photos: `/api/photos`, `/api/photos/locations` (optimized for map clustering)
- Files: `GET /files/{filename}` (public, rate limited), `POST /api/files`, `GET /api/files`, `PATCH /api/files/{id}`, `DELETE /api/files/{id}`
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
- Keycloak admin UI: http://localhost:9091 (credentials: `admin` / `admin`)

**Dev login credentials (pre-loaded in Keycloak realm):**
- Username: `admin`, password: `adminadmin`, member of `admins` group → `is_admin=true`

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

## Infrastructure & Deployment

This repo is deployed on TrueNAS via a separate Terraform repository. When adding new configuration or deployment parameters (new env vars, new services, new volumes), always:

1. Add the parameter to the dev environment first (`docker-compose.dev.yml` and `.env.example`)
2. Prompt the user to update their Terraform configuration accordingly

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
**`/files/` not found (404 from nginx):** The `/files/` location block must appear before the SPA catch-all `location /` in both `nginx.conf` and `nginx.conf.dev`. Files are proxied to the backend, not served statically.

**Double API Prefix Problem** (`/api/api/endpoint`):
- **Root Cause**: Frontend base URL already includes `/api` while backend/proxy paths add another `/api`
- **Solution**: Keep backend routes mounted at `/api` in `main.py` and keep frontend `VITE_API_URL=/api`
- **Nginx Config**: Forward `/api/*` to backend without stripping the `/api` prefix
- **Frontend**: Use relative API base `/api` in development and production

### Authentication

Auth uses Keycloak OIDC (RS256). The backend never mints its own JWTs for users — it validates Keycloak's access tokens via JWKS and stores the Keycloak refresh token in an httpOnly cookie.

Two-URL pattern is critical:
- `OIDC_ENDPOINT` — used by the backend to reach Keycloak over the Docker network (e.g. `http://keycloak:8080`)
- `OIDC_PUBLIC_ENDPOINT` — browser-facing URL and expected `iss` claim (e.g. `http://localhost:9091`)

The JWKS URI returned by Keycloak's discovery doc uses the public hostname. The backend rewrites it to the internal `OIDC_ENDPOINT` before fetching (`backend/app/core/oidc.py`).

**Dev credentials:**
- App login: `admin` / `adminadmin`
- Keycloak admin UI: `admin` / `admin`

**Resetting dev Keycloak state:**
```bash
docker compose -f docker-compose.dev.yml down -v
./dev.sh start
```

Clear browser localStorage if the frontend shows stale auth state after a realm reset.

## Infrastructure (Terraform)

Terraform configuration lives in a **separate repo**: `../arcadia-terraform` (i.e. `/Users/antonlu/code/arcadia-terraform`).

**IMPORTANT**: Whenever a task involves changes that affect infrastructure settings — such as:
- OIDC client configuration (redirect URIs, scopes, grant types)
- Keycloak realm, group, or role definitions
- New services added to docker-compose that need external configuration
- Any change to `OIDC_*` environment variables that reflects a Keycloak-side setting

— you MUST ask the user: *"This change has an infrastructure side. Should I update the Terraform config in `../arcadia-terraform`?"* before proceeding. Do not silently skip the Terraform update.

If the user says yes, make the changes in `../arcadia-terraform/truenas/apps/keycloak/` (or the appropriate subdirectory). If they say no, note what would need to be applied manually.
