# Modern Photography Portfolio & Blog

A comprehensive full-stack web application built with FastAPI (Python) backend and React (TypeScript) frontend, featuring photography portfolio, blog system, project showcase, and authenticated sub-applications access.

## 🌟 Features

### Core Functionality
- **Advanced Photo Management**: Upload with automatic EXIF extraction, GPS data, and image optimization
- **Blog System**: Full markdown blog with draft/publish workflow
- **Project Portfolio**: Showcase with live demos and GitHub integration
- **Sub-Applications**: Authenticated access to internal tools and external services
- **Admin Dashboard**: Comprehensive content management system

### Technical Features
- **Modern Stack**: FastAPI + React + TypeScript + PostgreSQL + Redis
- **Image Processing**: WebP conversion, compression, thumbnails, auto-rotation
- **Authentication**: JWT-based with role-based access control
- **Real-time Updates**: React Query for optimistic UI updates
- **Responsive Design**: Mobile-first with Tailwind CSS
- **Docker Ready**: Complete containerization with health checks

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)
- Git

### Docker Deployment (Recommended)

1. **Clone and setup**
   ```bash
   git clone <your-repo-url>
   cd photography-portfolio
   cp .env.example .env
   # Edit .env with your secure passwords
   ```

2. **Deploy with Docker**
   ```bash
   docker-compose up -d
   ```

3. **Run migrations**
   ```bash
   docker-compose run --rm migrate
   ```

4. **Access the application**
   - Website: http://localhost
   - Admin: http://localhost/admin (login with admin/your-password)
   - API Docs: http://localhost/api/docs

### Local Development

#### Backend Setup
```bash
cd backend
pip install -r requirements.txt
# Set up PostgreSQL and Redis locally
alembic upgrade head
uvicorn app.main:app --reload
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🛠 Tech Stack

### Backend (FastAPI)
- **FastAPI** - Modern async web framework
- **SQLAlchemy 2.0** - ORM with async support
- **Alembic** - Database migrations
- **PostgreSQL** - Primary database
- **Redis** - Caching and sessions
- **Pillow** - Image processing
- **ExifRead** - EXIF data extraction
- **Celery** - Background tasks (optional)

### Frontend (React)
- **React 18** with TypeScript
- **Vite** - Build tool and dev server
- **React Router v6** - Client-side routing
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Animations
- **React Hook Form** - Form handling
- **Headless UI** - Accessible components

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **Nginx** - Reverse proxy (in frontend container)
- **PostgreSQL 15** - Relational database
- **Redis 7** - Cache and session store

## 📁 Project Structure

```
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── api/           # API route handlers
│   │   ├── core/          # Security, image processing
│   │   ├── crud/          # Database operations
│   │   ├── models/        # SQLAlchemy models
│   │   └── schemas/       # Pydantic schemas
│   ├── alembic/           # Database migrations
│   └── requirements.txt
├── frontend/               # React frontend
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # Reusable UI components
│   │   ├── layouts/       # Page layouts
│   │   ├── pages/         # Route components
│   │   ├── stores/        # Zustand stores
│   │   └── types/         # TypeScript definitions
│   ├── public/
│   └── package.json
├── uploads/                # Original image uploads
├── compressed/             # Processed images
├── docker-compose.yml      # Container orchestration
└── .env.example           # Environment template
```

## 🔧 API Architecture

### Authentication Endpoints
- `POST /api/auth/login` - Admin authentication
- `GET /api/auth/me` - Current user info
- `POST /api/auth/logout` - Logout

### Photo Management
- `GET /api/photos` - List photos with pagination/filtering
- `GET /api/photos/featured` - Featured photos
- `POST /api/photos` - Upload with EXIF extraction (admin)
- `PUT /api/photos/{id}` - Update metadata (admin)
- `DELETE /api/photos/{id}` - Delete photo and files (admin)

### Project Management
- `GET /api/projects` - List projects
- `GET /api/projects/featured` - Featured projects
- `POST /api/projects` - Create project (admin)
- `PUT /api/projects/{id}` - Update project (admin)
- `DELETE /api/projects/{id}` - Delete project (admin)

### Blog System
- `GET /api/blog` - Published posts with pagination
- `GET /api/blog/admin` - All posts including drafts (admin)
- `POST /api/blog` - Create post (admin)
- `PUT /api/blog/{id}` - Update post (admin)
- `DELETE /api/blog/{id}` - Delete post (admin)

### Sub-Applications
- `GET /api/subapps` - Public sub-apps
- `GET /api/subapps/authenticated` - Auth-required sub-apps
- `POST /api/subapps` - Create sub-app (admin)
- `PUT /api/subapps/{id}` - Update sub-app (admin)

## 📸 Image Processing Pipeline

1. **Upload**: Multi-part form upload with metadata
2. **EXIF Extraction**: Camera settings, GPS coordinates, timestamps
3. **Processing**: 
   - Auto-rotation based on EXIF orientation
   - WebP conversion with configurable quality
   - Thumbnail generation (400px)
   - Progressive loading support
4. **Storage**: Original and processed versions saved
5. **Database**: Metadata stored in PostgreSQL

## 🎨 Frontend Features

### Modern UI/UX
- **Responsive Design**: Mobile-first approach
- **Dark Mode Ready**: CSS custom properties
- **Smooth Animations**: Framer Motion integration
- **Loading States**: Skeleton screens and spinners
- **Error Handling**: User-friendly error messages
- **Optimistic Updates**: Immediate UI feedback

### Photo Gallery
- **Masonry Layout**: Pinterest-style grid
- **Lightbox**: Full-screen photo viewing
- **Lazy Loading**: Performance optimization
- **EXIF Display**: Camera settings overlay
- **Search & Filter**: By category, tags, featured status

### Admin Interface
- **Dashboard**: Statistics and quick actions
- **File Upload**: Drag & drop with progress
- **CRUD Operations**: Full content management
- **Real-time Preview**: Markdown editor with preview
- **Bulk Operations**: Multi-select actions

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Role-based Access**: Admin vs regular user permissions
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Pydantic schema validation
- **SQL Injection Prevention**: SQLAlchemy ORM
- **XSS Protection**: Content Security Policy
- **File Upload Security**: Type and size validation

## 🚢 Deployment Options

### Docker Production
```bash
# Use environment variables for production
cp .env.example .env
# Set secure passwords and keys
docker-compose up -d
```

### TrueNAS Scale
1. Create datasets for persistent data
2. Configure environment variables
3. Deploy with docker-compose
4. Set up reverse proxy if needed

### Cloud Deployment
- **AWS**: ECS/Fargate + RDS + ElastiCache
- **GCP**: Cloud Run + Cloud SQL + Memorystore
- **Azure**: Container Instances + Database + Redis Cache
- **DigitalOcean**: App Platform + Managed Database

## ⚡ Performance Optimizations

### Backend
- **Async Operations**: FastAPI async/await
- **Database Indexing**: Optimized queries
- **Redis Caching**: Frequent data caching
- **Image Processing**: Background tasks with Celery
- **Connection Pooling**: Efficient database connections

### Frontend
- **Code Splitting**: Route-based lazy loading
- **Image Optimization**: WebP format with fallbacks
- **Bundle Optimization**: Tree shaking and compression
- **CDN Ready**: Static assets optimized for CDN
- **Service Worker**: Offline support (optional)

## 🔧 Configuration

### Environment Variables (.env)
```env
# Database
POSTGRES_PASSWORD=your_secure_password
SECRET_KEY=your_64_character_secret_key
ADMIN_PASSWORD=your_admin_password

# Optional customization
WEBP_QUALITY=85
THUMBNAIL_SIZE=400
MAX_FILE_SIZE=52428800
```

### Database Migrations
```bash
# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback
docker-compose exec backend alembic downgrade -1
```

## 📊 Monitoring & Maintenance

### Health Checks
All containers include health checks:
- Frontend: HTTP response check
- Backend: FastAPI health endpoint
- Database: PostgreSQL ready check
- Redis: Ping response

### Logging
```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Database logs
docker-compose logs -f db
```

### Backup & Restore
```bash
# Database backup
docker-compose exec db pg_dump -U postgres photography > backup.sql

# Restore
docker-compose exec -T db psql -U postgres photography < backup.sql

# File backup
tar -czf backup.tar.gz uploads/ compressed/
```

## 🛡 Troubleshooting

### Common Issues

**Database connection failed**
- Check PostgreSQL container status
- Verify environment variables
- Ensure migrations are applied

**Image upload fails**
- Check file size limits
- Verify upload directory permissions
- Check backend logs for processing errors

**Frontend build fails**
- Clear node_modules and reinstall
- Check Node.js version compatibility
- Verify environment variables

**Authentication issues**
- Check JWT secret key
- Verify admin password configuration
- Clear browser localStorage

### Development Commands
```bash
# Reset database
docker-compose down -v
docker-compose up -d db
docker-compose run --rm migrate

# Rebuild containers
docker-compose build --no-cache

# Check API documentation
open http://localhost:8000/docs
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow code style guidelines
4. Add tests for new features
5. Submit a pull request

## 🆘 Support

- **Documentation**: Check API docs at `/docs` endpoint
- **Issues**: Open GitHub issues for bugs
- **Discussions**: GitHub discussions for questions
- **Security**: Report vulnerabilities privately

---

Built with modern tools and best practices for photographers and developers who demand excellence in both form and function.
