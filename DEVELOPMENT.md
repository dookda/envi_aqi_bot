# Development Setup Guide

This guide explains how to run the application in development mode with hot-reloading enabled.

## Development Mode (with Hot-Reloading)

For development, use the development Docker Compose configuration that enables hot-reloading for both frontend and backend:

```bash
# Start all services in development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Or run in detached mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
```

### What's Different in Development Mode?

**Frontend:**
- Runs Vite dev server (port 5173) instead of Nginx
- Source code is mounted as volumes
- Changes to `.tsx`, `.ts`, `.css` files trigger automatic reload
- No need to rebuild Docker image after code changes

**Backend:**
- Already configured with volume mounts
- Code changes automatically reload (FastAPI's auto-reload)
- `ENVIRONMENT=development` and `DEBUG=true` enabled

### Access Points

- Frontend: http://localhost:5800
- Backend API: http://localhost:8000 (via Nginx proxy)
- API Docs: http://localhost:8000/docs

## Production Mode

For production deployment, use the standard configuration:

```bash
# Build and start production services
docker-compose up --build -d

# Stop services
docker-compose down
```

Production mode:
- Frontend is built as static files and served via Nginx
- Optimized bundle size and performance
- No hot-reloading (requires image rebuild for changes)

## Quick Commands

```bash
# Development: Start with hot-reloading
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Development: Rebuild a specific service
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build frontend

# Development: View frontend logs only
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f frontend

# Development: Execute command in frontend container
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend npm install <package>

# Production: Full rebuild
docker-compose up --build --force-recreate
```

## File Watching

The development setup uses file polling to detect changes, which works across all operating systems including:
- Linux
- macOS (with Docker Desktop)
- Windows (with Docker Desktop or WSL2)

If hot-reloading isn't working:
1. Make sure you're using the dev compose file
2. Check that volumes are properly mounted
3. Verify file permissions
4. Try restarting the frontend container

## Troubleshooting

### Hot-reload not working?
```bash
# Restart the frontend container
docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart frontend
```

### Port already in use?
Change the port mapping in `docker-compose.dev.yml`:
```yaml
ports:
  - "5801:5173"  # Use 5801 instead of 5800
```

### Node modules issues?
```bash
# Rebuild without cache
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache frontend
```
