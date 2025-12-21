# AI Air Quality Chatbot - Setup Guide

## Overview

This chatbot provides natural language querying for air quality data using a **local LLM** (Ollama) with strict guardrails and API-mediated data access. It supports **Thai and English** queries.

## Architecture

```
User / Frontend Chat UI
   │
   ▼
AI Layer (FastAPI) - /api/chat/query
   │
   ├─ Layer 1: Keyword Filter (Pre-LLM)
   │   └─ Rejects non-air-quality queries
   │
   ├─ Layer 2: Domain-Restricted LLM Prompt
   │   └─ Ollama (qwen2.5:7b)
   │
   ├─ Layer 3: Intent Validation (Post-LLM)
   │   └─ JSON schema validation
   │
   ├─ API Orchestrator
   │   └─ Calls /api/aqi/history
   │
   ▼
Backend API - /api/aqi/history
   │
   ▼
TimescaleDB (PostgreSQL)
```

## Setup Instructions

### 1. Start Ollama Service

The Ollama service is defined in `docker-compose.yml`:

```bash
# Start all services including Ollama
docker compose up -d

# Pull the LLM model (required on first run)
docker exec -it aqi_ollama ollama pull qwen2.5:7b

# Verify model is loaded
docker exec -it aqi_ollama ollama list
```

**Expected output:**
```
NAME              ID              SIZE    MODIFIED
qwen2.5:7b        abc123def       4.7 GB  2 minutes ago
```

### 2. Verify AI Service Health

Check that all components are running:

```bash
curl http://localhost:8000/api/chat/health
```

**Expected response:**
```json
{
  "llm_service": "healthy",
  "orchestrator": "healthy",
  "guardrails": "active"
}
```

### 3. Access Chat UI

Open your browser to:
```
http://localhost/chat
```

Or from the Dashboard, click the "🤖 AI Chat" link in the header.

## Usage Examples

### Thai Language Queries

```
ขอดูค่า PM2.5 ย้อนหลัง 7 วันของสถานีเชียงใหม่
คุณภาพอากาศวันนี้ที่กรุงเทพฯ
ค่าฝุ่นเมื่อวานที่ขอนแก่น
แสดงกราฟ PM2.5 เดือนนี้ที่ภูเก็ต
```

### English Language Queries

```
Show me PM2.5 for the last week in Bangkok
Air quality today in Chiang Mai
PM2.5 trends last month in Phuket
What is the air quality in Khon Kaen?
```

## API Endpoints

### 1. Chat Query Endpoint

**POST** `/api/chat/query`

```bash
curl -X POST http://localhost:8000/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"query": "ขอดูค่า PM2.5 ย้อนหลัง 7 วันของสถานีเชียงใหม่"}'
```

**Response:**
```json
{
  "status": "success",
  "message": null,
  "intent": {
    "station_id": "01t",
    "pollutant": "pm25",
    "start_date": "2025-12-14T00:00:00",
    "end_date": "2025-12-21T23:59:59",
    "interval": "hour",
    "output_type": "chart"
  },
  "data": [
    {"time": "2025-12-14T00:00:00", "value": 25.5},
    {"time": "2025-12-14T01:00:00", "value": 27.3}
  ],
  "summary": {
    "data_points": 168,
    "valid_points": 160,
    "missing_points": 8,
    "min": 15.2,
    "max": 85.7,
    "mean": 35.4,
    "trend": "stable",
    "aqi_level": "good"
  },
  "output_type": "chart"
}
```

### 2. AQI History Endpoint

**GET** `/api/aqi/history`

```bash
curl "http://localhost:8000/api/aqi/history?station_id=01t&pollutant=pm25&start_date=2025-12-14T00:00:00&end_date=2025-12-21T23:59:59&interval=hour"
```

## Guardrails System

### Layer 1: Keyword Filter (Pre-LLM)

Checks for air quality-related keywords before invoking LLM:
- English: pm2.5, pm25, aqi, air quality, pollution, ozone, etc.
- Thai: คุณภาพอากาศ, ฝุ่น, มลพิษ, etc.

**Rejection example:**
```json
{
  "status": "out_of_scope",
  "message": "This system answers air quality-related questions only."
}
```

### Layer 2: Domain-Restricted LLM Prompt

System prompt enforces air quality domain:
```
You are an Air Quality Assistant.
You are allowed to handle ONLY:
- Air quality data
- Air pollutants (PM2.5, PM10, AQI, O3, NO2, SO2, CO)
...
```

### Layer 3: Intent Validation (Post-LLM)

Validates LLM output structure:
- Valid JSON format
- Required fields present
- No SQL injection attempts
- Valid datetime formats

## Configuration

Edit `app/config.py` or set environment variables:

```python
# AI Chatbot Configuration
ollama_url: str = "http://ollama:11434"
ollama_model: str = "qwen2.5:7b"  # Options: qwen2.5:7b, llama3.1:8b, mistral:7b
ollama_timeout: float = 30.0
```

### Changing the LLM Model

To use a different model:

1. Pull the model:
```bash
docker exec -it aqi_ollama ollama pull llama3.1:8b
```

2. Update config:
```bash
export OLLAMA_MODEL=llama3.1:8b
```

3. Restart API service:
```bash
docker compose restart api
```

## Troubleshooting

### Issue: "AI service temporarily unavailable"

**Cause:** Ollama service not running or model not loaded

**Solution:**
```bash
# Check Ollama container
docker ps | grep ollama

# Check Ollama logs
docker logs aqi_ollama

# Pull model if missing
docker exec -it aqi_ollama ollama pull qwen2.5:7b
```

### Issue: "Station not found"

**Cause:** Station name not recognized

**Solution:**
- Use exact station names from database
- Try alternative names (e.g., "เชียงใหม่" or "Chiang Mai")
- Check available stations: `GET /api/stations`

### Issue: LLM returns invalid JSON

**Cause:** Model hallucination or prompt drift

**Solution:**
- Lower temperature in `llm_adapter.py` (currently 0.1)
- Try different model (qwen2.5:7b recommended for Thai)
- Check Layer 3 validation logs

## Security Features

✅ **NO direct database access** - AI layer uses API only
✅ **NO SQL generation** - All queries are parameterized
✅ **NO code execution** - LLM output is data only
✅ **Maximum query length** - 300 characters
✅ **Three-layer guardrails** - Pre-LLM, domain, post-LLM validation
✅ **SQL injection protection** - Intent validation blocks dangerous keywords

## Performance

- **LLM inference time**: 1-3 seconds (depends on hardware)
- **API data retrieval**: 100-500ms
- **Total response time**: 1.5-4 seconds

### Optimizations

1. **Use GPU** (if available):
   Update `docker-compose.yml`:
   ```yaml
   ollama:
     deploy:
       resources:
         reservations:
           devices:
             - driver: nvidia
               count: 1
               capabilities: [gpu]
   ```

2. **Use smaller model**:
   ```bash
   docker exec -it aqi_ollama ollama pull qwen2.5:3b
   ```

3. **Increase Ollama memory**:
   ```yaml
   ollama:
     deploy:
       resources:
         limits:
           memory: 8G  # Increase from 4G
   ```

## Testing

Test the full pipeline:

```bash
# 1. Health check
curl http://localhost:8000/api/chat/health

# 2. Thai query
curl -X POST http://localhost:8000/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"query": "ขอดูค่า PM2.5 ย้อนหลัง 7 วันของสถานีเชียงใหม่"}'

# 3. English query
curl -X POST http://localhost:8000/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me PM2.5 for the last week in Bangkok"}'

# 4. Out-of-scope query (should be rejected)
curl -X POST http://localhost:8000/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the weather today?"}'
```

## Monitoring

Check logs:
```bash
# API logs
docker logs -f aqi_api

# Ollama logs
docker logs -f aqi_ollama

# Filter for chatbot activity
docker logs aqi_api 2>&1 | grep -i "chat\|llm\|guardrail"
```

## Production Considerations

1. **Rate Limiting**: Add rate limiting to prevent abuse
2. **Caching**: Cache common queries to reduce LLM calls
3. **Model Versioning**: Track which model version served each query
4. **User Feedback**: Collect thumbs up/down for response quality
5. **A/B Testing**: Compare different models or prompts
6. **Monitoring**: Track query success rate, latency, and errors

## Reference

- Specification: `spec_chatbot.md`
- Backend code: `app/services/ai/`
- Frontend code: `frontend/src/pages/Chat.jsx`
- Docker config: `docker-compose.yml`
