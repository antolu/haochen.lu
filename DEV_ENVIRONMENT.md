# Development Environment Setup

This project supports both **production** and **development** environments using Docker Compose.

## Quick Start

### Development Environment (Live Reload)
```bash
# Start development environment with live reload
./dev.sh start

# View logs
./dev.sh logs

# Stop development environment
./dev.sh stop
```

### Production Environment
```bash
# Start production environment
./dev.sh prod

# Stop production environment
./dev.sh prod-stop
```

## Environment Details

### Development Environment
- **Frontend**: http://localhost:3000 (Vite dev server)
- **Backend**: http://localhost:8000 (FastAPI with --reload)
- **API**: http://localhost:8000/api
- **Live Reload**: ✅ Source code changes reflected immediately
- **Source Mounting**: ✅ Local files mounted into containers
- **Hot Module Replacement**: ✅ Frontend HMR enabled

### Production Environment
- **Application**: http://localhost (nginx proxy)
- **Live Reload**: ❌ Uses pre-built images
- **Source Mounting**: ❌ Containers run independently

## File Structure

```
├── docker-compose.yml          # Base configuration
├── docker-compose.dev.yml      # Development overrides
├── docker-compose.override.yml # Local overrides (optional)
├── dev.sh                      # Development management script
├── backend/
│   ├── Dockerfile              # Production backend image
│   └── Dockerfile.dev          # Development backend image
└── frontend/
    ├── Dockerfile              # Production frontend image
    └── Dockerfile.dev          # Development frontend image
```

## Available Commands

| Command | Description |
|---------|-------------|
| `./dev.sh start` | Start development environment |
| `./dev.sh stop` | Stop development environment |
| `./dev.sh restart` | Restart development environment |
| `./dev.sh logs [service]` | Show logs (all or specific service) |
| `./dev.sh prod` | Start production environment |
| `./dev.sh prod-stop` | Stop production environment |
| `./dev.sh build` | Build frontend |
| `./dev.sh test` | Run tests |
| `./dev.sh help` | Show help |

## Development Workflow

1. **Start Development Environment**:
   ```bash
   ./dev.sh start
   ```

2. **Make Changes**: Edit files in `frontend/src/` or `backend/app/`

3. **See Changes Immediately**: 
   - Frontend changes appear instantly at http://localhost:3000
   - Backend changes trigger automatic reload at http://localhost:8000

4. **Debug**: Use browser dev tools, backend logs, etc.

5. **Test**: 
   ```bash
   ./dev.sh test
   ```

6. **Stop When Done**:
   ```bash
   ./dev.sh stop
   ```

## Development Features

### Frontend (Vite)
- ⚡ Instant HMR (Hot Module Replacement)
- 🔄 Automatic browser refresh on file changes
- 📦 Source maps for debugging
- 🎯 TypeScript type checking

### Backend (FastAPI)
- 🔄 Automatic reload on file changes
- 🐛 Debug mode enabled
- 📝 Detailed logging
- 🔍 API docs at http://localhost:8000/docs

### Database & Redis
- 🗄️ Persistent data between restarts
- 🔄 Same database for dev and prod
- 📊 Admin tools available

## Troubleshooting

### Port Conflicts
If ports 3000 or 8000 are in use:
```bash
# Stop any existing containers
./dev.sh stop
docker compose down

# Check what's using the ports
lsof -i :3000
lsof -i :8000
```

### File Watching Issues (Windows/WSL)
If live reload isn't working:
- Ensure `CHOKIDAR_USEPOLLING=true` is set
- Try restarting the development environment

### Permission Issues
```bash
# Fix permissions on dev script
chmod +x dev.sh

# Fix Docker permissions (if needed)
sudo chown -R $USER:$USER .
```

### Container Issues
```bash
# Rebuild everything from scratch
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
./dev.sh start
```

## Migration Between Environments

### From Development to Production
```bash
./dev.sh stop
./dev.sh build  # Build frontend assets
./dev.sh prod   # Start production
```

### From Production to Development
```bash
./dev.sh prod-stop
./dev.sh start
```

## Tips

1. **Use Development for Active Development**: Live reload makes iteration much faster
2. **Use Production for Final Testing**: Test the actual deployment configuration
3. **Check Logs**: `./dev.sh logs` is your friend for debugging
4. **Database Persistence**: Database data persists between environment switches
