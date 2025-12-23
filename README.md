# AQI Data Pipeline with LSTM-based Imputation

A complete solution for hourly air quality data collection, storage, and intelligent missing value imputation using LSTM deep learning models.

## 📋 Overview

This project implements the specification defined in `lstm_spec.md`:

- **Data Ingestion**: Fetches PM2.5 data from Air4Thai APIs
- **Storage**: PostgreSQL with TimescaleDB for time-series data
- **LSTM Imputation**: Deep learning model for predicting missing values
- **Automated Pipeline**: Scheduled hourly ingestion and imputation
- **Validation**: RMSE/MAE metrics with baseline comparison

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AQI Data Pipeline                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │  Air4Thai   │────▶│  Ingestion  │────▶│ TimescaleDB │        │
│  │    APIs     │     │   Service   │     │  (Storage)  │        │
│  └─────────────┘     └─────────────┘     └──────┬──────┘        │
│                                                  │               │
│                      ┌─────────────┐     ┌──────▼──────┐        │
│                      │    LSTM     │◀────│  Missing    │        │
│                      │   Model     │     │  Detection  │        │
│                      └──────┬──────┘     └─────────────┘        │
│                             │                                    │
│                      ┌──────▼──────┐     ┌─────────────┐        │
│                      │ Imputation  │────▶│ Validation  │        │
│                      │   Service   │     │   Service   │        │
│                      └─────────────┘     └─────────────┘        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.11+ (for local development)

### Running with Docker

1. **Clone and configure**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

2. **Start all services**:
   ```bash
   docker-compose up -d
   ```

3. **Automatic Initialization** (First Startup):
   The system will automatically:
   - **Ollama LLM**: Download qwen2.5:1.5b model (5-10 minutes)
   - **Data**: Download 30-day historical data from Air4Thai
   - **Models**: Train LSTM models for all stations (10-30 minutes)
   - **Scheduler**: Start hourly data collection

   Monitor progress:
   ```bash
   # Watch scheduler initialization
   docker logs -f aqi_scheduler

   # Watch Ollama model download
   docker logs -f aqi_ollama
   ```

4. **Access the Application**:
   - Frontend: http://localhost:5800/ebot/
   - API: http://localhost:5800/ebot/api/
   - API Docs: http://localhost:5800/ebot/docs

### Local Development

1. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Start PostgreSQL with TimescaleDB**:
   ```bash
   docker-compose up -d timescaledb
   ```

3. **Run the API**:
   ```bash
   uvicorn app.main:app --reload
   ```

4. **Run the scheduler** (in another terminal):
   ```bash
   python -m app.scheduler
   ```

## 📁 Project Structure

```
envi_aqi_bot/
├── app/
│   ├── __init__.py           # Package initialization
│   ├── config.py             # Configuration management
│   ├── database.py           # Database connection
│   ├── logger.py             # Logging configuration
│   ├── main.py               # FastAPI application
│   ├── models.py             # SQLAlchemy ORM models
│   ├── schemas.py            # Pydantic schemas
│   ├── scheduler.py          # APScheduler for automation
│   └── services/
│       ├── __init__.py
│       ├── ingestion.py      # Data ingestion service
│       ├── imputation.py     # LSTM imputation service
│       ├── lstm_model.py     # LSTM model training/prediction
│       └── validation.py     # Model validation service
├── database/
│   └── init/
│       └── 01_init.sql       # Database initialization
├── alembic/                  # Database migrations
├── tests/                    # Unit tests
├── models/                   # Saved LSTM models (generated)
├── logs/                     # Application logs (generated)
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── README.md
```

## 🔧 API Endpoints

### Health & Status
- `GET /health` - Health check
- `GET /` - API info

### Stations
- `GET /api/stations` - List all stations
- `GET /api/stations/{id}` - Get station with stats
- `POST /api/stations/sync` - Sync from Air4Thai

### AQI Data
- `GET /api/aqi/{station_id}` - Get AQI data
- `GET /api/aqi/{station_id}/latest` - Get latest reading
- `GET /api/aqi/{station_id}/missing` - Analyze missing data

### Ingestion
- `POST /api/ingest/batch` - Start batch ingestion
- `POST /api/ingest/hourly` - Trigger hourly update
- `GET /api/ingest/logs` - Get ingestion logs

### Model Training
- `POST /api/model/train` - Train model for station
- `POST /api/model/train-all` - Train all models
- `GET /api/model/{station_id}/info` - Get model info
- `GET /api/model/training-logs` - Get training logs

### Imputation
- `POST /api/impute` - Impute for station
- `POST /api/impute/all` - Impute all stations
- `GET /api/impute/logs` - Get imputation logs
- `POST /api/impute/rollback` - Rollback imputations

### Validation
- `POST /api/validate/{station_id}` - Validate model
- `POST /api/validate/all` - Validate all models

### Pipeline
- `POST /api/pipeline/run` - Run full pipeline

## 🧠 LSTM Model Architecture

As specified in `lstm_spec.md`:

```
Input (24 hours) → LSTM(64) → Dropout(0.2) → LSTM(32) → Dropout(0.2) → Dense(1)
```

- **Sequence Length**: 24 hours
- **Loss Function**: Mean Squared Error (MSE)
- **Training**: Only on contiguous sequences (no gaps)

## 📊 Missing Data Classification

| Gap Type | Duration | Action |
|----------|----------|--------|
| Short | 1-3 hours | Impute |
| Medium | 4-24 hours | Impute |
| Long | >24 hours | Flag only |

## ✅ Validation & Acceptance Criteria

The system validates models against baselines:

1. **LSTM RMSE** < **Linear Interpolation RMSE**
2. No negative PM2.5 predictions

Baselines compared:
- Linear interpolation
- Forward-fill (naive)

## 🔄 Automated Pipeline

The scheduler runs hourly:

1. **Ingest**: Fetch latest data from Air4Thai
2. **Detect**: Identify missing values
3. **Impute**: Fill gaps using LSTM (where applicable)
4. **Commit**: Save to database

Configure schedule in `.env`:
```
INGEST_CRON_HOUR=*
INGEST_CRON_MINUTE=5
```

## 💾 Data Persistence

### Persistent Volumes

Your data is **automatically persisted** using Docker volumes:

```yaml
volumes:
  timescale_data:  # PostgreSQL database data
  ollama_data:     # Ollama LLM models
```

**What persists:**
- ✅ All AQI measurements and station data
- ✅ Trained LSTM models (in `/app/models`)
- ✅ Ollama LLM models (no re-download)
- ✅ Application logs (in `/app/logs`)

**Data survives:**
- ✅ `docker-compose restart`
- ✅ `docker-compose down` + `docker-compose up`
- ✅ Container crashes and restarts
- ❌ `docker-compose down -v` (WARNING: Deletes all volumes!)

### Backup & Restore

**Backup Database:**
```bash
# Create backup
docker exec aqi_timescaledb pg_dump -U aqi_user aqi_db > backup_$(date +%Y%m%d).sql

# Backup volume directly
docker run --rm -v envi_aqi_bot_timescale_data:/data -v $(pwd):/backup alpine tar czf /backup/timescaledb_backup_$(date +%Y%m%d).tar.gz -C /data .
```

**Restore Database:**
```bash
# From SQL dump
cat backup_20231223.sql | docker exec -i aqi_timescaledb psql -U aqi_user aqi_db

# From volume backup
docker run --rm -v envi_aqi_bot_timescale_data:/data -v $(pwd):/backup alpine tar xzf /backup/timescaledb_backup_20231223.tar.gz -C /data
```

**View Volume Location:**
```bash
docker volume inspect envi_aqi_bot_timescale_data
# Shows: /var/lib/docker/volumes/envi_aqi_bot_timescale_data/_data
```

## 📝 Logging & Auditability

All operations are logged:

- **Imputation events**: Station, datetime, value, model version
- **Training events**: Samples, RMSE, MAE, duration
- **Ingestion events**: Records fetched/inserted, missing detected

Logs are stored in:
- `logs/app.log` - All logs
- `logs/errors.log` - Errors only
- `logs/ingestion.log` - Ingestion events
- `logs/imputation.log` - Imputation events

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_lstm_model.py -v
```

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `SEQUENCE_LENGTH` | LSTM input sequence length | `24` |
| `LSTM_UNITS_1` | First LSTM layer units | `64` |
| `LSTM_UNITS_2` | Second LSTM layer units | `32` |
| `EPOCHS` | Max training epochs | `100` |
| `EARLY_STOPPING_PATIENCE` | Early stopping patience | `10` |
| `INGEST_CRON_HOUR` | Cron schedule hour | `*` |
| `INGEST_CRON_MINUTE` | Cron schedule minute | `5` |

## 📈 Future Extensions

As noted in the specification, the system is designed to be extendable to:
- PM10, O3, NO2 parameters
- Multi-station spatial interpolation
- Forecasting capabilities

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request
