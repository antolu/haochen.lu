#!/bin/bash
set -e

echo "Starting backend container..."

# Function to wait for database
wait_for_db() {
    echo "Waiting for database to be ready..."
    python << END
import asyncio
import asyncpg
import os
import time
import sys

async def check_db():
    database_url = os.getenv('DATABASE_URL', '')
    if not database_url:
        print("No DATABASE_URL found, skipping DB check")
        return True
    
    # Extract connection details from DATABASE_URL
    # Format: postgresql+asyncpg://user:pass@host:port/dbname
    url_parts = database_url.replace('postgresql+asyncpg://', '').split('/')
    db_name = url_parts[-1] if len(url_parts) > 1 else 'postgres'
    user_host_part = url_parts[0]
    
    if '@' in user_host_part:
        user_pass, host_port = user_host_part.split('@')
        if ':' in user_pass:
            user, password = user_pass.split(':')
        else:
            user, password = user_pass, ''
    else:
        host_port = user_host_part
        user, password = 'postgres', ''
    
    if ':' in host_port:
        host, port = host_port.split(':')
        port = int(port)
    else:
        host, port = host_port, 5432
    
    max_attempts = 30
    attempt = 0
    
    while attempt < max_attempts:
        try:
            conn = await asyncpg.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database=db_name,
                timeout=5
            )
            await conn.close()
            print(f"Database is ready! (attempt {attempt + 1})")
            return True
        except Exception as e:
            attempt += 1
            print(f"Database not ready (attempt {attempt}/{max_attempts}): {e}")
            if attempt < max_attempts:
                time.sleep(2)
    
    print("Database failed to become ready")
    return False

if __name__ == "__main__":
    result = asyncio.run(check_db())
    sys.exit(0 if result else 1)
END
}

# Function to run migrations
run_migrations() {
    echo "Running database migrations..."
    
    # Check if alembic is available and migrations exist
    if [ -d "alembic" ] && [ -f "alembic.ini" ]; then
        echo "Found Alembic configuration, running migrations..."
        alembic upgrade head
        echo "Migrations completed successfully"
    else
        echo "No Alembic configuration found, skipping migrations"
        echo "Database tables will be created automatically on first request"
    fi
}

# Main execution
echo "Backend startup sequence initiated"

# Wait for database to be ready
if ! wait_for_db; then
    echo "Failed to connect to database, exiting"
    exit 1
fi

# Run migrations
run_migrations

# Start the application
echo "Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

