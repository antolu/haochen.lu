# hadolint ignore=DL3008
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies including libvips and AVIF support
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
    libwebp-dev \
    libjpeg62-turbo-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject first to leverage Docker layer cache for dependencies
COPY pyproject.toml ./

# Install dependencies only (not the package itself) to avoid setuptools-scm issues
# hadolint ignore=DL3013,SC2046
RUN pip install --no-cache-dir "$(python -c "import tomllib; print(' '.join(tomllib.load(open('pyproject.toml', 'rb'))['project']['dependencies']))")"

# Copy application code after dependencies are cached
COPY . .

# Install the package itself after all source code is available
RUN pip install --no-cache-dir --no-deps .

# Create directories for uploads and compressed images
# hadolint ignore=DL3059
RUN mkdir -p uploads compressed

# Copy and make entrypoint script executable
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 8000

# Use custom entrypoint that handles migrations
ENTRYPOINT ["/docker-entrypoint.sh"]
