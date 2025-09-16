# Environment Variables Setup Guide

## Overview

The portfolio application now uses environment variables for all sensitive configuration data, following security best practices.

## Quick Setup

### 1. Development (Local)
Create a `.env` file with required variables:
```bash
# Required environment variables
SECRET_KEY=dev-secret-key-change-in-production-32chars
SESSION_SECRET_KEY=dev-session-secret-key-change-in-production
ADMIN_PASSWORD=admin

docker-compose up -d
```

### 2. Production Deployment
Create a `.env` file with secure values:
```bash
# Required for production
ENVIRONMENT=production
SECRET_KEY=your-64-character-secret-key-here
SESSION_SECRET_KEY=your-session-secret-key-here  
ADMIN_PASSWORD=YourSecureAdminPassword123!
COOKIE_SECURE=true

# Database (adjust for your setup)
POSTGRES_PASSWORD=your_secure_db_password
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/portfolio

# Optional customization
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
COOKIE_DOMAIN=yourdomain.com
```

## Environment Variables Reference

### Required in Production

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key (min 32 chars) | `supersecurekey...` |
| `SESSION_SECRET_KEY` | Session encryption key (min 32 chars) | `anothersecurekey...` |
| `ADMIN_PASSWORD` | Admin user password (min 8 chars) | `SecurePass123!` |

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql+asyncpg://postgres:password@localhost:5432/portfolio` |
| `POSTGRES_DB` | Database name (Docker Compose) | `portfolio` |
| `POSTGRES_PASSWORD` | Database password (Docker Compose) | `password` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |

### Security Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment mode | `development` |
| `COOKIE_SECURE` | Use secure cookies (HTTPS only) | `false` |
| `COOKIE_DOMAIN` | Cookie domain restriction | None |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000,http://localhost:5173` |

### File Upload Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `UPLOAD_DIR` | Original images directory | `uploads` |
| `COMPRESSED_DIR` | Processed images directory | `compressed` |
| `MAX_FILE_SIZE` | Maximum upload size (bytes) | `52428800` (50MB) |
| `WEBP_QUALITY` | WebP compression quality (1-100) | `85` |
| `THUMBNAIL_SIZE` | Thumbnail size in pixels | `400` |

## Security Features

### Production Validation
The application automatically validates settings in production:

```python
# These will cause startup errors in production:
- Missing or empty SECRET_KEY
- SECRET_KEY shorter than 32 characters  
- Missing ADMIN_PASSWORD
- ADMIN_PASSWORD shorter than 8 characters
- COOKIE_SECURE=false in production
```

### Required Environment Variables
All environments now require these variables to be set:
```bash
SECRET_KEY=your-secret-key-here
SESSION_SECRET_KEY=your-session-secret-key-here  
ADMIN_PASSWORD=your-admin-password
```

## Generating Secure Keys

### Method 1: Python
```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('SESSION_SECRET_KEY=' + secrets.token_urlsafe(32))"
```

### Method 2: OpenSSL
```bash
openssl rand -base64 32
```

### Method 3: Online Generator
Visit: https://generate-random.org/api-token-generator?count=1&length=64&type=mixed-numbers-symbols

## Docker Compose Integration

The docker-compose.yml file automatically picks up environment variables:

```yaml
environment:
  - SECRET_KEY=${SECRET_KEY:-}  # No default for security
  - ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
  - ENVIRONMENT=${ENVIRONMENT:-development}
```

## Environment-Specific Configurations

### Development
```bash
# .env (optional for development)
ENVIRONMENT=development
ADMIN_PASSWORD=admin
WEBP_QUALITY=75  # Faster processing
```

### Staging
```bash
# .env
ENVIRONMENT=production
SECRET_KEY=staging-secret-key-32-characters-min
SESSION_SECRET_KEY=staging-session-key-32-characters
ADMIN_PASSWORD=StagingPassword123!
COOKIE_SECURE=true
CORS_ORIGINS=https://staging.yourdomain.com
```

### Production
```bash
# .env
ENVIRONMENT=production
SECRET_KEY=production-secret-key-64-characters-recommended
SESSION_SECRET_KEY=production-session-key-64-characters-recommended
ADMIN_PASSWORD=VerySecureProductionPassword123!
COOKIE_SECURE=true
COOKIE_DOMAIN=yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
DATABASE_URL=postgresql+asyncpg://user:pass@prod-db:5432/portfolio
REDIS_URL=redis://prod-redis:6379/0
```

## Migration Guide

### From Previous Version
If upgrading from the old hardcoded configuration:

1. **Identify current values** from your deployment
2. **Create .env file** with your current settings
3. **Test in development** first
4. **Deploy with environment variables**

### Docker Compose Migration
```bash
# Old way (hardcoded in docker-compose.yml)
SECRET_KEY=hardcoded-key

# New way (.env file)
echo "SECRET_KEY=your-secure-key" >> .env
docker-compose up -d
```

## Troubleshooting

### Startup Errors

**Error: "SECRET_KEY environment variable is required in production"**
```bash
# Solution: Set environment variable
export SECRET_KEY="your-secure-key-here"
# or add to .env file
echo "SECRET_KEY=your-secure-key-here" >> .env
```

**Error: "SECRET_KEY must be at least 32 characters long"**
```bash
# Solution: Generate longer key
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Development Issues

**Error: Application won't start in development**
```bash
# Check if ENVIRONMENT is accidentally set to production
echo $ENVIRONMENT

# Unset or change to development
export ENVIRONMENT=development
```

### Docker Issues

**Error: Container environment variables not working**
```bash
# Ensure .env file is in same directory as docker-compose.yml
ls -la .env

# Restart containers to pick up new variables
docker-compose down
docker-compose up -d
```

## Best Practices

1. **Never commit .env files** to version control
2. **Use different keys** for each environment
3. **Rotate keys regularly** in production
4. **Use strong passwords** (min 12 characters, mixed case, numbers, symbols)
5. **Enable COOKIE_SECURE** for HTTPS deployments
6. **Restrict CORS_ORIGINS** to your actual domains
7. **Monitor for environment variable leaks** in logs
8. **Use secret management systems** for large deployments (AWS Secrets Manager, HashiCorp Vault, etc.)

## Security Checklist

- [ ] All production secrets set via environment variables
- [ ] No hardcoded passwords in code or config files
- [ ] SECRET_KEY is at least 32 characters and random
- [ ] ADMIN_PASSWORD is strong and unique
- [ ] COOKIE_SECURE=true for HTTPS deployments
- [ ] CORS_ORIGINS restricted to actual domains
- [ ] .env files not committed to version control
- [ ] Environment variables not logged or exposed
