# TrueNAS Scale Deployment Guide

This guide provides step-by-step instructions for deploying the Portfolio application on TrueNAS Scale using individual container services.

## 📋 Prerequisites

- TrueNAS Scale server with Docker/Kubernetes support
- Access to TrueNAS Scale web interface
- Docker images built and available (either locally or from a registry)
- Basic understanding of TrueNAS Scale application deployment

## 🏗️ Architecture Overview

The application consists of 4 separate services:
1. **PostgreSQL Database** (port 5432) - *Generic database server for multiple applications*
2. **Redis Cache/Session Store** (port 6379) - *Generic cache/session store for multiple applications*
3. **Backend API Service** (port 8000) - *Portfolio app backend*
4. **Frontend Web Service** (port 80/443) - *Portfolio app frontend*

## 📂 Storage Requirements

Create the following dataset structure in TrueNAS:
```
/mnt/pool/
├── databases/
│   ├── postgres-data/    # Generic PostgreSQL data (shared)
│   └── redis-data/       # Generic Redis data (shared)
└── apps/
    └── portfolio/
        ├── uploads/      # User uploaded images
        ├── compressed/   # Processed images
        └── data/         # Application data
```

## 🐘 Step 1: Deploy Generic PostgreSQL Database Service

### Service Configuration
- **Application Name**: `postgres-server`
- **Image**: `postgres:15-alpine`
- **Restart Policy**: `Always`

### Environment Variables
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_db_password_here
# No POSTGRES_DB - will create databases as needed by applications
```

### Port Configuration
- **Container Port**: `5432`
- **Host Port**: `5432`
- **Protocol**: `TCP`

### Volume Mounts
```
Host Path: /mnt/pool/databases/postgres-data
Mount Path: /var/lib/postgresql/data
```

### Health Check
- **Command**: `pg_isready -U postgres`
- **Initial Delay**: `30s`
- **Period**: `30s`
- **Timeout**: `10s`
- **Failure Threshold**: `5`

### Important Notes
- 🔐 **Change the default password** - Replace `your_secure_db_password_here` with a strong password
- 📝 **Save the password** - You'll need it for all applications connecting to this database
- 🔄 This will create a generic PostgreSQL server that can host multiple databases
- 📊 **Database Creation**: Individual applications will create their own databases as needed
- 🔗 **Multi-App Support**: This server can serve multiple applications simultaneously

## 🚀 Step 2: Deploy Generic Redis Service

### Service Configuration
- **Application Name**: `redis-server`
- **Image**: `redis:7-alpine`
- **Restart Policy**: `Always`

### Port Configuration
- **Container Port**: `6379`
- **Host Port**: `6379`
- **Protocol**: `TCP`

### Volume Mounts
```
Host Path: /mnt/pool/databases/redis-data
Mount Path: /data
```

### Health Check
- **Command**: `redis-cli ping`
- **Initial Delay**: `30s`
- **Period**: `30s`
- **Timeout**: `10s`
- **Failure Threshold**: `3`

### Redis Configuration (Optional)
For production with multiple applications, consider creating a Redis configuration file:
```
# redis.conf
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
# Enable multiple databases (default is 16)
databases 16
# Optional: Set maxmemory and eviction policy
# maxmemory 2gb
# maxmemory-policy allkeys-lru
```

Mount this at `/usr/local/etc/redis/redis.conf` and add `redis-server /usr/local/etc/redis/redis.conf` as the command.

### Important Notes
- 🔗 **Multi-App Support**: This Redis server can serve multiple applications using different database numbers (0-15)
- 📊 **Database Separation**: Each application can use a different database number (e.g., photography app uses DB 0, another app uses DB 1)
- 🚀 **Shared Cache**: Multiple applications can share the same Redis instance for caching and sessions

## 🔧 Step 3: Deploy Backend API Service

### Build Requirements
First, ensure your backend Docker image is built with the correct Dockerfile from the project.

### Service Configuration
- **Application Name**: `portfolio-backend`
- **Image**: `your-registry/portfolio-backend:latest` (or local image)
- **Restart Policy**: `Always`

### Environment Variables
```
# Required Security Variables (Application will not start without these)
SECRET_KEY=your_very_secure_secret_key_minimum_32_chars
SESSION_SECRET_KEY=your_session_secret_key_minimum_32_chars
ADMIN_PASSWORD=your_admin_panel_password

# Database and Services
DATABASE_URL=postgresql+asyncpg://postgres:your_secure_db_password_here@<TRUENAS_IP>:5432/portfolio
REDIS_URL=redis://<TRUENAS_IP>:6379/0

# Application Configuration
ENVIRONMENT=production
CORS_ORIGINS=http://<TRUENAS_IP>,https://<TRUENAS_IP>,http://<TRUENAS_IP>:80,https://<TRUENAS_IP>:443
COOKIE_SECURE=false
COOKIE_HTTPONLY=true
COOKIE_SAMESITE=lax
```

### 🔐 **Critical Security Note**
The application **will not start** if `SECRET_KEY`, `SESSION_SECRET_KEY`, or `ADMIN_PASSWORD` are missing or don't meet minimum requirements. Generate secure keys using:
```bash
# Generate SECRET_KEY and SESSION_SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('SESSION_SECRET_KEY=' + secrets.token_urlsafe(32))"
```

### Port Configuration
- **Container Port**: `8000`
- **Host Port**: `8000`
- **Protocol**: `TCP`

### Volume Mounts
```
Host Path: /mnt/pool/apps/portfolio/uploads
Mount Path: /app/uploads

Host Path: /mnt/pool/apps/portfolio/compressed
Mount Path: /app/compressed

Host Path: /mnt/pool/apps/portfolio/data
Mount Path: /app/data
```

### Health Check
- **Command**: `curl -f http://localhost:8000/health || exit 1`
- **Initial Delay**: `60s`
- **Period**: `30s`
- **Timeout**: `10s`
- **Failure Threshold**: `3`

### Dependencies
- Ensure `postgres-server` service is running first
- Ensure `redis-server` service is running first

## 🌐 Step 4: Deploy Frontend Web Service

### Build Requirements
Ensure your frontend Docker image is built with the Nginx configuration from the project.

### Service Configuration
- **Application Name**: `portfolio-frontend`
- **Image**: `your-registry/portfolio-frontend:latest` (or local image)
- **Restart Policy**: `Always`

### Port Configuration
- **Container Port**: `80`
- **Host Port**: `80`
- **Protocol**: `TCP`

### Additional Ports (if HTTPS configured)
- **Container Port**: `443`
- **Host Port**: `443`
- **Protocol**: `TCP`

### Health Check
- **Command**: `curl -f http://localhost/ || exit 1`
- **Initial Delay**: `30s`
- **Period**: `30s`
- **Timeout**: `10s`
- **Failure Threshold**: `3`

### Dependencies
- Backend API service should be running first

## 🗄️ Step 5: Database Initialization

### Portfolio Database Creation
The portfolio application will automatically create its own database (`portfolio`) within the generic PostgreSQL server on first startup.

### Automatic Admin User Creation
The portfolio application automatically creates an admin user on first login attempt:
- **Username**: `admin`
- **Password**: The value set in `ADMIN_PASSWORD` environment variable

### Database Schema Migration
The backend service automatically runs database migrations on startup using Alembic.

### Manual Database Access (if needed)
To access the PostgreSQL server and portfolio database:
```bash
# From TrueNAS shell or another container with psql
psql -h <TRUENAS_IP> -p 5432 -U postgres

# List all databases
\l

# Connect to portfolio database
\c portfolio

# List tables
\dt
```

### Multiple Applications
For additional applications using the same PostgreSQL server:
1. Each app creates its own database (e.g., `app1`, `app2`, etc.)
2. Each app manages its own schema and migrations
3. All apps share the same PostgreSQL credentials

## 🔒 Step 6: Security Configuration

### Database Security
1. **Strong Passwords**: Use complex passwords for all database users
2. **Network Security**: Consider limiting database access to specific IP ranges
3. **Backup Strategy**: Configure regular database backups

### Application Security
1. **Secret Keys**: Generate strong, unique secret keys (minimum 32 characters)
2. **CORS Origins**: Restrict CORS origins to your actual domain/IP
3. **HTTPS**: Configure SSL certificates for production use
4. **Cookie Security**: Set `COOKIE_SECURE=true` when using HTTPS

### Redis Security
1. **Network Access**: Limit Redis access to application containers only
2. **Authentication**: Consider enabling Redis AUTH for additional security

## 🚀 Step 7: Deployment Order

Deploy services in this order to ensure proper dependencies:

1. **Generic PostgreSQL Server** (`postgres-server`) → Wait for healthy status
2. **Generic Redis Server** (`redis-server`) → Wait for healthy status  
3. **Portfolio Backend API** (`portfolio-backend`) → Wait for healthy status
4. **Portfolio Frontend Web** (`portfolio-frontend`) → Wait for healthy status

## 🔍 Step 8: Verification

### Service Health Checks
1. **PostgreSQL**: `psql -h <TRUENAS_IP> -p 5432 -U postgres -c "SELECT 1;"`
2. **Redis**: `redis-cli -h <TRUENAS_IP> -p 6379 ping`
3. **Backend**: `curl http://<TRUENAS_IP>:8000/health`
4. **Frontend**: `curl http://<TRUENAS_IP>/`

### Application Access
1. Open `http://<TRUENAS_IP>` in browser
2. Navigate to login page
3. Login with:
   - Username: `admin`  
   - Password: `<ADMIN_PASSWORD_VALUE>`

## 🛠️ Troubleshooting

### Common Issues

#### Backend Cannot Connect to Database
- Verify PostgreSQL service is running and healthy
- Check `DATABASE_URL` environment variable format
- Ensure TrueNAS IP is correct in connection string
- Verify port 5432 is accessible

#### Backend Cannot Connect to Redis
- Verify Redis service is running and healthy
- Check `REDIS_URL` environment variable format
- Ensure TrueNAS IP is correct in connection string
- Verify port 6379 is accessible

#### Frontend Cannot Reach Backend
- Verify backend service is running on port 8000
- Check CORS configuration in backend environment
- Ensure frontend can access `http://<TRUENAS_IP>:8000`

#### Database Migration Errors
- Check backend service logs for Alembic errors
- Ensure database is accessible and has proper permissions
- Verify `DATABASE_URL` is correctly formatted

### Log Access
Access logs through TrueNAS Scale web interface:
- Go to `Apps` → `<service-name>` → `Logs`
- Or use shell access: `docker logs <container-name>`

## 🔄 Maintenance

### Backups
1. **Database**: Regular PostgreSQL dumps (all databases or specific ones)
2. **Uploads**: Backup `/mnt/pool/apps/portfolio/uploads/` directory
3. **Configuration**: Save environment variables and deployment configs
4. **Shared Data**: Backup `/mnt/pool/databases/` for all database data

### Updates
1. Build new Docker images with updates
2. Update service configurations with new image tags
3. Deploy in same order as initial deployment
4. Monitor logs for any migration or startup issues

## 📱 Environment Variables Reference

### Backend Service Environment Variables
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ |
| `REDIS_URL` | Redis connection string | - | ✅ |
| `SECRET_KEY` | JWT signing key (min 32 chars) | - | ✅ |
| `SESSION_SECRET_KEY` | Session encryption key (min 32 chars) | - | ✅ |
| `ADMIN_PASSWORD` | Admin password (min 8 chars) | - | ✅ |
| `CORS_ORIGINS` | Allowed CORS origins | - | ✅ |
| `ENVIRONMENT` | Environment (development/production) | `development` | ❌ |
| `COOKIE_SECURE` | Use secure cookies (HTTPS only) | `false` | ❌ |
| `COOKIE_HTTPONLY` | HTTP-only cookies | `true` | ❌ |
| `COOKIE_SAMESITE` | SameSite cookie policy | `lax` | ❌ |

### ⚠️ **Security Requirements**

**All deployments now require these environment variables:**
- `SECRET_KEY` - Minimum 32 characters, used for JWT token signing
- `SESSION_SECRET_KEY` - Minimum 32 characters, used for session encryption  
- `ADMIN_PASSWORD` - Minimum 8 characters, admin user password

**Security Features:**
- ✅ **No backwards compatibility** - Application will not start without proper environment variables
- ✅ **Automatic validation** - Key lengths and password strength enforced at startup
- ✅ **Production mode** - Enforces HTTPS cookies when `ENVIRONMENT=production`
- ✅ **Environment detection** - Different validation rules for development vs production

### Database Environment Variables
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_DB` | Database name | - | ✅ |
| `POSTGRES_USER` | Database user | - | ✅ |
| `POSTGRES_PASSWORD` | Database password | - | ✅ |

## 🎯 Production Recommendations

1. **Use HTTPS**: Configure SSL certificates and set `COOKIE_SECURE=true`
2. **Resource Limits**: Set appropriate CPU and memory limits for each service
3. **Monitoring**: Set up monitoring and alerting for service health
4. **Backups**: Implement automated backup strategies
5. **Network Security**: Use firewalls to limit access to database ports
6. **Log Management**: Configure log rotation and centralized logging
7. **Secrets Management**: Consider using TrueNAS secrets management for sensitive data

## 🔄 Adding Additional Applications

This setup is designed to support multiple applications sharing the same database and Redis servers.

### For New Applications:

#### Database Setup
1. **Use same PostgreSQL server**: Point new apps to `<TRUENAS_IP>:5432`
2. **Different database name**: Each app creates its own database (e.g., `blog`, `ecommerce`, etc.)
3. **Same credentials**: Use the same `postgres` user and password
4. **Example connection string**: `postgresql+asyncpg://postgres:password@<TRUENAS_IP>:5432/mynewapp`

#### Redis Setup
1. **Use same Redis server**: Point new apps to `<TRUENAS_IP>:6379`
2. **Different database numbers**: Use different Redis DB numbers for separation
   - Portfolio app: `redis://<TRUENAS_IP>:6379/0`
   - New app 1: `redis://<TRUENAS_IP>:6379/1`
   - New app 2: `redis://<TRUENAS_IP>:6379/2`
   - etc. (up to DB 15 by default)

#### Storage Structure
```
/mnt/pool/
├── databases/           # Shared by all apps
│   ├── postgres-data/
│   └── redis-data/
└── apps/               # App-specific data
    ├── portfolio/
    │   ├── uploads/
    │   ├── compressed/
    │   └── data/
    ├── mynewapp/
    │   ├── uploads/
    │   ├── static/
    │   └── data/
    └── anotherapp/
        └── data/
```

### Benefits of Shared Setup
- **Resource Efficiency**: Single database/cache servers for multiple apps
- **Simplified Management**: One set of database credentials and backup procedures
- **Cost Effective**: Reduced memory and storage overhead
- **Centralized Monitoring**: Single point for database and cache monitoring

---

🎉 **Congratulations!** Your Portfolio application should now be running on TrueNAS Scale with all services properly configured and connected. The database and Redis servers are ready to support additional applications as your infrastructure grows!
