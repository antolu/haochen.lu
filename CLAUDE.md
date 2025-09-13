# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern, full-stack photography portfolio website built with **FastAPI (Python) backend** and **React (TypeScript) frontend**. Features photo uploads with automatic EXIF extraction, blog system, project showcase, and authenticated sub-applications access. The site uses a landing page approach with a separate album page for seamless photo browsing.

## Development Commands

### Docker Deployment (Recommended)
```bash
# Start all services
docker compose up -d

# View logs  
docker compose logs -f backend
docker compose logs -f frontend

# Complete rebuild (if CSS/Docker cache issues)
docker system prune -f
docker compose build --no-cache
docker compose up -d

# Run database migrations
docker compose run --rm migrate
```

**Access URLs:**
- Website: http://localhost
- API Documentation: http://localhost/api/docs  
- Admin Login: admin/admin

### Local Development

#### Backend (FastAPI)
```bash
cd backend
pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

#### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev  # Development server with hot reload
npm run build  # Production build
npm run preview  # Preview production build
```

### Testing Commands
```bash
# Frontend tests
cd frontend
npm run test              # Unit tests (Vitest)
npm run test:ui           # Test UI
npm run test:e2e          # End-to-end tests (Playwright)
npm run test:coverage     # Coverage report
npm run lint              # ESLint

# Backend tests  
cd backend
pytest                    # All tests
pytest tests/unit/        # Unit tests only
pytest tests/integration/ # Integration tests only
pytest --cov=app         # With coverage
ruff check --fix --unsafe-fixes --preview  # Linting

# Docker-based testing (when local dependencies missing)
docker compose exec backend python -m pytest tests/
curl -L http://localhost/api/photos  # API functionality test
```

### Pre-commit Configuration
```bash
# Install pre-commit hooks
pre-commit install

# Run pre-commit on all files
pre-commit run --all-files

# Update hooks to latest versions
pre-commit autoupdate

# Manual pre-commit checks
cd backend
ruff check --fix --unsafe-fixes --preview
ruff format
mypy app/ tests/
```

**Configured Hooks:**
- **end-of-file-fixer**: Ensures files end with newline
- **trailing-whitespace**: Removes trailing whitespace
- **check-yaml/json/toml**: Validates config file syntax
- **ruff**: Python linting and formatting
- **mypy**: Static type checking
- **prettier**: Frontend code formatting
- **bandit**: Security vulnerability scanning

## Architecture & Structure

### Tech Stack
- **Backend**: FastAPI, SQLAlchemy 2.0, PostgreSQL, Redis, Alembic
- **Frontend**: React 18, TypeScript, Vite, TanStack Query, Zustand, Tailwind CSS v4
- **Infrastructure**: Docker Compose, Nginx (in frontend container)

### Project Structure
```
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── api/           # API route handlers  
│   │   ├── core/          # Security, image processing, config
│   │   ├── crud/          # Database operations
│   │   ├── models/        # SQLAlchemy models
│   │   └── schemas/       # Pydantic schemas
│   ├── alembic/           # Database migrations
│   ├── tests/             # Backend tests
│   └── pyproject.toml     # Python dependencies & config
├── frontend/               # React frontend
│   ├── src/
│   │   ├── api/           # API client (axios)
│   │   ├── components/    # Reusable UI components
│   │   ├── layouts/       # MainLayout, AdminLayout
│   │   ├── pages/         # Route components
│   │   │   ├── HomePage.tsx      # Landing page with hero image
│   │   │   ├── AlbumPage.tsx     # Full album with lightbox
│   │   │   └── admin/            # Admin pages
│   │   ├── stores/        # Zustand state stores
│   │   ├── types/         # TypeScript definitions
│   │   └── tailwind-safelist.css # Force Tailwind class generation
│   ├── public/images/     # Static hero images (responsive)
│   ├── package.json       # Node.js dependencies
│   └── tailwind.config.js # Tailwind configuration
├── uploads/               # Original uploaded images
├── compressed/            # Processed images (WebP, thumbnails)
└── docker-compose.yml     # Container orchestration
```

### Page Architecture
- **HomePage**: Landing page with hero image and featured content previews
- **AlbumPage**: Dedicated full-screen album with seamless photo grid (no gaps) and lightbox
- **MainLayout**: Standard header/footer layout for most pages
- **AlbumPage**: No layout wrapper for full-screen experience

### API Architecture

**Authentication:**
- `POST /api/auth/login` - Admin login (username: admin)
- `GET /api/auth/me` - Current user info  

**Photos:**
- `GET /api/photos` - List with pagination/filtering
- `GET /api/photos/featured?limit=6` - Featured photos for homepage
- `POST /api/photos` - Upload with EXIF extraction (admin)
- `PUT /api/photos/{id}` - Update metadata (admin)
- `DELETE /api/photos/{id}` - Delete photo and files (admin)

**Projects:**
- `GET /api/projects` - List projects
- `GET /api/projects/featured` - Featured for homepage  
- `POST /api/projects` - Create (admin)

**Blog:**
- `GET /api/blog` - Published posts
- `GET /api/blog/admin` - All posts including drafts (admin)

### Image Processing Pipeline
1. **Upload**: Multipart form with metadata
2. **EXIF Extraction**: Camera settings, GPS coordinates using ExifRead
3. **Processing**: Auto-rotation, WebP conversion, thumbnail generation (400px)
4. **Storage**: Original in `/uploads`, processed in `/compressed`
5. **Database**: Metadata stored in PostgreSQL

### Photo Upload System Architecture

**Frontend Components:**
- **PhotoUpload.tsx**: Main upload component with drag-and-drop, validation, and progress tracking
- **usePhotos.ts**: TanStack Query hook for photo API operations with optimistic updates
- **PhotoGrid.tsx**: Virtualized photo display with infinite scroll
- **PhotoLightbox.tsx**: PhotoSwipe integration for full-screen viewing

**Key Design Patterns:**

**1. File Object Handling**
```typescript
interface UploadFile {
  id: string;
  file: File;          // Composition over inheritance
  preview: string;     // Object URL for preview
  progress: number;    // Upload progress (0-100)
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;      // Error message if upload fails
}
```

**2. Defensive Programming**
```typescript
// Safe file size formatting
const formatFileSize = (file: File | undefined): string => {
  if (!file?.size) return '0 MB';
  return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
};

// Safe form data preparation
const prepareFormData = (file: File, metadata: any): FormData => {
  const formData = new FormData();
  formData.append('file', file);
  
  // Sanitize and provide fallbacks
  formData.append('title', metadata.title?.trim() || file.name);
  formData.append('description', metadata.description?.trim() || '');
  // ... other fields with null coalescing
};
```

**3. Error Handling Strategy**
```typescript
// Comprehensive HTTP error handling
const handleUploadError = (error: any, filename: string): string => {
  if (error.response?.status === 413) return 'File too large (max 50MB)';
  if (error.response?.status === 422) return 'Invalid file or metadata';
  if (error.response?.status === 401) return 'Authentication required';
  return `Upload failed for ${filename}`;
};
```

**Backend Architecture:**
- **ImageProcessor**: Handles EXIF extraction, WebP conversion, thumbnail generation
- **PhotoCRUD**: Database operations with async/await patterns  
- **PhotoResponse**: Pydantic schema with UUID serialization
- **File Storage**: Absolute path handling to prevent path resolution errors

### Frontend State Management
- **TanStack Query**: Server state, caching, optimistic updates
- **Zustand**: Client state (auth, UI state)
- **React Router v6**: Client-side routing with nested layouts

### Styling System
- **Tailwind CSS v4**: Utility-first styling
- **Responsive Images**: Hero image in multiple resolutions (WebP + JPEG fallbacks)
- **Custom CSS**: `/src/tailwind-safelist.css` ensures required classes are generated
- **Typography**: Merriweather serif for headings, Inter for body text

### Docker Architecture
- **frontend**: Nginx serving React build + reverse proxy to backend
- **backend**: FastAPI app with health checks
- **db**: PostgreSQL 15 with persistent volumes  
- **redis**: Redis 7 for caching
- **migrate**: One-time migration runner

## Common Development Issues

### Tailwind CSS Classes Not Applied
If spacing/styling changes don't appear:
1. Clear Docker cache: `docker system prune -f`
2. Rebuild without cache: `docker compose build --no-cache`
3. Add missing classes to `/frontend/src/tailwind-safelist.css`
4. Check `/frontend/tailwind.config.js` safelist

**CRITICAL: Tailwind CSS v4 Configuration Issue**
If padding/margin utilities (like `py-32`, `mb-24`, `gap-8`) are not working:

**Problem**: Tailwind CSS v4 changed CSS specificity due to extensive use of CSS `@layer`. Reset styles outside of `@layer base` prevent padding/margin utilities from working.

**Solution**: Ensure all reset styles are inside `@layer base` in `/frontend/src/index.css`:

```css
/* INCORRECT (v3 style) */
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
}

/* CORRECT (v4 style) */
@import "tailwindcss";

@layer base {
  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  /* All other reset styles must also be in @layer base */
}
```

**Signs this is working**: CSS bundle size increases significantly (18KB → 43KB) indicating all utilities are included.

### MyPy Type Checking Issues

**1. Async Generator Return Types**
```python
# INCORRECT
async def get_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

# CORRECT
from typing import AsyncGenerator
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
```

**2. Module Import Resolution**
- **Problem**: `ModuleNotFoundError` or mypy can't find modules in tests/
- **Solution**: Ensure `__init__.py` files exist in all test directories
```bash
touch backend/tests/__init__.py
```

**3. Pydantic Schema Inheritance Issues**
```python
# PROBLEMATIC - can cause mypy assignment errors
class PhotoUpdate(PhotoBase):
    title: str | None = None  # Conflicts with PhotoBase.title: str

# BETTER - explicit schema without inheritance
class PhotoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    # ... explicit fields
```

### Path Resolution Errors

**Backend File Processing:**
```python
# PROBLEMATIC - relative paths can fail
def process_image(self, file_path: str):
    path = Path(file_path)
    relative_path = path.relative_to(Path.cwd())  # Can fail
    
# BETTER - use absolute paths
def process_image(self, file_path: str):
    path = Path(file_path).resolve()  # Always absolute
    return str(path)  # Return string paths for consistency
```

### Database Migrations
```bash
# Create new migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker compose exec backend alembic upgrade head

# View migration history
docker compose exec backend alembic history
```

### Image Upload Issues

**Common Upload Errors:**

**1. "undefined is not an object (evaluating 'U.name.replace')"**
- **Root Cause**: UploadFile interface incorrectly extending File instead of containing File property
- **Solution**: Use composition over inheritance in TypeScript interfaces:
```typescript
// INCORRECT
interface UploadFile extends File {
  id: string;
  // ... other props
}

// CORRECT  
interface UploadFile {
  id: string;
  file: File;  // Contain File object, don't extend it
  // ... other props
}
```

**2. "NaN MB" or Size Display Issues**
- **Root Cause**: Accessing file properties on undefined objects
- **Solution**: Add defensive programming and validation:
```typescript
const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes || bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};
```

**3. "Request failed with status code 422"**
- **Root Cause**: Form data validation failing on backend
- **Solution**: Sanitize and validate form data before submission:
```typescript
const sanitizedData = {
  title: title?.trim() || filename, // Use filename fallback for empty title
  description: description?.trim() || null,
  category: category?.trim() || null,
  tags: tags?.trim() || null,
  comments: comments?.trim() || null,
};
```

**4. UUID Serialization Errors**
- **Root Cause**: Pydantic expecting string but receiving UUID object
- **Solution**: Add field validator in schemas:
```python
@field_validator("id", mode="before")
@classmethod
def convert_uuid_to_str(cls, v):
    if isinstance(v, UUID):
        return str(v)
    return v
```

**General Troubleshooting:**
- Check file size limits (50MB default)
- Verify upload directory permissions
- Check backend logs: `docker compose logs -f backend`  
- EXIF processing requires valid image files
- Test with minimal file data to isolate issues
- Use browser dev tools to inspect FormData being sent

### Authentication
- Default admin credentials: `admin` / `admin`  
- JWT tokens stored in browser localStorage
- Clear localStorage if auth issues persist

## Code Quality & Linting

### Python (Backend)
- **Ruff**: Fast Python linter replacing flake8, isort, and more
- **MyPy**: Static type checking with strict configuration
- **Bandit**: Security vulnerability scanning
- **Black** (deprecated): Replaced by ruff format

**Configuration** (`backend/pyproject.toml`):
```toml
[tool.ruff]
target-version = "py311"
line-length = 88

[tool.ruff.lint]
select = ["E", "W", "F", "I", "B", "C4", "UP"]
ignore = ["E501", "B008", "C901"]

[tool.mypy]
python_version = "3.11"
disallow_untyped_defs = true
warn_return_any = true
strict_equality = true
```

### TypeScript (Frontend)
- **ESLint**: Code quality and error detection
- **Prettier**: Code formatting and style consistency
- **TypeScript**: Strict type checking

**Common Fixes:**
```bash
# Fix all Python issues
cd backend
ruff check --fix --unsafe-fixes --preview
ruff format
mypy app/ tests/

# Fix all TypeScript issues  
cd frontend
npm run lint -- --fix
npm run format
```

### Pre-commit Integration
All quality checks run automatically on commit via pre-commit hooks. This ensures:
- No formatting inconsistencies reach the repository
- Type errors are caught before commit
- Security vulnerabilities are detected early
- All tests pass before code integration

## Testing Strategy

### Backend Tests
- **Unit Tests**: Individual functions, business logic  
- **Integration Tests**: API endpoints, database operations
- **Security Tests**: Authentication, input validation
- **Performance Tests**: Large file uploads, concurrent requests
- **Empty Field Tests**: Comprehensive coverage for null/empty input scenarios

### Frontend Tests  
- **Unit Tests**: Components, utilities (Vitest + Testing Library)
- **E2E Tests**: User flows, admin operations (Playwright)
- **Visual Tests**: Hero image, album grid layout
- **Upload Tests**: File handling, validation, error scenarios

## Deployment Notes

### Environment Variables (.env)
```bash
POSTGRES_PASSWORD=secure_password_change_this
SECRET_KEY=your-64-character-secret-key
ADMIN_PASSWORD=secure_admin_password
WEBP_QUALITY=85
THUMBNAIL_SIZE=400
```

### Production Checklist
- Set secure passwords in `.env`
- Configure proper CORS origins
- Set up SSL certificates for HTTPS
- Configure backup for PostgreSQL and upload directories
- Monitor disk space for image storage

### Performance Optimizations
- **Backend**: Async operations, database indexing, Redis caching
- **Frontend**: Code splitting, image optimization, CDN for static assets
- **Images**: WebP format with JPEG fallbacks, responsive sizes
