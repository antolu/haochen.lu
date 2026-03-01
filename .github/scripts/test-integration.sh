#!/bin/bash
set -e

# Moved here from repo root for CI organization
# Original location: ./test-integration.sh

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
      exit 0
      ;;
    *)
      SPECIFIC_TEST="$1"
      shift
      ;;
  esac
done

cleanup() {
  docker compose -f docker-compose.test.yml down -v --remove-orphans 2>/dev/null || true
}

if [ "$CLEAN_ONLY" = true ]; then
  cleanup
  exit 0
fi

trap cleanup EXIT INT TERM

if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running"
  exit 1
fi

docker compose -f docker-compose.test.yml build --quiet backend test-runner
docker compose -f docker-compose.test.yml up -d db redis

# Wait for services
max_wait=30
counter=0
while [ $counter -lt $max_wait ]; do
  if docker compose -f docker-compose.test.yml ps | grep -q "healthy"; then
    db_healthy=$(docker compose -f docker-compose.test.yml ps db | grep -c "healthy" || echo "0")
    redis_healthy=$(docker compose -f docker-compose.test.yml ps redis | grep -c "healthy" || echo "0")

    if [ "$db_healthy" -eq 1 ] && [ "$redis_healthy" -eq 1 ]; then
      break
    fi
  fi

  counter=$((counter + 1))
  if [ $counter -eq $max_wait ]; then
    docker compose -f docker-compose.test.yml logs db redis
    exit 1
  fi

  sleep 1
done

docker compose -f docker-compose.test.yml up -d backend

# Wait for backend
max_wait=60
counter=0
while [ $counter -lt $max_wait ]; do
  if docker compose -f docker-compose.test.yml ps backend | grep -q "healthy"; then
    break
  fi

  counter=$((counter + 1))
  if [ $counter -eq $max_wait ]; then
    docker compose -f docker-compose.test.yml logs backend
    exit 1
  fi

  sleep 1
done

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

if docker compose -f docker-compose.test.yml run --rm test-runner sh -c "$TEST_CMD"; then
  exit 0
else
  docker compose -f docker-compose.test.yml logs --tail=200 backend
  docker compose -f docker-compose.test.yml logs --tail=100 test-runner
  exit 1
fi
