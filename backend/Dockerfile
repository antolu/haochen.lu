# Use Node.js 18 LTS Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for Sharp (image processing)
RUN apk add --no-cache \
    libc6-compat \
    vips-dev \
    && rm -rf /var/cache/apk/*

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install npm dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Create necessary directories
RUN mkdir -p /app/data \
    /app/assets/images/portfolio \
    /app/assets/images/projects \
    /app/uploads/temp

# Copy server code and entrypoint script
COPY server/ ./server/
COPY docker-entrypoint.sh /usr/local/bin/

# Make entrypoint script executable
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S photography -u 1001 -G nodejs

# Set proper permissions
RUN chown -R photography:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER photography

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Expose port 3000 (internal only)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "server/app.js"]