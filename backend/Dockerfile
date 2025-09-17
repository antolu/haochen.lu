# hadolint ignore=DL3008
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml first for better caching
COPY pyproject.toml ./

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip==23.3.1 && \
    pip install --no-cache-dir -e .

# Copy application code
COPY . .

# Create directories for uploads and compressed images
RUN mkdir -p uploads compressed

# Copy and make entrypoint script executable
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 8000

# Use custom entrypoint that handles migrations
ENTRYPOINT ["/docker-entrypoint.sh"]
