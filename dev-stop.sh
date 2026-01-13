#!/bin/bash
# Stop development mode

echo "🛑 Stopping AQI application (development mode)..."

docker-compose -f docker-compose.yml -f docker-compose.dev.yml down "$@"

echo "✅ Development services stopped"
