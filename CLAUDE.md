# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern, full-stack portfolio website built with **FastAPI (Python) backend** and **React (TypeScript) frontend**. Features photo uploads with automatic EXIF extraction and responsive image processing, blog system, project showcase, and authenticated sub-applications access. The site uses a landing page approach with a separate album page for seamless photo browsing.

## Development Commands

### Docker Deployment (Recommended)
- Start services: `docker compose up -d`
- View logs: `docker compose logs -f backend/frontend`
- Complete rebuild: `docker system prune -f && docker compose build --no-cache && docker compose up -d`
- Run migrations: `docker compose run --rm migrate`

### Multi-platform Docker Builds
For building and pushing images to registry:
- Backend: `docker buildx build --platform linux/amd64,linux/arm64 -t antonlu/arcadia-backend:latest backend --push`
- Frontend: `docker buildx build --platform linux/amd64,linux/arm64 -t antonlu/arcadia-frontend:latest frontend --push`

For local development (loads images locally):
- Backend: `docker buildx build --platform linux/amd64,linux/arm64 -t antonlu/arcadia-backend:latest backend --load`
- Frontend: `docker buildx build --platform linux/amd64,linux/arm64 -t antonlu/arcadia-frontend:latest frontend --load`

**Note**: Use `--load` for local development, `--push` for registry deployment. When using `--push`, images are not stored locally and Docker Compose may not find them.

**Access URLs:**
- Website: http://localhost
- API Documentation: http://localhost/api/docs  
- Admin Login: admin/admin

### Local Development

#### Backend (FastAPI)
- Install: `cd backend && pip install -e .`
- Migrations: `alembic upgrade head`
- Run: `uvicorn app.main:app --reload --port 8000`

#### Frontend (React + Vite)
- Install: `cd frontend && npm install`
- Development: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

### Testing Commands

**Frontend:**
- `npm run test` (Vitest unit tests)
- `npm run test:e2e` (Playwright E2E tests)
- `npm run test:coverage` (Coverage report)
- `npm run test:components` (Component tests only)
- `npm run test:security` (Security tests only)
- `npm run test:all` (All tests including E2E)
- `npm run lint` (ESLint)

**Backend:**
- `pytest` (all tests)
- `pytest tests/unit/` (unit tests only)
- `pytest tests/integration/` (integration tests only)
- `pytest --cov=app` (with coverage)
- `ruff check --fix --unsafe-fixes --preview` (linting with fixes)
- `mypy app/ tests/` (type checking)

**Docker-based:** `docker compose exec backend python -m pytest tests/`

### Pre-commit Configuration
- Install: `pre-commit install`
- Run all: `pre-commit run --all-files`
- Manual checks: `ruff check --fix`, `ruff format`, `mypy app/ tests/`

**Configured Hooks:** end-of-file-fixer, trailing-whitespace, check-yaml/json/toml, ruff, mypy, prettier, bandit

## Architecture & Structure

### Tech Stack
- **Backend**: FastAPI, SQLAlchemy 2.0, PostgreSQL, Redis, Alembic
- **Frontend**: React 18, TypeScript, Vite, TanStack Query, Zustand, Tailwind CSS v4
- **Infrastructure**: Docker Compose, Nginx (in frontend container)

### Project Structure
- **backend/**: FastAPI backend with API routes, core services, CRUD operations, models, schemas, and tests
- **frontend/**: React frontend with components, hooks, pages, layouts, stores, and comprehensive test suites
- **uploads/**: Original uploaded images
- **compressed/**: Processed responsive images (WebP variants)

### Key Components
- **API routes**: Authentication, photos, projects, blog management, location services
- **Image processing**: EXIF extraction, responsive variants generation
- **Repository integration**: GitHub/GitLab URL validation and README fetching
- **Photo system**: Upload, processing, gallery with lightbox
- **Project management**: CRUD operations with repository integration
- **Location services**: Geocoding, reverse geocoding, location search using OpenStreetMap Nominatim
- **Admin interface**: Full management dashboard with location editing

### Page Architecture
- **HomePage**: Landing page with hero image and latest projects
- **AlbumPage**: Full-screen photo gallery with lightbox
- **ProjectsPage**: Project listing with filtering and infinite scroll
- **Admin pages**: Complete management interface

### Image Processing Pipeline
1. **Upload**: Multipart form with metadata
2. **EXIF Extraction**: Camera settings, GPS coordinates using ExifRead
3. **Processing**: Auto-rotation, responsive size generation (5 variants: 400px-2400px)
4. **Storage**: Original in `/uploads`, responsive variants in `/compressed`
5. **Database**: Metadata and variant information stored in PostgreSQL

### Responsive Image Processing
Generates 5 optimized WebP variants per image:
- **thumbnail**: 400px (75% quality) - Grid thumbnails, previews
- **small**: 800px (80% quality) - Mobile viewing
- **medium**: 1200px (85% quality) - Desktop viewing
- **large**: 1600px (90% quality) - High-res viewing
- **xlarge**: 2400px (95% quality) - Print quality

**Key Features:**
- Smart processing skips variants larger than original
- Quality optimization with higher compression for smaller sizes
- Variants stored as JSON in database with comprehensive metadata
- Utility functions for responsive loading and srcset generation

### Photo Upload System

**Frontend Components:**
- **PhotoUpload.tsx**: Drag-and-drop upload with validation and progress tracking
- **usePhotos.ts**: TanStack Query hook with optimistic updates
- **PhotoGrid.tsx**: Virtualized infinite scroll gallery
- **PhotoLightbox.tsx**: PhotoSwipe integration for full-screen viewing

**Key Design Patterns:**
- File object composition over inheritance for upload handling
- Defensive programming with safe file size formatting and form data preparation
- Comprehensive HTTP error handling with specific status code responses
- Real-time upload progress tracking and status management

**Backend Architecture:**
- **ImageProcessor**: EXIF extraction and responsive image generation
- **PhotoCRUD**: Async database operations with variants JSON storage
- **PhotoResponse**: Pydantic schema with UUID serialization
- **File Storage**: Absolute path handling for security

### Project Management System

**Frontend Components:**
- **ProjectCard.tsx**: Display with status badges, technology tags, and hover animations
- **ProjectGrid.tsx**: Infinite scroll grid with intersection observer
- **ProjectForm.tsx**: Complex form with repository integration and README preview
- **ProjectDetailPage.tsx**: Individual project view with markdown rendering
- **RepositoryConnector.tsx**: URL validation and metadata extraction
- **MarkdownRenderer.tsx**: Secure markdown display with XSS prevention

**Key Features:**
- Comprehensive project data model with repository integration fields
- GitHub/GitLab URL parsing and validation (including self-hosted)
- Automatic README fetching with caching and last-updated tracking
- Real-time repository existence checking with rate limiting
- Advanced UI patterns including infinite scroll and optimistic updates

**Backend Architecture:**
- **RepositoryService**: GitHub/GitLab API integration with authentication
- **ProjectCRUD**: Database operations with slug generation and filtering
- **README Caching**: Intelligent caching system with refresh capabilities
- **Project Validation**: URL parsing, repository validation, and sanitization

### Repository Integration System

Provides seamless connection to GitHub and GitLab repositories with automatic README fetching and validation.

**Core Features:**
- **URL Parsing**: Supports GitHub, GitLab (including self-hosted), various URL formats
- **README Fetching**: Tries multiple filenames, supports main/master branches
- **Caching**: Database storage with commit timestamp tracking for cache invalidation
- **Authentication**: Optional GitHub/GitLab tokens for increased rate limits
- **Error Handling**: Graceful degradation with fallback to project descriptions

**Frontend Integration:**
- Real-time URL validation with visual feedback
- README preview integration in project forms
- Mutation-based validation with loading states
- Parent form updates on successful validation

**Security Considerations:**
- Strict URL validation patterns prevent injection
- API tokens stored as environment variables
- Respects GitHub/GitLab rate limits
- Proper markdown content sanitization

### Frontend Component Patterns

**1. Form Management with Repository Integration**
- Complex form handling with external API validation
- Repository URL watching and automatic field population
- Integration between form state and repository validation components

**2. Infinite Scroll with Intersection Observer**
- Performance-optimized infinite scroll implementation
- Intersection observer with configurable thresholds and root margins
- Automatic loading trigger based on viewport intersection

**3. Real-time Validation with Visual Feedback**
- Live URL validation with state management
- Visual feedback system with loading, success, and error states
- Mutation-based validation with parent component communication

**4. Secure Markdown Rendering**
- XSS prevention with DOMPurify sanitization
- Syntax highlighting with rehype plugins
- Custom component mapping for secure code rendering

**5. Optimistic Updates with Error Recovery**
- TanStack Query implementation with optimistic updates
- Error recovery with state rollback mechanisms
- Query invalidation for data consistency

### Admin Photo Management System

Advanced photo editing interface with comprehensive metadata management and location services integration.

**PhotoEditForm Features:**
- **Tabbed Interface**: Organized editing across Basic Info, Location, Technical, and Custom Fields tabs
- **Location Integration**: Full map-based location editing with coordinate input and search
- **Technical Metadata**: Complete EXIF data editing including camera settings, lens, and capture details
- **Custom Fields**: Dynamic custom field system supporting text, number, date, boolean, and textarea types
- **Real-time Validation**: Form validation with error handling and success feedback
- **Responsive Design**: Mobile-friendly interface with touch-optimized map interactions

**Key Design Patterns:**
- **Tab-based Organization**: Motion-animated tab switching for intuitive navigation
- **Form State Management**: React Hook Form integration with comprehensive validation
- **Dynamic Field System**: Runtime custom field creation and management
- **Location Services Integration**: Seamless integration with location services for automatic geocoding
- **Preview Integration**: Live photo preview with variant support and file information display

**Location Editing Features:**
- **Interactive Map**: Leaflet-based map with click-to-select location functionality
- **Coordinate Input**: Manual coordinate entry with automatic location name resolution
- **Location Search**: Real-time location search with autocomplete suggestions
- **Current Location**: Browser geolocation integration for quick location selection
- **Address Override**: Manual location name and address override capabilities

**Custom Metadata System:**
- **Dynamic Fields**: Runtime addition of custom metadata fields with type selection
- **Multiple Types**: Support for text, number, date, boolean, select, and textarea field types
- **Field Management**: Add, edit, and remove custom fields with validation
- **JSON Storage**: Efficient storage of custom metadata in PostgreSQL JSONB columns
- **Type Safety**: Frontend type validation and conversion for different field types

### Shrinking Header Implementation

Dynamic navigation header that shrinks gracefully on scroll for optimal user experience.

**Key Features:**
- **Dynamic Height Scaling**: Responsive height adaptation (h-20 md:h-24 → h-16)
- **Typography Scaling**: Dramatic logo scaling with font weight changes (text-4xl → text-xl)
- **Performance**: Passive scroll listeners with 10px trigger threshold
- **Smooth Animations**: Staggered transition timing for layout and typography
- **Responsive Design**: Different scaling ratios for mobile vs desktop
- **Accessibility**: Maintains functionality while optimizing content space

**Implementation Details:**
- Scroll-based state management with granular positioning
- Enhanced typography scaling with font weight and letter spacing
- Hardware-accelerated transitions for smooth performance
- Professional appearance matching modern web design standards

### Location Services System

Modern location management using OpenStreetMap Nominatim for geocoding and search functionality.

**Backend API (`/api/locations`):**
- **Reverse Geocoding**: Convert coordinates to location names and addresses
- **Forward Geocoding**: Convert addresses to coordinates
- **Location Search**: Search for locations by name with auto-complete
- **Nearby Locations**: Find points of interest near given coordinates

**Core Features:**
- **OpenStreetMap Integration**: Uses Nominatim API for all location services
- **Async Operations**: Non-blocking geocoding operations using asyncio
- **Intelligent Parsing**: Smart location name generation prioritizing city > town > village
- **Distance Calculations**: Haversine formula for accurate distance measurements
- **Rate Limiting**: Respectful API usage with proper timeouts and error handling

**Frontend Components:**
- **LocationInput**: Comprehensive location input with coordinates, name override, and current location
- **MapPicker**: Interactive Leaflet map with click-to-select and search functionality
- **MiniMap**: Compact map display for showing photo locations
- **PhotoMap**: Full map view showing all photos with location data

**Frontend Integration:**
- **Interactive Maps**: Leaflet-based maps with OpenStreetMap tiles
- **Location Search**: Real-time location search with debounced autocomplete
- **Current Location**: Browser geolocation API integration
- **Visual Feedback**: Loading states, error handling, and success indicators

**Admin Integration:**
- **PhotoEditForm**: Full location editing with map picker and coordinate input
- **Location Override**: Manual location name override capability
- **GPS Data Enhancement**: Automatic location name resolution from EXIF GPS coordinates

### Frontend State Management
- **TanStack Query**: Server state, caching, optimistic updates
- **Zustand**: Client state (auth, UI state)
- **React Router v6**: Client-side routing with nested layouts

### Styling System
- **Tailwind CSS v4**: Utility-first styling with safelist for dynamic classes
- **Responsive Images**: Hero images in multiple resolutions (WebP + JPEG fallbacks)
- **Typography**: Merriweather serif for headings, Inter for body text

### Docker Architecture
- **frontend**: Nginx serving React build + reverse proxy to backend
- **backend**: FastAPI app with health checks
- **db**: PostgreSQL 15 with persistent volumes  
- **redis**: Redis 7 for caching and sessions
- **migrate**: One-time migration runner for database schema updates

**Container Naming:** All containers use `portfolio-` prefix (frontend, backend, db, redis, migrate)
**Database:** Default name is `portfolio`

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

### Image Upload Issues

**Common Upload Errors:**
1. **"undefined is not an object"**: Use composition over inheritance in TypeScript interfaces (contain File object, don't extend it)
2. **"NaN MB" displays**: Add defensive programming for file size formatting with proper validation
3. **"Request failed with status code 422"**: Sanitize and validate form data before submission (trim strings, provide fallbacks)
4. **UUID Serialization Errors**: Add field validators in Pydantic schemas to convert UUID objects to strings

**General Troubleshooting:**
- Check file size limits (50MB default) and upload directory permissions
- Check backend logs: `docker compose logs -f backend`
- EXIF processing requires valid image files
- Use browser dev tools to inspect FormData being sent

### Authentication
- Default admin credentials: `admin` / `admin`
- JWT tokens stored in browser localStorage
- Clear localStorage if auth issues persist

## Code Quality & Linting

### Python (Backend)
- **Ruff**: Fast Python linter (replaces flake8, isort, black)
- **MyPy**: Static type checking with strict configuration
- **Bandit**: Security vulnerability scanning

### TypeScript (Frontend)
- **ESLint**: Code quality and error detection
- **Prettier**: Code formatting and style consistency
- **TypeScript**: Strict type checking

**Quick Fixes:**
- Python: `ruff check --fix && ruff format && mypy app/ tests/`
- Frontend: `npm run lint -- --fix && npm run format`

### Pre-commit Integration
Automatic quality checks on commit ensure:
- No formatting inconsistencies
- Type errors caught before commit
- Security vulnerabilities detected early
- All tests pass before integration

## Testing Strategy

### Backend Tests
- **Unit Tests**: Individual functions, business logic
- **Integration Tests**: API endpoints, database operations
- **Security Tests**: Authentication, input validation
- **Performance Tests**: Large file uploads, concurrent requests
- **Repository Integration Tests**: GitHub/GitLab API mocking, README fetching, URL validation
- **Project CRUD Tests**: Database operations, slug generation, filtering

### Frontend Tests
- **Unit Tests**: Components, utilities (Vitest + Testing Library)
- **E2E Tests**: User flows, admin operations (Playwright)
- **Visual Tests**: Hero image, album grid layout
- **Upload Tests**: File handling, validation, error scenarios
- **Project Management Tests**: CRUD operations, infinite scroll, repository integration

**Component Testing Coverage:**
- ProjectCard, ProjectGrid, ProjectForm, RepositoryConnector, MarkdownRenderer
- LocationInput, MapPicker, MiniMap, PhotoMap components
- PhotoEditForm with location editing functionality
- Hook testing for useProjects, infinite scroll, repository validation
- E2E flows for project creation, management, repository integration, location services
- Map interaction testing for location selection and search
- Accessibility compliance (WCAG 2.1 AA), keyboard navigation, screen reader support

## Deployment Notes

### Environment Variables (.env)
**Required Security Variables** (Application will not start without these):
- `SECRET_KEY` - JWT signing key (minimum 32 characters)
- `SESSION_SECRET_KEY` - Session encryption key (minimum 32 characters)
- `ADMIN_PASSWORD` - Admin user password (minimum 8 characters)

**Optional Configuration:**
- `POSTGRES_DB=portfolio`, `POSTGRES_PASSWORD` - Database settings
- `ENVIRONMENT=development` or `production` - Environment detection
- `WEBP_QUALITY=85`, `THUMBNAIL_SIZE=400` - Image processing
- `COOKIE_SECURE=true`, `CORS_ORIGINS` - Production security settings

### Security Validation
- **Startup Validation**: Checks all required environment variables before starting
- **No Fallbacks**: Removed hardcoded secrets and default values
- **Production Mode**: Enhanced validation when `ENVIRONMENT=production`

### Production Checklist
- Set secure passwords in `.env`
- Configure proper CORS origins and SSL certificates
- Set up PostgreSQL and upload directory backups
- Monitor disk space for image storage

### Performance Optimizations
- **Backend**: Async operations, database indexing, Redis caching
- **Frontend**: Code splitting, image optimization, CDN for static assets
- **Images**: 5 responsive WebP variants with quality optimization per size
- **Performance Benefits**: 90% smaller thumbnails, 70% mobile bandwidth reduction, 43% desktop file size reduction

## Responsive Image Configuration

### Backend Configuration
- **Responsive sizes**: thumbnail (400px), small (800px), medium (1200px), large (1600px), xlarge (2400px)
- **Quality settings**: Higher compression for smaller images (75%-95% quality)
- **Usage functions**: `get_image_url()` and `get_image_srcset()` for responsive loading

### Frontend Usage
- Responsive image components with automatic size selection
- Srcset generation for optimal loading across devices
- Fallback handling for legacy image paths

### Database Migration
The `002_enhance_photo_metadata.py` migration adds the variants JSONB column to store responsive image metadata and enhances location support. Key changes:
- **Variants Column**: JSONB storage for all responsive image variants with metadata
- **Enhanced Location**: Additional location fields for comprehensive geocoding support
- **Custom Metadata**: JSONB column for flexible custom field storage
- **Legacy Cleanup**: Removal of deprecated `webp_path` and `thumbnail_path` columns

### Location Data Structure
Enhanced photo location storage includes:
- **Coordinates**: `location_lat`, `location_lon` for precise positioning
- **Names**: `location_name` for display, `location_address` for full geocoded address
- **Elevation**: `altitude` field for GPS elevation data
- **Timezone**: `timezone` field for accurate datetime handling
