# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern, responsive photography portfolio website for Anton Lu with a **complete backend system**. The site features photo uploads with automatic EXIF extraction, dynamic content management, and a RESTful API. Built with Node.js/Express backend and vanilla JavaScript frontend.

## Development Commands

### Docker Deployment (Recommended)
```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f backend

# Development mode with live reload
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
```

Visit `http://localhost:9080` for frontend and `http://localhost:9080/admin/content-manager.html` for admin.

### Local Development (Without Docker)
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start
```

### Frontend Only (Static)
```bash
# Python 3 (for static files only)
python3 -m http.server 8000

# Node.js (if backend not needed)
npx serve .
```

### Deployment Options
- **Docker (Recommended)**: Full functionality with proper containerization
- **Local Backend**: Development and testing with `npm run dev`
- **Static Only**: Basic portfolio viewing with sample data

## Architecture & Structure

### Backend Files
- `server/app.js` - Main Express server with middleware and routing
- `server/routes/upload.js` - Photo upload with EXIF extraction (165 lines)
- `server/routes/photos.js` - Photo CRUD API endpoints (150 lines)
- `server/routes/projects.js` - Project CRUD API endpoints (200 lines)
- `package.json` - Node.js dependencies and scripts

### Frontend Files
- `index.html` - Main HTML page with complete site structure
- `assets/js/main.js` - Frontend JavaScript with API integration (613 lines)
- `assets/css/custom.css` - Custom styles and responsive design
- `admin/content-manager.html` - Photo upload and content management interface

### Data Management
- **Dynamic Data**: API endpoints serve content from JSON files
- **File Storage**: Images stored in `assets/images/portfolio/` and `assets/images/projects/`
- **Auto-managed JSON**: Backend automatically updates `data/photography.json` and `data/projects.json`

### Backend Architecture
Node.js/Express server with key features:
- **File Upload**: Multer middleware with 50MB limit
- **EXIF Extraction**: ExifR library for camera metadata and GPS coordinates
- **Image Processing**: Sharp for optimization, auto-rotation, compression
- **Security**: Helmet, CORS, rate limiting, input validation
- **Error Handling**: Comprehensive error responses

### API Architecture
RESTful API with full CRUD operations:
- **GET /api/photos** - List photos with filtering/pagination
- **POST /api/upload/photo** - Upload with automatic EXIF extraction
- **PUT /api/photos/:id** - Update photo metadata
- **DELETE /api/photos/:id** - Delete photo and file
- **GET /api/projects** - List projects
- **POST /api/projects** - Create project
- **Statistics endpoints** for dashboard

### Frontend Integration
- **Dual Loading**: Try API first, fallback to static JSON
- **Upload Interface**: Drag & drop with progress tracking
- **Real-time Updates**: Content refreshes after API operations
- **Error Handling**: User-friendly error messages

### Content Management
- **Web Upload Interface**: `admin/content-manager.html` with drag & drop
- **Automatic Processing**: EXIF extraction, GPS conversion, image optimization
- **Live Preview**: Image preview before upload
- **Statistics Dashboard**: Photo/project counts, storage usage, camera stats

### Styling Approach
- **Tailwind CSS**: Via CDN for utility-first styling
- **Custom CSS**: Upload interface styling, animations, responsive design
- **Mobile Upload**: Touch-friendly drag & drop interface

### Dependencies
**Backend:**
- express, multer, exifr, sharp, cors, helmet, uuid

**Frontend:**
- Tailwind CSS, PhotoSwipe, ExifReader (CDN)
- Google Fonts (Inter & Playfair Display)

## Adding Content

### Photography Upload Process
**Via Web Interface (Recommended):**
1. Visit `/admin/content-manager.html`
2. Drag & drop image files or click to select
3. Add title, category, comments, tags
4. Upload triggers automatic EXIF extraction and image processing

**API Upload:**
```bash
curl -X POST -F "photo=@image.jpg" -F "title=My Photo" http://localhost:3000/api/upload/photo
```

**Manual JSON (Not recommended with backend):**
Edit `/data/photography.json` - but backend will overwrite on next API operation

### Projects Management
**Via Web Interface:**
1. Use admin interface project form
2. Fill title, description, technologies, GitHub/demo URLs
3. Auto-saves to `/data/projects.json`

**API Creation:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"My Project","description":"...","technologies":["React","Node.js"]}' \
  http://localhost:3000/api/projects
```

## Deployment

### Docker Deployment (Recommended)
```bash
# TrueNAS or any Docker environment
docker-compose up -d

# Access on ports 9080 (HTTP) and 9443 (HTTPS)
```

### Local Development
```bash
npm run dev  # Starts server on port 3000 with auto-reload
```

### Production (Non-Docker)
```bash
npm start  # Production server
# Or with PM2: pm2 start server/app.js --name portfolio
```

### Container Architecture
- **nginx container**: Serves static files, proxies API to backend
- **backend container**: Node.js app with photo upload and EXIF processing
- **Shared volumes**: Data persistence and image storage
- **Internal networking**: nginx → backend:3000

### Deployment Options
- **Docker Compose** (Recommended): See `DOCKER.md` for complete guide
- **TrueNAS**: Uses docker-compose with volume mounts for `/etc/nginx/conf.d` and data
- **Traditional VPS**: Nginx + Node.js + PM2
- **Cloud Platforms**: Containerized deployment on any Docker-supporting platform

## Key Development Notes

### Backend Development
- **API First**: All content operations go through API
- **File Processing**: Automatic EXIF extraction and image optimization
- **Error Handling**: Comprehensive API error responses
- **Security**: Rate limiting, file validation, CORS protection

### Frontend Integration
- **Graceful Fallback**: Works with or without backend
- **Real-time Updates**: Admin interface refreshes content immediately
- **Mobile Support**: Full upload functionality on mobile devices

### File Management
- **Automatic Storage**: Uploaded images saved to `assets/images/portfolio/`
- **JSON Updates**: Backend automatically manages data files
- **Image Optimization**: Sharp handles compression and optimization

### Testing
- **Frontend Only**: Use `python3 -m http.server 8000` for static testing
- **Full Stack**: Use `npm run dev` for complete functionality
- **API Testing**: Use curl or Postman for API endpoints

### Performance
- **Image Processing**: Server-side optimization with Sharp
- **Caching**: Nginx handles static file caching
- **API Efficiency**: Pagination and filtering support