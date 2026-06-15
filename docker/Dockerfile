# syntax=docker/dockerfile:1.4
# hadolint ignore=DL3008

# Stage 1: build React frontend
FROM node:26-bookworm AS frontend-build

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
RUN npm install

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
    cmake \
    make \
    git \
    && rm -rf /var/lib/apt/lists/*

# Build and install the libheif AOM (AV1) encoder plugin for AVIF support.
# Debian's libheif packages only ship decoder plugins (dav1d, libde265);
# there is no packaged AVIF encoder plugin, so heifsave() fails with
# "Unsupported compression". Build the plugin from source against the
# headers/lib of whatever libheif-dev apt just installed, so the plugin
# ABI always matches the system libheif.so.1 (not pinned to a fixed tag,
# since apt may pull a newer libheif-dev on rebuild).
# hadolint ignore=DL3003
RUN git clone --branch "v$(pkg-config --modversion libheif)" --depth 1 https://github.com/strukturag/libheif.git /tmp/libheif && \
    cmake -S /tmp/libheif -B /tmp/libheif/build \
          -DCMAKE_BUILD_TYPE=Release \
          -DWITH_AOM_ENCODER=ON -DWITH_AOM_ENCODER_PLUGIN=ON \
          -DWITH_X265=ON -DWITH_X265_PLUGIN=ON \
          -DENABLE_PLUGIN_LOADING=ON \
          -DPLUGIN_DIRECTORY=/usr/lib/"$(gcc -dumpmachine)"/libheif/plugins \
          -DBUILD_TESTING=OFF -DWITH_EXAMPLES=OFF && \
    cmake --build /tmp/libheif/build -j"$(nproc)" && \
    cmake --install /tmp/libheif/build && \
    rm -rf /tmp/libheif

# Stage 3: final production image
FROM python-base AS final

ARG BUILD_TYPE=production
ARG SETUPTOOLS_SCM_PRETEND_VERSION=""

# Install Python dependencies
COPY backend/pyproject.toml ./
# hadolint ignore=DL3013
RUN --mount=type=cache,target=/root/.cache/pip <<EOF
pip install --no-cache-dir --upgrade pip
BUILD_TYPE="${BUILD_TYPE}" python -c "
import tomllib, os
data = tomllib.load(open('pyproject.toml', 'rb'))
deps = [d for d in data['project'].get('dependencies', []) if 'photography-portfolio' not in d]
if os.environ.get('BUILD_TYPE') == 'development':
    deps += [d for d in data['project'].get('optional-dependencies', {}).get('test', []) if 'photography-portfolio' not in d]
open('/tmp/requirements.txt', 'w').write('\n'.join(deps))
"
pip install --no-cache-dir -r /tmp/requirements.txt
EOF

# Copy backend application code
COPY backend/ .

# Install the package with git context for setuptools-scm versioning
RUN --mount=type=bind,source=.git,target=/app/.git \
    --mount=type=cache,target=/root/.cache/pip \
    SETUPTOOLS_SCM_PRETEND_VERSION=${SETUPTOOLS_SCM_PRETEND_VERSION} \
    pip install --no-cache-dir --no-deps .

RUN mkdir -p uploads compressed

# Copy built React static files from frontend-build stage
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Copy configs and entrypoint
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
