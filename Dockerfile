# syntax=docker/dockerfile:1.4
# hadolint ignore=DL3008

# Stage 1: build React frontend
FROM node:25-bookworm AS frontend-build

WORKDIR /app/frontend

# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

COPY frontend/ .
RUN npm run build

# Stage 2: Python + system deps base
FROM python:3.14-slim AS python-base

WORKDIR /app

# hadolint ignore=DL3008
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libssl-dev \
    libffi-dev \
    libpq-dev \
    curl \
    libvips-dev \
    libheif-dev \
    libde265-dev \
    libx265-dev \
    libaom-dev \
    libdav1d-dev \
    pkg-config \
    git \
    ca-certificates \
    libwebp-dev \
    libjpeg62-turbo-dev \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Stage 3: final production image
FROM python-base AS final

ARG BUILD_TYPE=production

# Install Python dependencies
COPY backend/pyproject.toml ./
# hadolint ignore=DL3013
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir --upgrade pip && \
    python -c " \
import tomllib; \
data = tomllib.load(open('pyproject.toml', 'rb')); \
deps = [d for d in data['project'].get('dependencies', []) if 'photography-portfolio' not in d]; \
open('/tmp/requirements.txt', 'w').write('\n'.join(deps))" && \
    pip install --no-cache-dir -r /tmp/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    if [ "$BUILD_TYPE" = "development" ]; then \
        python -c " \
import tomllib; \
data = tomllib.load(open('pyproject.toml', 'rb')); \
deps = data.get('project', {}).get('optional-dependencies', {}).get('test', []); \
open('/tmp/test-requirements.txt', 'w').write('\n'.join(deps))" && \
        pip install --no-cache-dir -r /tmp/test-requirements.txt; \
    fi

# Copy backend application code
COPY backend/ .

# Install the package with git context for setuptools-scm versioning
RUN --mount=type=bind,source=.git,target=/app/.git \
    --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir --no-deps .

RUN mkdir -p uploads compressed

# Copy built React static files from frontend-build stage
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Copy configs and entrypoint
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
