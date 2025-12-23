# 🎯 Quick Command Reference

Essential commands for running and managing the AQI application.

---

## 🚀 Getting Started (First Time)

```bash
# 1. Setup
cp .env.example .env

# 2. Start everything
docker-compose up -d

# 3. Watch initialization
docker logs -f aqi_scheduler
# Press Ctrl+C when done

# 4. Access app
open http://localhost:5800/ebot/
```

---

## 📊 Daily Operations

### Start/Stop

```bash
# Start all services
docker-compose up -d

# Stop all services (keeps data)
docker-compose down

# Restart all services
docker-compose restart

# Restart single service
docker restart aqi_scheduler
```

### View Logs

```bash
# All services
docker-compose logs -f

# Single service (follow)
docker logs -f aqi_scheduler

# Last 100 lines
docker logs --tail 100 aqi_api

# Search for errors
docker logs aqi_scheduler 2>&1 | grep -i error
```

### Check Status

```bash
# Quick status
docker ps

# Detailed health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Resource usage
docker stats

# Specific service health
docker inspect --format='{{json .State.Health}}' aqi_api | jq
```

---

## 🔧 Troubleshooting

```bash
# Restart unhealthy service
docker restart aqi_api

# Rebuild service
docker-compose up -d --build aqi_api

# View service details
docker inspect aqi_scheduler

# Check database connection
docker exec aqi_timescaledb pg_isready -U aqi_user -d aqi_db

# Connect to database
docker exec -it aqi_timescaledb psql -U aqi_user -d aqi_db
```

---

## 💾 Backup & Restore

```bash
# Backup database
docker exec aqi_timescaledb pg_dump -U aqi_user aqi_db > backup.sql

# Restore database
cat backup.sql | docker exec -i aqi_timescaledb psql -U aqi_user aqi_db

# List volumes
docker volume ls

# Inspect volume
docker volume inspect envi_aqi_bot_timescale_data
```

---

## 🧹 Maintenance

```bash
# Clean up stopped containers
docker container prune

# Clean up unused images
docker image prune -a

# Clean up unused volumes (⚠️ DELETES DATA)
docker volume prune

# Clean everything (⚠️ DELETES EVERYTHING)
docker system prune -a --volumes

# View disk usage
docker system df
```

---

## 🔍 Data Queries

```bash
# Count stations
docker exec aqi_timescaledb psql -U aqi_user -d aqi_db -c "SELECT COUNT(*) FROM stations;"

# Count AQI records
docker exec aqi_timescaledb psql -U aqi_user -d aqi_db -c "SELECT COUNT(*) FROM aqi_hourly;"

# Latest data per station
docker exec aqi_timescaledb psql -U aqi_user -d aqi_db -c "SELECT station_id, MAX(datetime) FROM aqi_hourly GROUP BY station_id ORDER BY MAX(datetime) DESC LIMIT 10;"

# Check trained models
docker exec aqi_scheduler ls -lh /app/models | wc -l
```

---

## 🌐 API Testing

```bash
# Health check
curl http://localhost:5800/ebot/health | jq

# List stations
curl http://localhost:5800/ebot/api/stations | jq

# Get latest AQI
curl http://localhost:5800/ebot/api/aqi/01t/latest | jq

# Test chatbot
curl -X POST http://localhost:5800/ebot/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"query": "air quality in bangkok"}' | jq

# Trigger manual ingestion
curl -X POST http://localhost:5800/ebot/api/ingest/hourly | jq
```

---

## 🎯 URLs

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5800/ebot/ |
| **API Docs** | http://localhost:5800/ebot/docs |
| **Health Check** | http://localhost:5800/ebot/health |
| **Dashboard** | http://localhost:5800/ebot/ |
| **Models Page** | http://localhost:5800/ebot/models |
| **Chatbot** | http://localhost:5800/ebot/chat |

---

## 🆘 Emergency Commands

```bash
# Stop everything immediately
docker-compose down

# Force remove all containers
docker rm -f $(docker ps -aq)

# Reset completely (⚠️ DELETES ALL DATA)
docker-compose down -v
docker system prune -a --volumes
docker-compose up -d

# Restart from scratch (keeps code)
docker-compose down -v
docker-compose up -d --build
```

---

## 📱 One-Liners

```bash
# Quick health check all services
docker ps --format "{{.Names}}: {{.Status}}" | grep envi_aqi_bot

# Count total AQI records
docker exec aqi_timescaledb psql -U aqi_user -d aqi_db -t -c "SELECT COUNT(*) FROM aqi_hourly;"

# Latest model training
docker exec aqi_timescaledb psql -U aqi_user -d aqi_db -t -c "SELECT station_id, val_r2 FROM model_training_log ORDER BY created_at DESC LIMIT 10;"

# Check if scheduler is running
docker exec aqi_scheduler ps aux | grep scheduler

# View real-time logs from all services
docker-compose logs -f --tail=50

# Check ollama model status
docker exec aqi_ollama ollama list
```

---

## 🎨 Useful Aliases

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# AQI shortcuts
alias aqi-start='docker-compose up -d'
alias aqi-stop='docker-compose down'
alias aqi-restart='docker-compose restart'
alias aqi-logs='docker-compose logs -f'
alias aqi-status='docker ps --format "table {{.Names}}\t{{.Status}}"'
alias aqi-health='curl -s http://localhost:5800/ebot/health | jq'
alias aqi-db='docker exec -it aqi_timescaledb psql -U aqi_user -d aqi_db'
```

---

*Quick Reference Card - AQI Application*
*All commands assume you're in project directory*
