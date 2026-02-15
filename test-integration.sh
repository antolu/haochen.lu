#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default values
VERBOSE=""
CLEAN_ONLY=false
SPECIFIC_TEST=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--verbose)
      VERBOSE="-v"
      shift
      ;;
    --clean)
      CLEAN_ONLY=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS] [TEST_PATH]"
      echo ""
      echo "Run integration tests in Docker Compose environment"
      echo ""
      echo "Options:"
      echo "  -v, --verbose    Verbose test output"
      echo "  --clean          Clean up test containers and exit"
      echo "  -h, --help       Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                                          # Run all integration tests"
      echo "  $0 -v                                       # Run with verbose output"
      echo "  $0 tests/integration/test_photo_api.py     # Run specific test file"
      echo "  $0 --clean                                  # Clean up test containers"
      exit 0
      ;;
    *)
      SPECIFIC_TEST="$1"
      shift
      ;;
  esac
done

# Function to clean up
cleanup() {
  echo -e "${YELLOW}Cleaning up test environment...${NC}"
  docker compose -f docker-compose.test.yml down -v --remove-orphans 2>/dev/null || true
  echo -e "${GREEN}Cleanup complete${NC}"
}

# If clean only, do it and exit
if [ "$CLEAN_ONLY" = true ]; then
  cleanup
  exit 0
fi

# Trap to ensure cleanup on exit
trap cleanup EXIT INT TERM

echo -e "${GREEN}Starting integration test environment...${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running${NC}"
  exit 1
fi

# Build images if needed
echo -e "${YELLOW}Building test images...${NC}"
docker compose -f docker-compose.test.yml build --quiet backend test-runner

# Start services
echo -e "${YELLOW}Starting test services...${NC}"
docker compose -f docker-compose.test.yml up -d db redis

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
max_wait=30
counter=0
while [ $counter -lt $max_wait ]; do
  if docker compose -f docker-compose.test.yml ps | grep -q "healthy"; then
    db_healthy=$(docker compose -f docker-compose.test.yml ps db | grep -c "healthy" || echo "0")
    redis_healthy=$(docker compose -f docker-compose.test.yml ps redis | grep -c "healthy" || echo "0")

    if [ "$db_healthy" -eq 1 ] && [ "$redis_healthy" -eq 1 ]; then
      echo -e "${GREEN}Services are ready${NC}"
      break
    fi
  fi

  counter=$((counter + 1))
  if [ $counter -eq $max_wait ]; then
    echo -e "${RED}Timeout waiting for services${NC}"
    docker compose -f docker-compose.test.yml logs db redis
    exit 1
  fi

  sleep 1
done

# Start backend with migrations and seeding
echo -e "${YELLOW}Starting backend and running migrations...${NC}"
docker compose -f docker-compose.test.yml up -d backend

# Wait for backend to be healthy
echo -e "${YELLOW}Waiting for backend to be ready...${NC}"
max_wait=60
counter=0
while [ $counter -lt $max_wait ]; do
  if docker compose -f docker-compose.test.yml ps backend | grep -q "healthy"; then
    echo -e "${GREEN}Backend is ready${NC}"
    break
  fi

  counter=$((counter + 1))
  if [ $counter -eq $max_wait ]; then
    echo -e "${RED}Timeout waiting for backend${NC}"
    docker compose -f docker-compose.test.yml logs backend
    exit 1
  fi

  sleep 1
done

# Run tests
echo ""
echo -e "${GREEN}Running integration tests...${NC}"
echo ""

# Build test command
TEST_CMD="pytest tests/integration/"
if [ -n "$SPECIFIC_TEST" ]; then
  TEST_CMD="pytest $SPECIFIC_TEST"
fi

if [ -n "$VERBOSE" ]; then
  TEST_CMD="$TEST_CMD -v"
else
  TEST_CMD="$TEST_CMD -q"
fi

TEST_CMD="$TEST_CMD --tb=short --junit-xml=test-results/junit.xml --cov=app --cov-report=html:test-results/htmlcov --cov-report=term-missing --durations=10 -m 'integration'"

# Run the test command in the test-runner container
if docker compose -f docker-compose.test.yml run --rm test-runner sh -c "$TEST_CMD"; then
  echo ""
  echo -e "${GREEN}✓ All integration tests passed${NC}"

  # Copy test results to host
  if [ -d "$SCRIPT_DIR/backend/test-results" ]; then
    echo ""
    echo -e "${YELLOW}Test results available at: backend/test-results/${NC}"
    echo -e "${YELLOW}Coverage report: backend/test-results/htmlcov/index.html${NC}"
  fi

  exit 0
else
  echo ""
  echo -e "${RED}✗ Integration tests failed${NC}"

  # Show backend logs if tests failed
  echo ""
  echo -e "${YELLOW}Backend logs (last 200 lines):${NC}"
  docker compose -f docker-compose.test.yml logs --tail=200 backend

  echo ""
  echo -e "${YELLOW}Test runner logs:${NC}"
  docker compose -f docker-compose.test.yml logs --tail=100 test-runner

  exit 1
fi
