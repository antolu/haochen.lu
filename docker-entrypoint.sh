#!/bin/sh
# Docker entrypoint script for photography portfolio backend

set -e

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Check if required directories exist
log "Checking directory structure..."
mkdir -p /app/data
mkdir -p /app/assets/images/portfolio
mkdir -p /app/assets/images/projects
mkdir -p /app/uploads/temp

# Check if data files exist, create empty ones if not
if [ ! -f /app/data/photography.json ]; then
    log "Creating empty photography.json..."
    echo '{"photos":[]}' > /app/data/photography.json
fi

if [ ! -f /app/data/projects.json ]; then
    log "Creating empty projects.json..."
    echo '{"projects":[]}' > /app/data/projects.json
fi

# Set proper permissions
chown -R photography:nodejs /app/data
chown -R photography:nodejs /app/assets/images
chown -R photography:nodejs /app/uploads
chmod -R 755 /app/data
chmod -R 755 /app/assets/images
chmod -R 755 /app/uploads

# Health check function
health_check() {
    log "Running health check..."
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        log "Health check passed"
        return 0
    else
        log "Health check failed"
        return 1
    fi
}

# Wait for dependencies if needed
if [ "$WAIT_FOR_DEPS" = "true" ]; then
    log "Waiting for dependencies..."
    sleep 5
fi

# Start the application
log "Starting photography portfolio backend..."
log "Environment: ${NODE_ENV:-production}"
log "Port: ${PORT:-3000}"

# Execute the main command
exec "$@"