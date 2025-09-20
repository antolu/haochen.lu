# Modern Portfolio & Photography Platform

A comprehensive full-stack web application built with **FastAPI (Python) backend** and **React (TypeScript) frontend**, featuring advanced photo management with interactive location mapping, blog system, project showcase, and authenticated sub-applications access.

## 🌟 Key Features

### Photography System
- **Interactive Photo Map**: Location-based clustering with zoom-responsive separation
- **Advanced Photo Management**: Upload with automatic EXIF extraction and GPS data processing
- **Responsive Image Processing**: 5-tier WebP optimization (thumbnail to print quality)
- **Gallery Experience**: Virtualized infinite scroll with lightbox integration
- **Location Services**: OpenStreetMap integration with geocoding and search

### Content Management
- **Project Portfolio**: GitHub/GitLab integration with automatic README fetching
- **Blog System**: Full markdown blog with draft/publish workflow and syntax highlighting
- **Sub-Applications**: Authenticated access to internal tools and external services
- **Admin Dashboard**: Comprehensive content management with location editing

### Technical Excellence
- **Modern Stack**: FastAPI + React 18 + TypeScript + PostgreSQL + Redis
- **Real-time Updates**: TanStack Query with optimistic UI updates
- **Location Clustering**: Interactive map with thumbnail previews and cluster navigation
- **Security First**: JWT authentication with enforced environment variable validation
- **Docker Ready**: Complete containerization with health checks and development tools

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd portfolio-app

# Generate secure environment variables
python -c "import secrets; print(f'SECRET_KEY={secrets.token_urlsafe(32)}')" >> .env
python -c "import secrets; print(f'SESSION_SECRET_KEY={secrets.token_urlsafe(32)}')" >> .env
echo "ADMIN_PASSWORD=your_secure_password" >> .env
```

### 2. Deploy with Development Script (Recommended)
```bash
# Start development environment with live reload
./dev.sh start

# View logs
./dev.sh logs

# Stop environment
./dev.sh stop
```

### 3. Access the Application
- **Website**: http://localhost
- **Admin**: http://localhost/admin (login with admin/your_password)
- **API Docs**: http://localhost/api/docs
- **Photography Map**: http://localhost/photography (with clustering demo data)

## 🗺️ Interactive Photo Map

Our standout feature provides an immersive way to explore photography by location:

- **Smart Clustering**: Photos automatically group by proximity with visual thumbnail previews
- **Zoom Navigation**: Clusters dynamically separate as you zoom in for detailed exploration
- **Interactive Popups**: Click clusters to view all photos with metadata and navigation
- **Grid Synchronization**: Map selections highlight and scroll to photos in the gallery
- **Global Scale**: Handles worldwide photo collections with optimized performance

## 🛠 Tech Stack

### Backend
- **FastAPI** - Modern async web framework with automatic API documentation
- **SQLAlchemy 2.0** - Async ORM with advanced relationship handling
- **PostgreSQL 15** - Primary database with JSONB support for flexible metadata
- **Redis 7** - Caching and session management
- **OpenStreetMap Nominatim** - Location services and geocoding

### Frontend
- **React 18** - Latest React with concurrent features
- **TypeScript** - Type safety with strict configuration
- **Vite** - Lightning-fast build tool and dev server
- **TanStack Query** - Server state management with optimistic updates
- **Leaflet + react-leaflet-cluster** - Interactive maps with clustering
- **Tailwind CSS v4** - Utility-first styling with modern features
- **Framer Motion** - Smooth animations and transitions

### Infrastructure
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Reverse proxy with optimized static serving
- **Alembic** - Database migrations with version control

## 📁 Project Structure

```
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # API route handlers
│   │   │   ├── photos.py      # Photo CRUD + locations endpoint
│   │   │   ├── projects.py    # Project management
│   │   │   ├── blog.py        # Blog system
│   │   │   └── locations.py   # Geocoding services
│   │   ├── core/              # Security, image processing
│   │   ├── crud/              # Database operations
│   │   ├── models/            # SQLAlchemy models
│   │   └── schemas/           # Pydantic schemas
│   ├── alembic/               # Database migrations
│   └── requirements.txt
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── PhotoMap.tsx   # Interactive clustering map
│   │   │   ├── PhotoGrid.tsx  # Virtualized photo gallery
│   │   │   ├── MapPicker.tsx  # Location selection
│   │   │   └── admin/         # Admin interface
│   │   ├── pages/             # Route components
│   │   │   ├── PhotographyPage.tsx  # Gallery + map integration
│   │   │   └── admin/         # Admin pages
│   │   ├── api/               # API client with types
│   │   └── types/             # TypeScript definitions
│   └── package.json
├── uploads/                    # Original image uploads
├── compressed/                 # Processed WebP variants
├── dev.sh                     # Development utility script
├── docker-compose.yml         # Container orchestration
├── CLAUDE.md                  # Comprehensive development guide
├── TRUENAS_DEPLOYMENT.md      # TrueNAS Scale deployment
└── .env.example              # Environment template
```

## 🔧 API Overview

### Photo System
- `GET /api/photos` - Paginated photos with filtering
- `GET /api/photos/locations` - **Optimized location data for map clustering**
- `POST /api/photos` - Upload with EXIF extraction (admin)
- `PUT /api/photos/{id}` - Update metadata with location editing (admin)

### Location Services
- `GET /api/locations/search` - Location search with autocomplete
- `POST /api/locations/geocode` - Address to coordinates
- `POST /api/locations/reverse` - Coordinates to address

### Content Management
- `GET /api/projects` - Project portfolio with repository integration
- `GET /api/blog` - Blog posts with markdown rendering
- `GET /api/subapps` - Sub-applications with authentication

## 📸 Image Processing Pipeline

1. **Upload**: Multi-part form with metadata extraction
2. **EXIF Processing**: Camera settings, GPS coordinates, timestamps using ExifRead
3. **Responsive Generation**: 5 WebP variants (400px-2400px) with quality optimization
4. **Location Enhancement**: Automatic geocoding for GPS coordinates
5. **Database Storage**: Structured metadata with JSONB variants column
6. **Map Integration**: Real-time location data for clustering display

## 🔒 Security & Configuration

### Required Environment Variables
The application enforces strict security and **will not start** without:

```env
SECRET_KEY=your_jwt_signing_key_minimum_32_characters
SESSION_SECRET_KEY=your_session_encryption_key_minimum_32_characters
ADMIN_PASSWORD=your_secure_admin_password_minimum_8_characters
```

### Generate Secure Keys
```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('SESSION_SECRET_KEY=' + secrets.token_urlsafe(32))"
```

### Production Deployment
```bash
# Set production environment
echo "ENVIRONMENT=production" >> .env
echo "COOKIE_SECURE=true" >> .env
echo "CORS_ORIGINS=https://yourdomain.com" >> .env

# Deploy
docker-compose up -d
```

## 📚 Documentation

### Development & Architecture
- **[CLAUDE.md](./CLAUDE.md)** - Comprehensive development guide, architecture details, and troubleshooting
  - Complete tech stack documentation
  - Component architecture and design patterns
  - Interactive photo map implementation details
  - Testing strategies and deployment notes
  - Common development issues and solutions

### Deployment
- **[TRUENAS_DEPLOYMENT.md](./TRUENAS_DEPLOYMENT.md)** - Step-by-step TrueNAS Scale deployment guide
  - Container service configuration
  - Dataset setup and persistent storage
  - Network and security configuration

### Development Tools
- **[dev.sh](./dev.sh)** - Comprehensive development utility script
  - `./dev.sh start` - Development environment with live reload
  - `./dev.sh test` - Run test suites
  - `./dev.sh build` - Production build
  - `./dev.sh help` - Full command reference

## 🔧 Development Workflow

### Local Development
```bash
# Start development environment
./dev.sh start

# View real-time logs
./dev.sh logs [service]

# Run tests
./dev.sh test

# Build production assets
./dev.sh build
```

### Database Management
```bash
# Create migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker compose exec backend alembic upgrade head

# View migration history
docker compose exec backend alembic history
```

### Testing
```bash
# Frontend tests
cd frontend && npm run test           # Unit tests with Vitest
cd frontend && npm run test:e2e       # E2E tests with Playwright
cd frontend && npm run test:components # Component tests

# Backend tests
docker compose exec backend pytest tests/     # All tests
docker compose exec backend pytest tests/unit/ # Unit tests only
```

## ⚡ Performance Features

### Backend Optimizations
- **Async Operations**: Full async/await architecture with FastAPI
- **Database Indexing**: Optimized queries for location data and photo metadata
- **Redis Caching**: Intelligent caching for frequently accessed data
- **Image Processing**: Efficient WebP conversion with quality optimization

### Frontend Optimizations
- **Virtualized Scrolling**: Handle large photo collections efficiently
- **Clustering Algorithms**: Optimized map rendering for thousands of photos
- **Code Splitting**: Route-based lazy loading for optimal bundle sizes
- **Image Variants**: Responsive loading with appropriate quality for context

### Map Performance
- **Chunked Loading**: Efficient marker rendering for large photo collections
- **Cluster Optimization**: Configurable radius and zoom thresholds
- **Thumbnail Caching**: Compressed variants for fast marker rendering
- **Event Debouncing**: Smooth interactions without performance degradation

## 🛡 Troubleshooting

### Common Issues
- **Map not loading**: Check OpenStreetMap service availability and network connectivity
- **Clusters not forming**: Verify photo location data exists and clustering radius configuration
- **Image upload fails**: Check file size limits (50MB default) and upload directory permissions
- **Authentication issues**: Verify JWT secret keys and admin password configuration

### Development Commands
```bash
# Reset development environment
./dev.sh stop && docker system prune -f && ./dev.sh start

# Check API documentation
open http://localhost/api/docs

# View container logs
./dev.sh logs backend
./dev.sh logs frontend
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the code style guidelines in [CLAUDE.md](./CLAUDE.md)
4. Add tests for new features
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 🆘 Support

- **Development Guide**: See [CLAUDE.md](./CLAUDE.md) for comprehensive documentation
- **API Documentation**: Visit `/api/docs` endpoint when running
- **Issues**: Open GitHub issues for bugs and feature requests
- **Security**: Report vulnerabilities privately via GitHub Security tab

---

Built with modern tools and best practices for creators and developers who demand excellence in both form and function. Features an innovative interactive photo map that transforms how users explore and discover content by location.
