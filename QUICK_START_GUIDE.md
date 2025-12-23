# 🚀 Quick Start Guide - AQI Application

Complete step-by-step instructions to run the Air Quality Index Data Pipeline.

---

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ **Docker Desktop** installed (v20.10+ recommended)
- ✅ **Docker Compose** installed (v2.0+ recommended)
- ✅ **4GB+ RAM** available
- ✅ **10GB+ disk space** available

### Check Prerequisites:

```bash
# Check Docker
docker --version
# Expected: Docker version 20.10.0 or higher

# Check Docker Compose
docker compose version
# Expected: Docker Compose version v2.0.0 or higher

# Check available resources
docker system info | grep -E "CPUs|Total Memory"
# Should show at least 2 CPUs and 4GB memory
```

---

## 📥 Step 1: Clone or Navigate to Project

```bash
# If you already have the project
cd /Users/sakdahomhuan/Dev/envi_aqi_bot

# Verify you're in the right directory
ls -la
# Should see: docker-compose.yml, Dockerfile, backend_api/, backend_model/, frontend/
```

---

## ⚙️ Step 2: Create Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# (Optional) Edit configuration if needed
# nano .env
```

**Default configuration works out of the box!** You don't need to change anything.

### Environment Variables (Reference):

```bash
# Database (default values)
POSTGRES_USER=aqi_user
POSTGRES_PASSWORD=aqi_password
POSTGRES_DB=aqi_db

# Application
ENVIRONMENT=development
DEBUG=true

# LSTM Model
SEQUENCE_LENGTH=24
EPOCHS=100

# Scheduler (hourly at XX:05)
INGEST_CRON_HOUR=*
INGEST_CRON_MINUTE=5
```

---

## 🐳 Step 3: Start All Services

```bash
# Build and start all services in detached mode
docker-compose up -d
```

**What happens:**
1. Builds Docker images (first time: ~5-10 minutes)
2. Creates Docker volumes for data persistence
3. Starts 5 services: TimescaleDB, API, Frontend, Scheduler, Ollama
4. Runs health checks

**Expected output:**
```
[+] Running 5/5
 ✔ Container aqi_timescaledb  Started
 ✔ Container aqi_api          Started
 ✔ Container aqi_frontend     Started
 ✔ Container aqi_scheduler    Started
 ✔ Container aqi_ollama       Started
```

---

## 📊 Step 4: Monitor Initialization (AUTOMATIC)

The system will **automatically initialize** on first startup. This takes **15-40 minutes** total.

### 4a. Watch Ollama LLM Download (5-10 minutes)

```bash
docker logs -f aqi_ollama
```

**Expected output:**
```
Starting Ollama service...
Waiting for Ollama service to be ready...
Model 'qwen2.5:1.5b' not found. Downloading...
This may take 5-10 minutes depending on your internet speed...
pulling manifest
pulling ... 100%
Model 'qwen2.5:1.5b' downloaded successfully!
```

Press `Ctrl+C` when you see "downloaded successfully"

---

### 4b. Watch Data Download & Model Training (10-30 minutes)

```bash
docker logs -f aqi_scheduler
```

**Expected output (stages):**

**Stage 1: Database Connection**
```
Starting AQI Production Scheduler Service
Waiting for database connection...
Database connection established
```

**Stage 2: Initial Data Download (~5 minutes)**
```
No stations found in database
Running initial batch ingestion (30 days)...
Fetching data for station 01t...
Fetching data for station 02t...
...
Initial batch completed: 82 stations, 59,040 records
```

**Stage 3: LSTM Model Training (~10-25 minutes)**
```
Checking if LSTM models need initial training...
No LSTM models found. Training models for 82 stations...
This may take 10-30 minutes depending on data size.

Training model 1/82: 01t (Thon Buri, Bangkok)
  ✓ Model trained: 87.3% accuracy (R²)
Training model 2/82: 02t (Din Daeng, Bangkok)
  ✓ Model trained: 91.2% accuracy (R²)
...
Initial model training completed:
  - Trained: 78/82
  - Failed/Skipped: 4/82
```

**Stage 4: Running**
```
Scheduler service is now running.
```

Press `Ctrl+C` when you see "Scheduler service is now running"

---

## ✅ Step 5: Verify All Services Are Healthy

```bash
# Check service status
docker ps
```

**Expected output:**
```
NAME              STATUS                    PORTS
aqi_frontend      Up 2 minutes (healthy)    0.0.0.0:5800->80/tcp
aqi_api           Up 2 minutes (healthy)
aqi_scheduler     Up 2 minutes (healthy)
aqi_ollama        Up 2 minutes (healthy)
aqi_timescaledb   Up 2 minutes (healthy)
```

**All services should show `(healthy)` status.**

---

## 🌐 Step 6: Access the Application

### Frontend (Web Dashboard)
```
URL: http://localhost:5800/ebot/
```

**Features:**
- 📊 Live AQI Dashboard with map visualization
- 📈 Model Training Interface
- 💬 AI Chatbot (Thai/English)

### API Documentation
```
URL: http://localhost:5800/ebot/docs
```

**Interactive API docs** - Try the endpoints!

### Health Check
```
URL: http://localhost:5800/ebot/health
```

**Should return:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-12-23T07:00:00Z"
}
```

---

## 🧪 Step 7: Test the Application

### 7a. Test API Endpoints

```bash
# Get all stations
curl http://localhost:5800/ebot/api/stations | jq

# Get latest AQI for a station
curl http://localhost:5800/ebot/api/aqi/01t/latest | jq

# Check model training logs
curl http://localhost:5800/ebot/api/model/training-logs | jq
```

### 7b. Test AI Chatbot

```bash
curl -X POST http://localhost:5800/ebot/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"query": "ค่าฝุ่นในเชียงใหม่วันนี้เป็นอย่างไร"}' | jq
```

Expected: Thai response about Chiang Mai air quality

---

## 📁 Step 8: Verify Data Persistence

```bash
# Check Docker volumes
docker volume ls | grep envi_aqi_bot

# Should show:
# envi_aqi_bot_timescale_data
# envi_aqi_bot_ollama_data

# Inspect database volume
docker volume inspect envi_aqi_bot_timescale_data

# Check trained models
docker exec aqi_scheduler ls -lh /app/models | head -20

# Should show many .keras and .pkl files
```

---

## 🔄 Step 9: Common Operations

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker logs -f aqi_scheduler
docker logs -f aqi_api
docker logs -f aqi_ollama

# Last 100 lines
docker logs --tail 100 aqi_scheduler
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker restart aqi_scheduler
docker restart aqi_api
```

### Stop Services

```bash
# Stop all (keeps data)
docker-compose down

# Stop and remove volumes (DELETE ALL DATA!)
docker-compose down -v  # ⚠️ WARNING: This deletes all data!
```

### Start Again

```bash
# Start (will skip initialization if data exists)
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Problem: Service shows "unhealthy"

```bash
# Check what's wrong
docker inspect aqi_api | grep -A 10 Health

# View detailed logs
docker logs aqi_api

# Restart the service
docker restart aqi_api
```

### Problem: "Cannot connect to Docker daemon"

```bash
# Start Docker Desktop
open -a Docker

# Wait for Docker to be ready
docker ps
```

### Problem: Port 5800 already in use

```bash
# Find what's using the port
lsof -i :5800

# Kill the process or change port in docker-compose.yml
# Change: "5800:80" to "5801:80"
```

### Problem: Out of disk space

```bash
# Check Docker disk usage
docker system df

# Clean up unused data
docker system prune -a

# Remove old volumes
docker volume prune
```

### Problem: Scheduler stuck on "Waiting for database"

```bash
# Check database logs
docker logs aqi_timescaledb

# Restart database
docker restart aqi_timescaledb

# Wait 30 seconds, then restart scheduler
docker restart aqi_scheduler
```

### Problem: Models not training

```bash
# Check if data was downloaded
docker exec aqi_api psql postgresql://aqi_user:aqi_password@timescaledb:5432/aqi_db -c "SELECT COUNT(*) FROM aqi_hourly;"

# Should show > 50,000 records

# If no data, trigger manual ingestion
curl -X POST http://localhost:5800/ebot/api/ingest/batch
```

---

## 📊 Monitoring Dashboard

### Real-time Resource Usage

```bash
docker stats

# Shows CPU, Memory, Network usage for all containers
```

### Health Status

```bash
# Check all services
docker ps --format "table {{.Names}}\t{{.Status}}"

# Detailed health
for container in aqi_api aqi_scheduler aqi_ollama aqi_frontend aqi_timescaledb; do
  echo "=== $container ==="
  docker inspect --format='{{json .State.Health}}' $container | jq
done
```

### Database Status

```bash
# Connect to database
docker exec -it aqi_timescaledb psql -U aqi_user -d aqi_db

# Run queries
\dt                          # List tables
SELECT COUNT(*) FROM stations;
SELECT COUNT(*) FROM aqi_hourly;
SELECT COUNT(*) FROM model_training_log;
\q                           # Exit
```

---

## 💾 Backup & Restore

### Backup Database

```bash
# SQL dump
docker exec aqi_timescaledb pg_dump -U aqi_user aqi_db > backup_$(date +%Y%m%d).sql

# Volume backup
docker run --rm \
  -v envi_aqi_bot_timescale_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/db_backup_$(date +%Y%m%d).tar.gz -C /data .
```

### Restore Database

```bash
# From SQL dump
cat backup_20231223.sql | docker exec -i aqi_timescaledb psql -U aqi_user aqi_db

# From volume backup
docker run --rm \
  -v envi_aqi_bot_timescale_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/db_backup_20231223.tar.gz -C /data
```

---

## 🚀 Production Deployment Notes

### For production deployment:

1. **Change passwords** in `.env`:
   ```bash
   POSTGRES_PASSWORD=<strong-random-password>
   ```

2. **Set production mode**:
   ```bash
   ENVIRONMENT=production
   DEBUG=false
   ```

3. **Configure reverse proxy** (Nginx/Traefik):
   ```nginx
   location /ebot/ {
     proxy_pass http://localhost:5800/ebot/;
   }
   ```

4. **Enable HTTPS** with Let's Encrypt

5. **Set up monitoring** (Prometheus/Grafana)

6. **Configure backups** (automated daily backups)

---

## 📈 What Happens After Initialization?

Once initialized, the system runs automatically:

| Time | Action |
|------|--------|
| **Every hour (XX:05)** | Fetch latest AQI data from Air4Thai |
| **Every 6 hours** | Run gap detection and LSTM imputation |
| **Daily at 01:00** | Sync station metadata |
| **Daily at 02:00** | Run data quality checks |
| **Weekly (Sunday 03:00)** | Retrain all LSTM models |

**No manual intervention required!** 🎉

---

## 🎊 Success Checklist

Before considering setup complete, verify:

- ✅ All 5 services show `(healthy)` in `docker ps`
- ✅ Frontend accessible at http://localhost:5800/ebot/
- ✅ API docs accessible at http://localhost:5800/ebot/docs
- ✅ Database has >50,000 records (`SELECT COUNT(*) FROM aqi_hourly`)
- ✅ LSTM models trained (check scheduler logs)
- ✅ Ollama model downloaded (check ollama logs)
- ✅ Volumes created (`docker volume ls`)

---

## 🆘 Getting Help

### Check Documentation

- [README.md](README.md) - Project overview
- [STABILITY_IMPROVEMENTS.md](STABILITY_IMPROVEMENTS.md) - Stability features
- [.github/spec_lstm.md](.github/spec_lstm.md) - LSTM specification
- [.github/spec_chatbot.md](.github/spec_chatbot.md) - Chatbot specification

### View Logs for Debugging

```bash
# Check all services for errors
docker-compose logs | grep -i error

# Check specific service
docker logs aqi_scheduler 2>&1 | grep -i error
```

### Common Commands Reference

```bash
# Start
docker-compose up -d

# Stop (keeps data)
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Check status
docker ps

# Check resources
docker stats

# Clean up
docker system prune
```

---

## 🎉 You're Done!

Your AQI application is now running with:

✅ **Automatic data collection** every hour
✅ **LSTM models** for missing value imputation
✅ **AI chatbot** in Thai and English
✅ **Web dashboard** with interactive maps
✅ **Persistent data** storage
✅ **Production-ready** stability features

**Access your application:**
- 🌐 Frontend: http://localhost:5800/ebot/
- 📚 API Docs: http://localhost:5800/ebot/docs
- ❤️ Health: http://localhost:5800/ebot/health

---

*Last updated: 2025-12-23*
*Setup time: ~20-40 minutes (first run)*
*Status: Production Ready ✅*
