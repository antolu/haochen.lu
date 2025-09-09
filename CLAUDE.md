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
```

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
- Check file size limits (50MB default)
- Verify upload directory permissions
- Check backend logs: `docker compose logs -f backend`
- EXIF processing requires valid image files

### Authentication
- Default admin credentials: `admin` / `admin`  
- JWT tokens stored in browser localStorage
- Clear localStorage if auth issues persist

## Testing Strategy

### Backend Tests
- **Unit Tests**: Individual functions, business logic  
- **Integration Tests**: API endpoints, database operations
- **Security Tests**: Authentication, input validation
- **Performance Tests**: Large file uploads, concurrent requests

### Frontend Tests  
- **Unit Tests**: Components, utilities (Vitest + Testing Library)
- **E2E Tests**: User flows, admin operations (Playwright)
- **Visual Tests**: Hero image, album grid layout

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