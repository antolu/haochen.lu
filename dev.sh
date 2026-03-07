#!/bin/bash

# Development environment management script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[DEV]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker and docker compose are available
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available"
        exit 1
    fi
}

# Function to start development environment
start_dev() {
    print_status "Starting development environment..."
    print_status "This will:"
    print_status "  - Mount source code for live reload"
    print_status "  - Use nginx proxy on standard ports"
    print_status "  - Frontend (Vite dev server) with HMR"
    print_status "  - Backend (Uvicorn) with auto-reload"

    # Stop any existing containers
    docker compose -f docker-compose.dev.yml down

    # Build development images (BuildKit on, provenance off for speed)
    print_status "Building development images..."
    DOCKER_BUILDKIT=1 BUILDKIT_PROVENANCE=0 docker compose -f docker-compose.dev.yml build

    # Start development environment
    print_status "Starting containers..."
    docker compose -f docker-compose.dev.yml up -d

    print_status "Development environment started!"
    print_status "Application: http://localhost"
    print_status "API: http://localhost/api"
    print_status "Direct backend: http://localhost:8000 (debugging)"
    print_status ""
    print_status "To view logs: ./dev.sh logs"
    print_status "To stop: ./dev.sh stop"
}

# Function to stop development environment
stop_dev() {
    print_status "Stopping development environment..."
    docker compose -f docker-compose.dev.yml down
    print_status "Development environment stopped!"
}

# Function to restart development environment
restart_dev() {
    print_status "Restarting development environment..."
    stop_dev
    start_dev
}

# Rebuild development images from scratch (no cache) and restart
rebuild_dev() {
    print_status "Rebuilding development images with buildx..."

    # Ensure buildx builder exists and is bootstrapped
    if ! docker buildx inspect devbuilder >/dev/null 2>&1; then
        print_status "Creating buildx builder 'devbuilder'..."
        docker buildx create --name devbuilder --use
    else
        docker buildx use devbuilder >/dev/null 2>&1 || true
    fi
    docker buildx inspect --bootstrap

    # Determine mode: push (create/push multi-arch image) or load (build host arch and load)
    push_mode=0
    if [ "${2:-$1}" = "--push" ] || [ "$1" = "--push" ]; then
        push_mode=1
    fi

    # Map uname arch to docker platform
    host_arch=$(uname -m)
    case "$host_arch" in
        x86_64) host_platform="linux/amd64" ;;
        aarch64|arm64) host_platform="linux/arm64" ;;
        *) host_platform="linux/amd64" ;;
    esac

    build_one() {
        local context="$1"
        local dockerfile="$2"
        local tag="$3"
        local build_args="$4"
        local extra_args="${5:-}"

        local -a platforms
        if [ "$push_mode" -eq 1 ]; then
            platforms=("linux/amd64" "linux/arm64")
        else
            platforms=("$host_platform")
        fi

        local -a build_cmd=(docker buildx build --builder devbuilder --platform "$(IFS=,; echo "${platforms[*]}")" --pull)

        # Add extra args (split by space if needed)
        # shellcheck disable=SC2086
        if [ -n "$extra_args" ]; then
            for arg in $extra_args; do
                build_cmd+=("$arg")
            done
        fi

        if [ "$push_mode" -eq 1 ]; then
            build_cmd+=(--push)
        else
            build_cmd+=(--load)
        fi

        if [ -n "$build_args" ]; then
            build_cmd+=(--build-arg "$build_args")
        fi

        build_cmd+=(-t "$tag" -f "$dockerfile" "$context")

        print_status "Executing: ${build_cmd[*]}"
        "${build_cmd[@]}"
    }

    # Custom flags
    extra_build_flags=""
    if [[ "$*" == *"--no-cache"* ]]; then
        extra_build_flags="--no-cache"
        print_warning "Cache disabled for this build"
    fi

    # Build/push backend and frontend (targets specified for Docker Hub)
    build_one "." "backend/Dockerfile" "antonlu/arcadia-backend:dev" "BUILD_TYPE=development" "$extra_build_flags"
    build_one "./frontend" "frontend/Dockerfile.dev" "antonlu/arcadia-frontend:dev" "" "$extra_build_flags"

    # Always build nginx for local dev (load only)
    if [ "$push_mode" -eq 1 ]; then
        print_status "Also building nginx images locally for host arch"
        # shellcheck disable=SC2086
        docker buildx build --builder devbuilder --platform "$host_platform" --load --pull $extra_build_flags -t "antonlu/arcadia-nginx:dev" -f "frontend/Dockerfile.nginx.dev" "./frontend"
    else
        build_one "./frontend" "frontend/Dockerfile.nginx.dev" "antonlu/arcadia-nginx:dev" "" "$extra_build_flags"
    fi

    if [ "$push_mode" -eq 1 ]; then
        print_status "Push mode complete: images pushed to Docker Hub under antonlu/arcadia-*-dev"
    else
        print_status "Build-and-load complete: images loaded into local docker for host arch (${host_platform})."
    fi
}

# Function to show logs
show_logs() {
    service=${2:-""}
    follow_flag=""

    # Check if -f flag is provided
    if [[ "$*" == *"-f"* ]]; then
        follow_flag="-f"
        # Remove -f from service name if it was passed as service
        service=${service//-f/}
    fi

    if [ -n "$service" ]; then
        docker compose -f docker-compose.dev.yml logs $follow_flag "$service"
    else
        docker compose -f docker-compose.dev.yml logs $follow_flag
    fi
}

# Function to start production environment
start_prod() {
    print_status "Starting production environment..."
    print_status "This will use pre-built images without source mounting"

    # Stop development environment if running
    docker compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || true

    # Start production environment
    docker compose up -d

    print_status "Production environment started!"
    print_status "Application: http://localhost"
}

# Function to stop production environment
stop_prod() {
    print_status "Stopping production environment..."
    docker compose down
    print_status "Production environment stopped!"
}

# Function to build frontend
build_frontend() {
    print_status "Building frontend..."
    cd frontend
    npm run build
    cd ..
    print_status "Frontend built successfully!"
}

# Function to run tests
run_tests() {
    print_status "Running tests in development environment..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python -m pytest
    docker compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend npm run test
}

# Function to show help
show_help() {
    echo "Development Environment Management"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start, dev          Start development environment with live reload"
    echo "  stop               Stop development environment"
    echo "  restart            Restart development environment"
    echo "  logs [service] [-f] Show logs (optionally for specific service, -f to follow)"
    echo "  prod               Start production environment"
    echo "  prod-stop          Stop production environment"
    echo "  build              Build frontend"
    echo "  test               Run tests"
    echo "  help               Show this help message"
    echo ""
    echo "Development URLs:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:8000"
    echo "  API:      http://localhost:8000/api"
    echo ""
    echo "Production URLs:"
    echo "  Application: http://localhost"
}

# Main script logic
check_dependencies

case "${1:-help}" in
    "start"|"dev")
        start_dev
        ;;
    "stop")
        stop_dev
        ;;
    "restart")
        restart_dev
        ;;
    "rebuild")
        rebuild_dev "$@"
        ;;
    "logs")
        show_logs "$@"
        ;;
    "prod")
        start_prod
        ;;
    "prod-stop")
        stop_prod
        ;;
    "build")
        build_frontend
        ;;
    "test")
        run_tests
        ;;
    "help"|*)
        show_help
        ;;
esac
