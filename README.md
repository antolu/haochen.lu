# Portfolio & Photography Platform

A full-stack web application built with FastAPI backend and React frontend, featuring photo management with interactive location mapping, project showcase, blog system, and admin interface.

## Overview

This platform combines a personal portfolio with advanced photo management capabilities. The standout feature is an interactive photo map that uses location clustering to organize and display photos geographically. Photos are processed into multiple responsive variants and can be managed through a comprehensive admin interface with location editing capabilities.

## Architecture

### Technology Stack

Backend:
- FastAPI with async operations and automatic API documentation
- SQLAlchemy 2.0 with PostgreSQL 15 for data persistence
- Redis 7 for caching and session management
- OpenStreetMap Nominatim for geocoding services
- Alembic for database migrations

Frontend:
- React 18 with TypeScript and strict type checking
- Vite for development server and build tooling
- TanStack Query for server state management with optimistic updates
- Zustand for client state management
- Leaflet with react-leaflet-cluster for interactive maps
- Tailwind CSS v4 for styling
- Framer Motion for animations

Infrastructure:
- Docker Compose for multi-container orchestration
- Nginx reverse proxy with optimized static file serving
- Health checks and container monitoring

### Project Structure

```
backend/
├── app/
│   ├── api/                 # API route handlers
│   │   ├── auth.py         # Authentication endpoints
│   │   ├── photos.py       # Photo CRUD and locations API
│   │   ├── projects.py     # Project management
│   │   ├── blog.py         # Blog system
│   │   └── locations.py    # Geocoding services
│   ├── core/               # Security, image processing, configuration
│   ├── crud/               # Database operations layer
│   ├── models/             # SQLAlchemy database models
│   └── schemas/            # Pydantic request/response schemas
├── alembic/                # Database migration files
└── tests/                  # Backend test suites

frontend/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── PhotoMap.tsx    # Interactive clustering map
│   │   ├── PhotoGrid.tsx   # Virtualized photo gallery
│   │   ├── LocationInput.tsx # Location selection component
│   │   └── admin/          # Admin interface components
│   ├── pages/              # Route-level components
│   ├── hooks/              # Custom React hooks
│   ├── api/                # API client with TypeScript types
│   ├── stores/             # Zustand state stores
│   └── types/              # TypeScript type definitions
└── tests/                  # Frontend test suites

uploads/                    # Original uploaded images
compressed/                 # Processed WebP image variants
```

## Key Features

### Interactive Photo Map
The core feature provides location-based photo exploration:
- Automatic clustering of nearby photos with thumbnail previews
- Zoom-responsive cluster separation for detailed exploration
- Interactive popups showing all photos in a cluster with metadata
- Synchronization between map selections and photo gallery
- Global scale support for worldwide photo collections

### Photo Management System
Complete photo lifecycle management:
- Upload with automatic EXIF extraction including GPS coordinates
- Responsive image processing generating 5 WebP variants (400px to 2400px)
- Location enhancement through automatic geocoding
- Admin interface with tabbed editing for metadata, location, and custom fields
- Interactive map-based location editing

### Content Management
- Project portfolio with GitHub/GitLab repository integration
- Automatic README fetching and caching from repositories
- Blog system with markdown rendering and syntax highlighting
- Sub-applications with authenticated access control

### Admin Interface
Comprehensive management dashboard:
- Photo metadata editing with location services integration
- Custom field system for flexible metadata storage
- Project CRUD operations with repository validation
- User management and authentication controls

## Development Setup

### Prerequisites
- Docker and Docker Compose
- Git
- Python 3.11+ (for local backend development)
- Node.js 18+ (for local frontend development)

### Environment Configuration

Create a `.env` file with required security variables:

```bash
# Generate secure keys
python -c "import secrets; print(f'SECRET_KEY={secrets.token_urlsafe(32)}')" >> .env
python -c "import secrets; print(f'SESSION_SECRET_KEY={secrets.token_urlsafe(32)}')" >> .env
echo "ADMIN_PASSWORD=your_secure_password" >> .env

# Optional configuration
echo "ENVIRONMENT=development" >> .env
echo "POSTGRES_DB=portfolio" >> .env
echo "POSTGRES_PASSWORD=portfolio_password" >> .env
```

Required environment variables:
- `SECRET_KEY`: JWT signing key (minimum 32 characters)
- `SESSION_SECRET_KEY`: Session encryption key (minimum 32 characters)
- `ADMIN_PASSWORD`: Admin user password (minimum 8 characters)

The application will not start without these security variables.

### Development Commands

#### Using the Development Script (Recommended)

```bash
# Start development environment with live reload
./dev.sh start

# View real-time logs
./dev.sh logs [service_name]

# Stop development environment
./dev.sh stop

# Restart services
./dev.sh restart

# Build production assets
./dev.sh build

# Run test suites
./dev.sh test

# Show all available commands
./dev.sh help
```

#### Manual Docker Commands

```bash
# Start all services
docker compose up -d

# View logs for specific service
docker compose logs -f backend
docker compose logs -f frontend

# Stop all services
docker compose down

# Complete rebuild
docker system prune -f
docker compose build --no-cache
docker compose up -d
```

#### Local Development (Without Docker)

Backend:
```bash
cd backend
pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

### Database Management

```bash
# Create new migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker compose exec backend alembic upgrade head

# View migration history
docker compose exec backend alembic history

# Downgrade migration
docker compose exec backend alembic downgrade -1
```

### Testing

Frontend testing:
```bash
cd frontend
npm run test                # Unit tests with Vitest
npm run test:e2e           # E2E tests with Playwright
npm run test:components    # Component tests only
npm run test:coverage      # Generate coverage report
npm run lint              # ESLint checking
```

Backend testing:
```bash
# Via Docker
docker compose exec backend python -m pytest tests/
docker compose exec backend python -m pytest tests/unit/
docker compose exec backend python -m pytest tests/integration/

# Local
cd backend
pytest tests/
pytest --cov=app tests/
```

Code quality:
```bash
# Backend linting and type checking
ruff check --fix --unsafe-fixes --preview
ruff format
mypy app/ tests/

# Frontend linting and formatting
cd frontend
npm run lint -- --fix
npm run format
```

### Pre-commit Hooks

Install pre-commit hooks for automated quality checks:
```bash
pre-commit install
pre-commit run --all-files
```

Configured hooks include:
- End-of-file and trailing whitespace fixes
- YAML, JSON, and TOML validation
- Python: ruff linting and formatting, mypy type checking, bandit security scanning
- Frontend: prettier formatting, ESLint checking

## API Reference

### Core Endpoints

Authentication:
- `POST /api/auth/login` - Admin login with JWT token
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/me` - Current user information

Photos:
- `GET /api/photos` - Paginated photo listing with filtering
- `GET /api/photos/locations` - Optimized location data for map clustering
- `POST /api/photos` - Upload with EXIF extraction (admin only)
- `PUT /api/photos/{id}` - Update metadata and location (admin only)
- `DELETE /api/photos/{id}` - Delete photo and variants (admin only)

Location Services:
- `GET /api/locations/search` - Location search with autocomplete
- `POST /api/locations/geocode` - Convert address to coordinates
- `POST /api/locations/reverse` - Convert coordinates to address

Projects:
- `GET /api/projects` - Project portfolio with repository integration
- `POST /api/projects` - Create project with validation (admin only)
- `PUT /api/projects/{id}` - Update project (admin only)

Blog:
- `GET /api/blog` - Blog posts with markdown rendering
- `POST /api/blog` - Create blog post (admin only)

### Image Processing Pipeline

1. Upload: Multipart form submission with file validation
2. EXIF Extraction: Camera settings, GPS coordinates, timestamps using ExifRead
3. Processing: Auto-rotation correction and responsive variant generation
4. Geocoding: Automatic location name resolution for GPS coordinates
5. Storage: Original files in `/uploads`, optimized variants in `/compressed`
6. Database: Structured metadata with JSONB variants column

Generated image variants:
- thumbnail: 400px, 75% quality - for grid thumbnails and previews
- small: 800px, 80% quality - mobile viewing
- medium: 1200px, 85% quality - desktop viewing
- large: 1600px, 90% quality - high-resolution viewing
- xlarge: 2400px, 95% quality - print quality

## Deployment

### Production Environment

```bash
# Set production configuration
echo "ENVIRONMENT=production" >> .env
echo "COOKIE_SECURE=true" >> .env
echo "CORS_ORIGINS=https://yourdomain.com" >> .env

# Deploy production stack
docker compose -f docker-compose.yml up -d
```

### Multi-platform Docker Images

For cross-platform deployment:

```bash
# Build and push to registry
docker buildx build --platform linux/amd64,linux/arm64 -t yourregistry/backend:latest backend --push
docker buildx build --platform linux/amd64,linux/arm64 -t yourregistry/frontend:latest frontend --push

# Local multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t backend:latest backend --load
docker buildx build --platform linux/amd64,linux/arm64 -t frontend:latest frontend --load
```

### TrueNAS Scale Deployment

See [TRUENAS_DEPLOYMENT.md](./TRUENAS_DEPLOYMENT.md) for detailed TrueNAS Scale deployment instructions including:
- Container service configuration
- Dataset setup and persistent storage
- Network configuration and port mapping
- Security considerations

### Production Checklist

Security:
- Generate secure random keys for SECRET_KEY and SESSION_SECRET_KEY
- Set strong ADMIN_PASSWORD
- Configure CORS_ORIGINS for your domain
- Enable COOKIE_SECURE for HTTPS

Performance:
- Set up PostgreSQL backups
- Configure upload directory backups
- Monitor disk space for image storage
- Set up Redis persistence if needed

Monitoring:
- Enable Docker health checks
- Monitor container logs
- Set up disk space alerts
- Configure uptime monitoring

## Access URLs

Development:
- Website: http://localhost
- Admin interface: http://localhost/admin
- API documentation: http://localhost/api/docs
- Direct backend: http://localhost:8000 (for debugging)

Production:
- Configure your domain in CORS_ORIGINS
- Set up SSL certificates through reverse proxy
- Admin credentials: admin / your_admin_password

## Troubleshooting

### Development Reset

```bash
# Complete environment reset
./dev.sh stop
docker system prune -f
docker volume prune -f
./dev.sh start

# Reset database only
docker compose down
docker volume rm $(docker volume ls -q | grep postgres)
docker compose up -d
```

### Container Debugging

```bash
# Access container shell
docker compose exec backend bash
docker compose exec frontend sh

# Check container health
docker compose ps
docker compose logs backend
docker compose logs frontend

# Monitor resource usage
docker stats
```

### Performance Monitoring

Check image processing performance:
```bash
# Monitor disk usage
df -h uploads/ compressed/

# Check image variant generation
ls -la compressed/
```

Monitor database performance:
```bash
# PostgreSQL query logs
docker compose logs db | grep -i slow
```

## Documentation

- [CLAUDE.md](./CLAUDE.md): Comprehensive development guide with architecture details
- [TRUENAS_DEPLOYMENT.md](./TRUENAS_DEPLOYMENT.md): TrueNAS Scale deployment instructions
- [dev.sh](./dev.sh): Development script command reference (run `./dev.sh help`)
- `/api/docs`: Interactive API documentation (when running)
