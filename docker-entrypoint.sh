#!/bin/bash
set -e

wait_for_db() {
    echo "Waiting for database to be ready..."
    python <<END
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
                host=host, port=port, user=user, password=password,
                database=db_name, timeout=5
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

# If a command was passed (e.g. from migrate service), run it directly after DB wait
if [ $# -gt 0 ]; then
    if ! wait_for_db; then
        echo "Failed to connect to database, exiting"
        exit 1
    fi
    exec "$@"
fi

echo "Starting application..."

if ! wait_for_db; then
    echo "Failed to connect to database, exiting"
    exit 1
fi

echo "Running database migrations..."
WORKDIR="${WORKDIR:-/app}"
cd "$WORKDIR"
if [ -d "alembic" ] && [ -f "alembic.ini" ]; then
    alembic upgrade head
    echo "Migrations completed"
fi

echo "Starting supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
