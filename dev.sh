#!/bin/bash
# Development mode launcher with hot-reloading

echo "🚀 Starting AQI application in DEVELOPMENT mode..."
echo "   - Hot-reloading enabled for frontend and backend"
echo "   - No need to rebuild on code changes"
echo ""

docker-compose -f docker-compose.yml -f docker-compose.dev.yml up "$@"
