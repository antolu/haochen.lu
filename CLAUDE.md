# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern, full-stack portfolio website built with **FastAPI (Python) backend** and **React (TypeScript) frontend**. Features photo uploads with automatic EXIF extraction and responsive image processing, blog system, project showcase, and authenticated sub-applications access. The site uses a landing page approach with a separate album page for seamless photo browsing.

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
│   │   │   ├── projects.py        # Project CRUD and repository integration
│   │   │   ├── photos.py          # Photo upload and management
│   │   │   └── blog.py            # Blog post management
│   │   ├── core/          # Security, image processing, config
│   │   │   ├── repository_service.py  # GitHub/GitLab integration
│   │   │   ├── image_processor.py     # Photo processing pipeline
│   │   │   └── security.py            # Authentication and authorization
│   │   ├── crud/          # Database operations
│   │   │   ├── project.py         # Project database operations
│   │   │   ├── photo.py           # Photo database operations
│   │   │   └── blog.py            # Blog database operations
│   │   ├── models/        # SQLAlchemy models
│   │   │   ├── project.py         # Project model with repository fields
│   │   │   ├── photo.py           # Photo model with EXIF data
│   │   │   └── blog.py            # Blog post model
│   │   └── schemas/       # Pydantic schemas
│   │       ├── project.py         # Project validation schemas
│   │       ├── photo.py           # Photo upload schemas
│   │       └── blog.py            # Blog post schemas
│   ├── alembic/           # Database migrations
│   ├── tests/             # Backend tests
│   └── pyproject.toml     # Python dependencies & config
├── frontend/               # React frontend
│   ├── src/
│   │   ├── api/           # API client (axios)
│   │   ├── components/    # Reusable UI components
│   │   │   ├── ProjectCard.tsx        # Project display component
│   │   │   ├── ProjectGrid.tsx        # Infinite scroll project grid
│   │   │   ├── ProjectForm.tsx        # Project creation/editing form
│   │   │   ├── RepositoryConnector.tsx # Repository URL validation
│   │   │   ├── MarkdownRenderer.tsx   # Secure markdown display
│   │   │   ├── PhotoUpload.tsx        # Photo upload with drag-drop
│   │   │   └── PhotoGrid.tsx          # Photo gallery component
│   │   ├── hooks/         # Custom React hooks
│   │   │   ├── useProjects.ts         # Project data management
│   │   │   ├── usePhotos.ts           # Photo data management
│   │   │   └── useBlog.ts             # Blog data management
│   │   ├── layouts/       # MainLayout, AdminLayout
│   │   ├── pages/         # Route components
│   │   │   ├── HomePage.tsx           # Landing page with hero image
│   │   │   ├── AlbumPage.tsx          # Full album with lightbox
│   │   │   ├── ProjectsPage.tsx       # Project listing with filters
│   │   │   ├── ProjectDetailPage.tsx  # Individual project view
│   │   │   └── admin/                 # Admin pages
│   │   │       ├── AdminProjects.tsx  # Project management dashboard
│   │   │       ├── AdminPhotos.tsx    # Photo management dashboard
│   │   │       └── AdminBlog.tsx      # Blog management dashboard
│   │   ├── test/          # Frontend tests
│   │   │   ├── components/            # Component unit tests
│   │   │   ├── hooks/                 # Hook unit tests
│   │   │   ├── pages/                 # Page component tests
│   │   │   ├── integration/           # API integration tests
│   │   │   ├── e2e/                   # End-to-end tests
│   │   │   ├── fixtures/              # Test data and factories
│   │   │   └── utils/                 # Test utilities and helpers
│   │   ├── stores/        # Zustand state stores
│   │   ├── types/         # TypeScript definitions
│   │   └── tailwind-safelist.css # Force Tailwind class generation
│   ├── public/images/     # Static hero images (responsive)
│   ├── package.json       # Node.js dependencies
│   └── tailwind.config.js # Tailwind configuration
├── uploads/               # Original uploaded images
├── compressed/            # Processed responsive images (WebP variants)
└── docker-compose.yml     # Container orchestration
```

### Page Architecture
- **HomePage**: Landing page with hero image and latest projects (shows 4 most recent active projects)
- **AlbumPage**: Dedicated full-screen album with seamless photo grid (no gaps) and lightbox
- **MainLayout**: Standard header/footer layout with dynamic shrinking navigation header
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
- `GET /api/projects` - List projects with pagination/filtering
- `GET /api/projects/featured` - Featured projects for homepage
- `GET /api/projects/{id_or_slug}` - Get specific project by ID or slug
- `GET /api/projects/{id_or_slug}/readme` - Get project README content
- `POST /api/projects` - Create project (admin)
- `PUT /api/projects/{id}` - Update project (admin)
- `DELETE /api/projects/{id}` - Delete project (admin)
- `GET /api/projects/stats/summary` - Project statistics (admin)
- `POST /api/projects/repository/validate` - Validate repository URL (admin)

**Blog:**
- `GET /api/blog` - Published posts
- `GET /api/blog/admin` - All posts including drafts (admin)

### Image Processing Pipeline
1. **Upload**: Multipart form with metadata
2. **EXIF Extraction**: Camera settings, GPS coordinates using ExifRead
3. **Processing**: Auto-rotation, responsive size generation (5 variants: 400px-2400px)
4. **Storage**: Original in `/uploads`, responsive variants in `/compressed`
5. **Database**: Metadata and variant information stored in PostgreSQL

### Responsive Image Processing
The application generates multiple optimized sizes for each uploaded image:

**Image Variants Generated:**
- **thumbnail**: 400px (75% quality) - Grid thumbnails, previews
- **small**: 800px (80% quality) - Mobile viewing
- **medium**: 1200px (85% quality) - Desktop viewing
- **large**: 1600px (90% quality) - High-res viewing
- **xlarge**: 2400px (95% quality) - Print quality

**Storage Structure:**
```
compressed/
├── {uuid}_thumbnail.webp  # 400px variant
├── {uuid}_small.webp      # 800px variant
├── {uuid}_medium.webp     # 1200px variant
├── {uuid}_large.webp      # 1600px variant
└── {uuid}_xlarge.webp     # 2400px variant
```

**Database Schema:**
```json
{
  "variants": {
    "thumbnail": {
      "path": "compressed/abc123_thumbnail.webp",
      "filename": "abc123_thumbnail.webp",
      "width": 400,
      "height": 300,
      "size_bytes": 15000,
      "format": "webp"
    }
    // ... other variants
  }
}
```

**Key Features:**
- **Smart Processing**: Skips variants larger than original image
- **Quality Optimization**: Higher compression for smaller sizes
- **Backward Compatibility**: Legacy `webp_path` and `thumbnail_path` maintained
- **Utility Functions**: `get_image_url()` and `get_image_srcset()` for responsive loading

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
- **ImageProcessor**: Handles EXIF extraction, responsive image generation (5 variants), optimized quality per size
- **PhotoCRUD**: Database operations with async/await patterns, variants JSON storage
- **PhotoResponse**: Pydantic schema with UUID serialization and ImageVariant nested schema
- **File Storage**: Absolute path handling to prevent path resolution errors
- **Migration**: `001_add_variants_column.py` adds JSON column for responsive image metadata

### Project Management System Architecture

**Frontend Components:**
- **ProjectCard.tsx**: Project display with status badges, technology tags, and hover animations
- **ProjectGrid.tsx**: Infinite scroll grid with intersection observer for performance
- **ProjectForm.tsx**: Complex form with repository integration and README preview
- **ProjectDetailPage.tsx**: Individual project view with markdown rendering
- **RepositoryConnector.tsx**: Repository URL validation and metadata extraction
- **MarkdownRenderer.tsx**: Secure markdown display with syntax highlighting and XSS prevention

**Key Features:**

**1. Project Data Model**
```typescript
interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description?: string;  // Manual one-liner for homepage
  github_url?: string;
  demo_url?: string;
  image_url?: string;
  technologies?: string;       // JSON array of tech stack
  featured: boolean;
  status: 'active' | 'archived' | 'in_progress';

  // Repository Integration
  repository_type?: 'github' | 'gitlab';
  repository_owner?: string;
  repository_name?: string;
  use_readme?: boolean;        // Use repo README vs manual description
  readme_content?: string;     // Cached README content
  readme_last_updated?: string;
}
```

**2. Repository Integration**
- **URL Parsing**: Supports GitHub and GitLab URLs (including self-hosted)
- **README Fetching**: Automatic caching with last-updated tracking
- **Validation**: Real-time repository existence checking
- **Branch Handling**: Supports both main and master branches
- **Rate Limiting**: Respects API limits with proper error handling

**3. Advanced UI Patterns**
```typescript
// Infinite scroll with intersection observer
const { data, fetchNextPage, hasNextPage } = useInfiniteProjects(filters);

// Repository validation with real-time feedback
const validateRepo = useMutation({
  mutationFn: (url: string) => api.post('/projects/repository/validate', { repository_url: url }),
  onSuccess: (data) => setRepoInfo(data)
});

// README preview with caching
const { data: readme } = useQuery({
  queryKey: ['project-readme', projectId, refresh],
  queryFn: () => api.get(`/projects/${projectId}/readme?refresh=${refresh}`)
});
```

**Backend Architecture:**
- **RepositoryService**: GitHub/GitLab API integration with token authentication
- **ProjectCRUD**: Database operations with slug generation and filtering
- **README Caching**: Intelligent caching system with refresh capabilities
- **Project Validation**: URL parsing, repository validation, and data sanitization

### Repository Integration System

The repository integration system provides seamless connection to GitHub and GitLab repositories, enabling automatic README fetching and repository validation.

**RepositoryService Architecture:**

**1. URL Parsing and Validation**
```python
class RepositoryInfo(BaseModel):
    type: str       # 'github' or 'gitlab'
    owner: str      # Username or organization
    name: str       # Repository name
    url: str        # Original URL

def parse_repository_url(url: str) -> RepositoryInfo | None:
    # Supports patterns:
    # - https://github.com/owner/repo
    # - git@github.com:owner/repo.git
    # - https://gitlab.com/owner/repo
    # - https://custom-gitlab.com/owner/repo (self-hosted)
```

**2. README Fetching Strategy**
```python
async def fetch_readme(repo_info: RepositoryInfo) -> tuple[str | None, datetime | None]:
    # Try multiple README filenames: README.md, readme.md, README.rst, README.txt, README
    # Fetch raw content from main/master branch
    # Get last commit date for the README file
    # Return content and last_updated timestamp
```

**3. Caching and Performance**
- **Database Caching**: README content stored in projects table
- **Last Updated Tracking**: Commit timestamps for cache invalidation
- **Refresh Parameter**: Manual cache busting for updated content
- **Fallback Strategy**: Use project description if README unavailable

**4. Authentication and Rate Limiting**
```python
# Environment variables for API tokens
GITHUB_TOKEN=your_github_token    # Optional, increases rate limits
GITLAB_TOKEN=your_gitlab_token    # Optional, for private repos

# Headers automatically added when tokens available
headers = {"Authorization": f"token {github_token}"}  # GitHub
headers = {"PRIVATE-TOKEN": gitlab_token}              # GitLab
```

**5. Error Handling and Resilience**
```python
# Graceful degradation strategy
try:
    readme_content, last_updated = await repository_service.fetch_readme(repo_info)
    if readme_content:
        # Cache in database and return
        await update_project_readme(db, project.id, readme_content, last_updated)
        return ReadmeResponse(content=readme_content, source=repo_info.type)
except Exception:
    # Fallback to project description
    return ReadmeResponse(content=project.description, source=None)
```

**Frontend Integration:**

**1. RepositoryConnector Component**
```typescript
// Real-time URL validation with visual feedback
const RepositoryConnector: React.FC<Props> = ({ onChange, onValidationChange }) => {
  const validateMutation = useMutation({
    mutationFn: (url: string) => api.post('/projects/repository/validate', { repository_url: url }),
    onSuccess: (data) => {
      setRepoInfo(data);           // Display repo metadata
      onValidationChange(true);    // Enable form submission
      onChange({                   // Update parent form
        url: data.url,
        type: data.type,
        owner: data.owner,
        name: data.name
      });
    }
  });
};
```

**2. README Preview Integration**
```typescript
// ProjectForm with README preview
const { data: readmePreview, isLoading } = useQuery({
  queryKey: ['readme-preview', repoInfo],
  queryFn: () => repository_service.fetch_readme(repoInfo),
  enabled: !!repoInfo && useReadme
});
```

**Security Considerations:**
- **URL Validation**: Strict regex patterns prevent injection
- **Token Security**: API tokens stored as environment variables
- **Rate Limiting**: Respects GitHub/GitLab API limits
- **Content Sanitization**: Markdown content properly escaped in frontend
- **CORS Protection**: Backend validates origin for repository requests

### Frontend Component Patterns

**1. Form Management with Repository Integration**
```typescript
// ProjectForm.tsx - Complex form with external API validation
const ProjectForm: React.FC<Props> = ({ project, onSuccess }) => {
  const { register, handleSubmit, watch, setValue } = useForm<FormData>();
  const [repoInfo, setRepoInfo] = useState<RepositoryInfo | null>(null);

  // Watch for repository URL changes
  const githubUrl = watch('github_url');

  // Handle repository validation success
  const handleRepositoryValidation = (data: RepositoryInfo) => {
    setRepoInfo(data);
    setValue('repository_type', data.type);
    setValue('repository_owner', data.owner);
    setValue('repository_name', data.name);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <RepositoryConnector
        value={githubUrl}
        onChange={handleRepositoryValidation}
      />
      {/* Other form fields */}
    </form>
  );
};
```

**2. Infinite Scroll with Intersection Observer**
```typescript
// ProjectGrid.tsx - Performance-optimized infinite scroll
const ProjectGrid: React.FC<Props> = ({ projects, onLoadMore, hasMore }) => {
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  useEffect(() => {
    if (inView && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [inView, hasMore, isLoadingMore]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
      {hasMore && <div ref={ref} className="col-span-full h-10" />}
    </div>
  );
};
```

**3. Real-time Validation with Visual Feedback**
```typescript
// RepositoryConnector.tsx - Live URL validation
const RepositoryConnector: React.FC<Props> = ({ onChange, onValidationChange }) => {
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');

  const validateMutation = useMutation({
    mutationFn: (url: string) => api.post('/projects/repository/validate', { repository_url: url }),
    onMutate: () => setValidationState('validating'),
    onSuccess: (data) => {
      setValidationState('success');
      onChange(data);
      onValidationChange?.(true);
    },
    onError: () => {
      setValidationState('error');
      onValidationChange?.(false);
    }
  });

  const getValidationIcon = () => {
    switch (validationState) {
      case 'validating': return <Spinner />;
      case 'success': return <CheckIcon className="text-green-500" />;
      case 'error': return <XIcon className="text-red-500" />;
      default: return null;
    }
  };
};
```

**4. Secure Markdown Rendering**
```typescript
// MarkdownRenderer.tsx - XSS prevention with syntax highlighting
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const sanitizedContent = useMemo(() => {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'a', 'ul', 'ol', 'li', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'class', 'id'],
    });
  }, [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: ({ className, children }) => (
          <code className={`${className} bg-gray-100 rounded px-1`}>
            {children}
          </code>
        ),
      }}
    >
      {sanitizedContent}
    </ReactMarkdown>
  );
};
```

**5. Optimistic Updates with Error Recovery**
```typescript
// useProjects.ts - TanStack Query with optimistic updates
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (project: ProjectCreate) => api.post('/projects', project),
    onMutate: async (newProject) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['projects'] });

      // Snapshot previous value
      const previousProjects = queryClient.getQueryData(['projects']);

      // Optimistically update
      queryClient.setQueryData(['projects'], (old: any) => ({
        ...old,
        projects: [createOptimisticProject(newProject), ...old.projects],
      }));

      return { previousProjects };
    },
    onError: (err, newProject, context) => {
      // Rollback on error
      queryClient.setQueryData(['projects'], context?.previousProjects);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
```

### Shrinking Header Implementation

The main navigation header features a dynamic shrinking behavior that provides an optimal user experience by starting with a prominent presence and gracefully adapting as users scroll.

**Header Behavior:**

**1. Dynamic Height Scaling**
```typescript
// Responsive height adaptation
const headerHeight = isScrolled ? 'h-16' : 'h-20 md:h-24';

// Scroll-based states with granular positioning
const [scrollY, setScrollY] = useState(0);
const isScrolled = scrollY > 10; // Quick response threshold
```

**2. Enhanced Typography Scaling**
```typescript
// Dramatic logo scaling with font weight and letter spacing
const logoClasses = isScrolled
  ? 'text-lg md:text-xl font-semibold tracking-tight'    // Collapsed: compact, efficient
  : 'text-2xl md:text-4xl font-bold tracking-normal';   // Expanded: prominent, welcoming

// Navigation text with proper hierarchy
const navClasses = isScrolled
  ? 'text-xs md:text-sm font-medium tracking-normal'    // Collapsed: readable, space-efficient
  : 'text-base md:text-lg font-normal tracking-wide';   // Expanded: spacious, elegant
```

**3. Performance Optimizations**
```typescript
// Passive scroll listeners for better performance
useEffect(() => {
  const handleScroll = () => {
    const currentScrollY = window.scrollY;
    setScrollY(currentScrollY);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

**4. Smooth Animation System**
```typescript
// Staggered transition timing for better perception
transition-all duration-500 ease-out  // Layout changes: smooth, elegant
transition-all duration-300 ease-out  // Typography: snappy, responsive
```

**Key Features:**
- **Immediate Response**: Triggers at 10px scroll for instant feedback
- **Dramatic Scaling**: 4:1 logo size ratio (text-4xl → text-xl) on desktop
- **Typography Hierarchy**: Dynamic font weights and letter spacing
- **Responsive Design**: Different scaling ratios for mobile vs desktop
- **Performance**: Passive event listeners and hardware-accelerated transitions
- **Accessibility**: Maintains navigation functionality while optimizing space

**Visual Result:**
Professional shrinking header that starts with commanding presence and gracefully adapts to maximize content space, matching modern web design standards.

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
- **redis**: Redis 7 for caching and sessions
- **migrate**: One-time migration runner for database schema updates

### Container Naming Convention
All containers use `portfolio-` prefix:
- `portfolio-frontend`: React app served by Nginx
- `portfolio-backend`: FastAPI application
- `portfolio-db`: PostgreSQL database
- `portfolio-redis`: Redis cache/session store
- `portfolio-migrate`: Migration container

### Database Connection
Default database name: `portfolio` (updated from `photography`)

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
- **Repository Integration Tests**: GitHub/GitLab API mocking, README fetching, URL validation
- **Project CRUD Tests**: Database operations, slug generation, filtering

### Frontend Tests
- **Unit Tests**: Components, utilities (Vitest + Testing Library)
- **E2E Tests**: User flows, admin operations (Playwright)
- **Visual Tests**: Hero image, album grid layout
- **Upload Tests**: File handling, validation, error scenarios
- **Project Management Tests**: CRUD operations, infinite scroll, repository integration
- **Component Testing**:
  - **ProjectCard**: Status badges, technology tags, external links, image fallbacks
  - **ProjectGrid**: Infinite scroll with intersection observer, responsive behavior
  - **ProjectForm**: Complex form validation, repository integration, README preview
  - **RepositoryConnector**: URL validation, real-time feedback, error handling
  - **MarkdownRenderer**: Security (XSS prevention), syntax highlighting, copy-to-clipboard
- **Hook Testing**:
  - **useProjects**: Query hooks, mutations, cache management, utility functions
  - **Infinite scroll**: Loading states, hasMore logic, fetchNextPage integration
  - **Repository validation**: URL parsing, validation responses, error handling
- **E2E Project Tests**:
  - **Project Creation Flow**: Form submission, repository integration, validation
  - **Project Management**: Create, read, update, delete operations with admin auth
  - **Repository Integration**: URL validation, README fetching, preview functionality
  - **Search and Filtering**: Project search, status filtering, technology filtering
  - **Accessibility**: WCAG 2.1 AA compliance, keyboard navigation, screen reader support

## Deployment Notes

### Environment Variables (.env)
```bash
# Required Security Variables (Application will not start without these)
SECRET_KEY=your_64_character_secret_key_minimum_32_chars
SESSION_SECRET_KEY=your_session_secret_key_minimum_32_chars
ADMIN_PASSWORD=your_admin_password_minimum_8_chars

# Database
POSTGRES_DB=portfolio
POSTGRES_PASSWORD=secure_password_change_this

# Environment Detection
ENVIRONMENT=development  # or 'production'

# Image Processing
WEBP_QUALITY=85
THUMBNAIL_SIZE=400

# Database URL for development
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/portfolio

# Production Additional Settings
COOKIE_SECURE=true      # for HTTPS deployments
CORS_ORIGINS=https://yourdomain.com
```

### 🔐 **Security Validation**
The application now enforces strict security requirements:
- **Startup Validation**: Application checks all required environment variables before starting
- **No Fallbacks**: Removed all hardcoded secrets and default values for security-critical variables
- **Clear Errors**: Specific error messages guide developers to fix configuration issues
- **Production Mode**: Enhanced validation when `ENVIRONMENT=production`

### Production Checklist
- Set secure passwords in `.env`
- Configure proper CORS origins
- Set up SSL certificates for HTTPS
- Configure backup for PostgreSQL and upload directories
- Monitor disk space for image storage

### Performance Optimizations
- **Backend**: Async operations, database indexing, Redis caching
- **Frontend**: Code splitting, image optimization, CDN for static assets  
- **Images**: 5 responsive WebP variants (400px-2400px), quality optimization per size
- **Storage**: Automatic size skipping for small originals, efficient file organization

### Image Performance Benefits
- **Gallery Thumbnails**: 90% smaller files (400px vs full size)
- **Mobile Viewing**: 70% bandwidth reduction (800px optimized)
- **Desktop Viewing**: 43% smaller files (1200px vs original)
- **Smart Loading**: Browser selects appropriate size automatically

## Environment Variables & Security

### Required Environment Variables
**Critical:** All deployments now require these environment variables. The application **will not start** without them:

- `SECRET_KEY` - JWT signing key (minimum 32 characters)
- `SESSION_SECRET_KEY` - Session encryption key (minimum 32 characters) 
- `ADMIN_PASSWORD` - Admin user password (minimum 8 characters)

### Security Features
- ✅ **No backwards compatibility** - Removed all hardcoded secrets and default fallbacks
- ✅ **Strict validation** - Application fails fast with clear error messages if requirements not met
- ✅ **Key length enforcement** - SECRET_KEY and SESSION_SECRET_KEY must be 32+ characters
- ✅ **Password strength** - ADMIN_PASSWORD must be 8+ characters
- ✅ **Production mode** - Enforces HTTPS cookies when `ENVIRONMENT=production`
- ✅ **Environment detection** - Different validation rules for development vs production

### Configuration Files
- `backend/.env` - Environment variables (not committed to git)
- `ENVIRONMENT_SETUP.md` - Complete setup guide with examples
- `docker-compose.yml` - No default values for security-critical variables

### Quick Setup Examples

**Development:**
```bash
# Generate secure keys
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('SESSION_SECRET_KEY=' + secrets.token_urlsafe(32))"

# Create .env file
cat > .env << 'EOF'
SECRET_KEY=generated_key_from_above
SESSION_SECRET_KEY=generated_key_from_above
ADMIN_PASSWORD=admin
EOF
```

**Production:**
```bash
# Create production .env file
cat > .env << 'EOF'
ENVIRONMENT=production
SECRET_KEY=your_production_secret_key_minimum_32_chars
SESSION_SECRET_KEY=your_production_session_key_minimum_32_chars
ADMIN_PASSWORD=your_secure_admin_password
COOKIE_SECURE=true
CORS_ORIGINS=https://yourdomain.com
EOF
```

### Validation Behavior
- **Development**: Provides helpful fallbacks while still requiring environment variables
- **Production**: Strict validation with no fallbacks, enforces HTTPS settings
- **Startup**: Application validates all requirements before starting any services

## Responsive Image Configuration

### Backend Configuration (`backend/app/config.py`)
```python
# Responsive image sizes
responsive_sizes: dict = {
    "thumbnail": 400,   # Grid thumbnails, previews
    "small": 800,       # Mobile viewing
    "medium": 1200,     # Desktop viewing
    "large": 1600,      # High-res viewing
    "xlarge": 2400,     # Print quality
}

# Quality settings per size (higher compression for smaller images)
quality_settings: dict = {
    "thumbnail": 75,    # Aggressive compression
    "small": 80,        # Good mobile compression
    "medium": 85,       # Balanced quality/size
    "large": 90,        # High quality
    "xlarge": 95,       # Maximum quality
}
```

### Frontend Usage Examples
```typescript
// Get specific image size with fallback
const imageUrl = ImageProcessor.get_image_url(photo, "medium");

// Generate responsive srcset
const srcSet = ImageProcessor.get_image_srcset(photo);

// React component example
<img
  src={photo.variants?.medium?.path || photo.webp_path}
  srcSet={Object.entries(photo.variants || {})
    .map(([_, variant]) => `${variant.path} ${variant.width}w`)
    .join(', ')}
  sizes="(max-width: 768px) 400px, (max-width: 1024px) 800px, 1200px"
  alt={photo.title}
  loading="lazy"
/>
```

### Database Migration
The `001_add_variants_column.py` migration adds:
```sql
ALTER TABLE photos ADD COLUMN variants JSONB;
```

This stores all responsive image metadata in a structured format. Legacy `webp_path` and `thumbnail_path` columns have been removed.
