# Docker Deployment Guide

This guide covers deploying the photography portfolio using Docker Compose, specifically configured for TrueNAS but compatible with any Docker environment.

## 🐳 Docker Architecture

### Container Structure
- **nginx**: Serves static files and proxies API requests
- **backend**: Node.js application for photo uploads and content management
- **Shared volumes**: Data persistence and file storage

### Port Configuration
- **Host 9080** → nginx HTTP (80)
- **Host 9443** → nginx HTTPS (443)
- **Internal**: nginx → backend:3000 (API proxy)

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- TrueNAS with Docker support (or any Docker environment)

### Deployment Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd haochen.lu
   ```

2. **Create environment file**
   ```bash
   cp .env.docker .env
   # Edit .env with your specific configuration
   ```

3. **Create necessary directories**
   ```bash
   mkdir -p nginx/conf.d
   mkdir -p data
   mkdir -p assets/images/portfolio
   mkdir -p assets/images/projects
   ```

4. **Deploy with Docker Compose**
   ```bash
   docker-compose up -d
   ```

5. **Access the application**
   - Frontend: `http://localhost:9080`
   - Admin: `http://localhost:9080/admin/content-manager.html`
   - HTTPS: `https://localhost:9443` (with SSL certificates)

## 📁 Volume Configuration

### TrueNAS Volume Mounts
Configure these paths in TrueNAS Docker interface:

```yaml
# Static content (read-only)
./index.html:/usr/share/nginx/html/index.html:ro
./assets:/usr/share/nginx/html/assets:ro
./admin:/usr/share/nginx/html/admin:ro

# Configuration
./nginx/conf.d:/etc/nginx/conf.d

# Data persistence (read-write)
./data:/app/data
./assets/images:/app/assets/images
```

### Directory Structure
```
/host/path/to/portfolio/
├── nginx/
│   └── conf.d/
│       └── default.conf       # nginx configuration
├── data/                      # Persistent data
│   ├── photography.json       # Auto-managed by backend
│   └── projects.json          # Auto-managed by backend
├── assets/
│   └── images/               # Uploaded images
│       ├── portfolio/        # Photo uploads
│       └── projects/         # Project images
├── admin/                    # Admin interface files
├── index.html               # Main frontend
└── docker-compose.yml       # Container orchestration
```

## ⚙️ Configuration

### Environment Variables
Key settings in `.env`:

```bash
# Application
NODE_ENV=production
PORT=3000

# Upload Settings
MAX_FILE_SIZE=52428800  # 50MB
UPLOAD_PATH=/app/uploads/temp

# Security
SESSION_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:9080,https://localhost:9443

# Paths
DATA_PATH=/app/data
IMAGES_PATH=/app/assets/images
```

### nginx Configuration
The `nginx/conf.d/default.conf` includes:
- API proxy to backend container
- Static file serving
- Upload handling (50MB limit)
- Rate limiting
- Security headers
- SSL/HTTPS support

## 🔧 Development

### Development Mode
```bash
# Start with development overrides
docker-compose -f docker-compose.yml -f docker-compose.override.yml up

# Build and start fresh
docker-compose up --build

# View logs
docker-compose logs -f backend
docker-compose logs -f nginx
```

### Live Code Changes
For development, uncomment the volume mount in `docker-compose.override.yml`:
```yaml
volumes:
  - ./server:/app/server:ro  # Live code updates
```

## 📋 Health Checks

### Container Health
Both containers include health checks:
- **nginx**: `curl -f http://localhost/health`
- **backend**: `curl -f http://localhost:3000/api/health`

### Monitoring
```bash
# Check container status
docker-compose ps

# View health status
docker inspect <container_name> | grep Health -A 10

# Check logs
docker-compose logs backend
```

## 🔒 Security Configuration

### SSL/HTTPS Setup
1. **Obtain SSL certificates**
2. **Mount certificates in docker-compose.yml**:
   ```yaml
   nginx:
     volumes:
       - /path/to/ssl/certs:/etc/ssl/certs:ro
       - /path/to/ssl/private:/etc/ssl/private:ro
   ```
3. **Update nginx config** for your domain

### Basic Auth for Admin (Optional)
```bash
# Create password file
htpasswd -c nginx/.htpasswd admin

# Mount in nginx container
- ./nginx/.htpasswd:/etc/nginx/.htpasswd:ro
```

Uncomment auth_basic lines in nginx config.

## 🚨 Troubleshooting

### Common Issues

**Backend container fails to start:**
```bash
# Check logs
docker-compose logs backend

# Verify volumes are mounted
docker-compose exec backend ls -la /app/data
```

**Upload failures:**
```bash
# Check nginx upload settings
docker-compose exec nginx nginx -T | grep client_max_body_size

# Verify backend permissions
docker-compose exec backend ls -la /app/assets/images
```

**API proxy not working:**
```bash
# Test internal connectivity
docker-compose exec nginx curl http://photography-backend:3000/api/health

# Check nginx configuration
docker-compose exec nginx nginx -t
```

### Debugging Commands
```bash
# Enter backend container
docker-compose exec backend sh

# Enter nginx container  
docker-compose exec nginx sh

# View real-time logs
docker-compose logs -f

# Restart single service
docker-compose restart backend
```

## 📊 Performance Optimization

### Image Optimization
- Backend uses Sharp for automatic image processing
- nginx serves optimized static files with caching
- Gzip compression enabled for all text content

### Caching Strategy
- Static assets: 1 year cache
- JSON data: 1 hour cache
- HTML files: 1 hour cache
- Admin interface: No cache

### Resource Limits (Optional)
Add to docker-compose.yml:
```yaml
backend:
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '0.5'
```

## 🔄 Updates and Backups

### Updating the Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up --build -d

# Or update specific service
docker-compose up --build -d backend
```

### Backup Strategy
**Important directories to backup:**
- `./data/` - JSON data files
- `./assets/images/` - Uploaded photos
- `./nginx/conf.d/` - nginx configuration

```bash
# Example backup script
tar -czf portfolio-backup-$(date +%Y%m%d).tar.gz data/ assets/images/ nginx/
```

## 🎯 TrueNAS Specific Notes

### Container Creation
1. **Use Custom App** in TrueNAS
2. **Upload docker-compose.yml** content
3. **Configure volumes** through the UI:
   - Map host paths to container paths
   - Ensure read/write permissions as needed
4. **Set port mappings**: 9080:80 and 9443:443
5. **Deploy** and monitor through TrueNAS interface

### Volume Permissions
TrueNAS may require specific UID/GID mapping:
```yaml
backend:
  user: "1001:1001"  # Match TrueNAS user
```

### Network Configuration
TrueNAS handles Docker networking automatically. The internal `photography-network` will be created and managed.

---

This setup provides a production-ready deployment with automatic EXIF extraction, photo uploads, and content management through a clean container architecture.