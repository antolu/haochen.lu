# Multi-stage Dockerfile for both development and production builds
# syntax=docker/dockerfile:1.4
# hadolint ignore=DL3008
ARG BUILD_TYPE=production

# Base stage with common dependencies
FROM python:3.11-slim AS base

# Set working directory
WORKDIR /app

# Install base system dependencies including libvips and AVIF support
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    curl \
    libvips-dev \
    libheif-dev \
    libde265-dev \
    libx265-dev \
    libaom-dev \
    libdav1d-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Development stage
FROM base AS development
# Install additional dev packages
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dev tools first (stable cache)
RUN pip install --no-cache-dir watchfiles==0.24.0

# Production stage
FROM base AS production
# Install additional production packages including git for setuptools-scm
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    libwebp-dev \
    libjpeg62-turbo-dev \
    && rm -rf /var/lib/apt/lists/*

# Final stage selection based on build type
FROM ${BUILD_TYPE} AS final
ARG BUILD_TYPE

# Copy pyproject first to leverage Docker layer cache for dependencies
# hadolint ignore=DL3045
COPY backend/pyproject.toml ./

# Install dependencies only (not the package itself) to avoid setuptools-scm issues
# hadolint ignore=DL3013,SC2046
RUN if [ "$BUILD_TYPE" = "development" ]; then \
        pip install --no-cache-dir $(python -c "import tomllib; data = tomllib.load(open('pyproject.toml', 'rb')); print(' '.join(data['project']['dependencies'] + data.get('project', {}).get('optional-dependencies', {}).get('test', [])))"); \
    else \
        pip install --no-cache-dir $(python -c "import tomllib; print(' '.join(tomllib.load(open('pyproject.toml', 'rb'))['project']['dependencies']))"); \
    fi

# Copy application code after dependencies are cached
# hadolint ignore=DL3045
COPY backend/ .

# Install the package itself with git context for proper setuptools-scm versioning
RUN --mount=type=bind,source=.git,target=/app/.git \
    pip install --no-cache-dir --no-deps .

# Create directories for uploads and compressed images
RUN mkdir -p uploads compressed

# Expose port
EXPOSE 8000

# Set up entrypoint for production (always copy the entrypoint script)
RUN cp docker-entrypoint.sh /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Set command based on build type
ARG BUILD_TYPE=production
RUN if [ "$BUILD_TYPE" = "development" ]; then \
        printf '#!/bin/bash\nexec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload\n' > /start.sh && \
        chmod +x /start.sh; \
    else \
        printf '#!/bin/bash\nexec /docker-entrypoint.sh\n' > /start.sh && \
        chmod +x /start.sh; \
    fi

# Use the dynamically created start script
ENTRYPOINT ["/start.sh"]
