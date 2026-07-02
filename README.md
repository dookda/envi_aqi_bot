# Envi AQI Bot

A full-stack air quality monitoring platform for Thailand (Air4Thai network). It ingests hourly PM2.5/PM10/O3/CO/NO2/SO2 and weather data, fills gaps using per-station LSTM models, detects anomalies, serves a React dashboard, and exposes an AI chatbot (local Ollama or Anthropic Claude) reachable from the web app and a LINE bot.

## Architecture

```
┌────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Air4Thai  │────▶│  Ingestion   │────▶│ PostgreSQL+PostGIS│
│    APIs    │     │   Service    │     │  (aqi_hourly, ...)│
└────────────┘     └──────────────┘     └─────────┬─────────┘
                                                   │
      ┌────────────────────────────────────────────┼───────────────┐
      │                                             │               │
┌─────▼─────┐   ┌───────────────┐   ┌───────────────▼──┐   ┌────────▼───────┐
│   LSTM     │◀──│ Missing/Gap   │   │ Anomaly Detection │   │  FastAPI (api) │
│  Training  │   │  Detection    │   └───────────────────┘   │  + AI Chatbot  │
└─────┬─────┘   └───────────────┘                            │  (Ollama /     │
      │                                                       │   Claude)     │
┌─────▼─────┐                                                 └───────┬───────┘
│ Imputation │                                                        │
│  Service   │                                          ┌─────────────┼─────────────┐
└───────────┘                                    ┌───────▼──────┐ ┌───▼───┐ ┌───────▼──────┐
                                                  │ React Frontend│ │ LINE  │ │ CCTV / YOLO  │
                                                  │  (Vite, Nginx)│ │ Bot   │ │  Detection   │
                                                  └───────────────┘ └───────┘ └──────────────┘
```

An `apscheduler`-driven **scheduler** service runs the hourly ingest → detect → impute → quality-check pipeline independently of the API container.

## Services (Docker Compose)

| Service | Image / Build | Purpose | Port |
|---|---|---|---|
| `postgres` | `postgis/postgis:16-3.4` | Primary datastore (stations, hourly readings, logs, users) | 5433→5432 (internal) |
| `api` | `./Dockerfile` | FastAPI backend — REST API, auth, AI chat, uploads, CCTV detection | 8000 |
| `frontend` | `./frontend/Dockerfile` | React SPA built with Vite, served by Nginx | 5800→80 |
| `scheduler` | `./Dockerfile` (`backend_api.scheduler`) | Runs the automated hourly pipeline | — |
| `ollama` | `ollama/ollama` | Local LLM (`qwen3:1.7b`) for the AI chatbot | internal only |
| `data-prep` | `./backend_dataprepare/Dockerfile` | Isolated microservice for CSV preprocessing/upload preview | internal only |

Also present: `nginx/` load-balancer configs (`api-lb.conf`, `frontend-lb.conf`) for a scaled/production topology, and a `.agent/workflows/deploy-production.md` runbook for deploying to `envir-ai.com` with SSL.

## Repository Layout

```
backend_api/            FastAPI app, routers, auth, schemas, business services
├── main.py             App entrypoint — stations, AQI data, ingestion, training,
│                        imputation, validation, pipeline, scheduler, AI chat,
│                        CSV/data upload, CCTV detection endpoints
├── auth.py              JWT auth (passlib/bcrypt + python-jose)
├── scheduler.py          Standalone entrypoint for the `scheduler` container
├── routers/              notifications, LINE webhook, charts, users, LIFF, ai
├── services/
│   ├── ai/               chatbot.py, claude_chatbot.py, claude_adapter.py,
│   │                     llm_adapter.py, orchestrator.py, guardrails.py,
│   │                     place_matcher.py, region_matcher.py, response_composer.py
│   ├── ingestion.py, upload.py, chart_generator.py
│   ├── line_notification.py, notification.py, scheduler.py
│   └── yolo_detector.py  CCTV image object detection (Ultralytics YOLO)
└── scripts/              bulk_download_air4thai.py, train_aqi_models.py, ...

backend_model/           Shared domain layer (config, DB, ORM, ML services)
├── config.py             Pydantic Settings (DB, LSTM hyperparams, Air4Thai API, Ollama)
├── database.py           SQLAlchemy engine/session
├── models.py              Station, AQIHourly, ImputationLog, ModelTrainingLog,
│                          IngestionLog, User, Notification
└── services/
    ├── lstm_model.py      LSTM train/predict per station/parameter
    ├── imputation.py      Gap-filling orchestration (LSTM + linear/forward-fill fallback)
    ├── anomaly.py         Statistical/threshold/rate-based anomaly detection
    ├── validation.py      RMSE/MAE model validation vs. baselines
    └── pipeline.py        Full ingest→impute→validate pipeline runner

backend_dataprepare/     Standalone FastAPI microservice for raw CSV cleanup/preview
frontend/                React 19 + TypeScript + Vite + Tailwind v4 SPA (Atomic Design)
models/                  Trained Keras LSTM models + scalers, per pollutant (co, no2, o3, pm10, pm25, so2)
database/init/           SQL schema init scripts (stations, users, extra parameters)
alembic/versions/        Incremental schema migrations (Air4Thai params, anomaly columns, NOx)
tests/                   pytest suite (ingestion, LSTM model, validation)
nginx/                   Load-balancer configs for scaled deployments
.agent/workflows/        Deployment runbook(s)
```

## Backend (FastAPI)

**Stack:** FastAPI, SQLAlchemy + GeoAlchemy2 (PostGIS), Pydantic Settings, APScheduler, TensorFlow/Keras (LSTM), scikit-learn, Ultralytics YOLO + OpenCV, `line-bot-sdk`, JWT auth (`python-jose` + `passlib`/`bcrypt`).

Key endpoint groups exposed by `backend_api/main.py` and its routers:

- **Auth** — register/login (JWT), `GET /api/auth/me`, LINE Login (`/api/auth/line-login`)
- **Stations** — CRUD, search (Thai/English), sync from Air4Thai, per-station stats
- **AQI Data** — historical/latest readings, mockup data generator, full multi-parameter data with per-field imputation flags, history aggregation (hour/day), chart-ready series with gap markers
- **Anomaly Detection** — statistical/threshold/rate-based detection per station + cross-station summary
- **Ingestion** — batch (initial 30-day load) and hourly triggers, ingestion logs, live vs. DB freshness check (`/api/admin/data-status`)
- **Model Training** — train one/all stations, training readiness check, training logs, model status
- **Imputation** — impute one/all stations, imputation logs, rollback
- **Validation** — validate LSTM vs. linear/forward-fill baselines
- **Pipeline** — run the full ingest→impute→validate pipeline on demand
- **Scheduler** — status, jobs, start/stop, manual triggers (hourly/imputation/quality)
- **AI Chat** — natural-language queries via local Ollama (`/api/chat/query`) or Claude (`/api/chat/claude/query`), plus chart-insight generation
- **Data Upload** — CSV/station CSV preview & import, API-source preview/import
- **CCTV Detection** — YOLO-based detection on camera snapshots + LINE notification hook
- Routers: **notifications** (in-app alerts), **LINE webhook** (`/webhook`, LIFF chart rendering), **charts** (time series/preview images), **users** (admin user management), **liff** (LINE LIFF profile/notification opt-in)

### Data model highlights (`backend_model/models.py`)
- `Station` — PostGIS point geometry, Thai/English names
- `AQIHourly` — composite PK (`station_id`, `datetime`); one column + one `_imputed` flag per parameter (pm25, pm10, o3, co, no2, so2, nox, ws, wd, temp, rh, bp, rain); anomaly flag/type
- `ImputationLog`, `ModelTrainingLog`, `IngestionLog` — full audit trail
- `User` — JWT auth + LINE user linkage + notification opt-in
- `Notification` — in-app alerts

### LSTM pipeline
- Architecture: `Input(24h) → LSTM(64) → Dropout(0.2) → LSTM(32) → Dropout(0.2) → Dense(1)`
- One model + scaler per station **per pollutant** (see `models/{pollutant}/lstm_<station>.keras` + `scaler_<station>.pkl`)
- Trained only on contiguous (gap-free) sequences; early stopping (patience 10)
- Gap handling: short (1–3h) → forward-fill, medium (4–24h) → linear/LSTM, long (>24h) → flagged only, configurable via `backend_model/config.py`
- Validated against linear-interpolation and forward-fill baselines (must beat RMSE, no negative PM2.5)

## Frontend (React)

**Stack:** React 19 + TypeScript, Vite 7, Tailwind CSS v4, React Router v7, ECharts, MapLibre GL / Leaflet + react-map-gl, LINE LIFF SDK.

Organized with **Atomic Design** (`components/atoms`, `molecules`, `organisms`) per `.github/copilot-instructions.md` conventions.

Pages (`frontend/src/pages`): Dashboard, Models, Chat (protected), Admin (protected, admin-only), DataUpload, DataPreparation, CCTV, Stations (protected), Info, ExecutiveSummary (protected), Login/Register, Profile, Users (protected, admin-only), LiffProfile (LINE LIFF, no sidebar).

Cross-cutting contexts: `AuthContext`, `LanguageContext` (TH/EN), `ThemeContext`, `ToastContext`. Auth-gated routes wrapped in `ProtectedRoute` (with optional `requireAdmin`).

## Getting Started

```bash
cp .env.example .env      # edit values as needed
docker-compose up -d
```

On first boot the stack auto-downloads the Ollama model, backfills ~30 days of Air4Thai history, and trains initial LSTM models — watch progress with:

```bash
docker logs -f aqi_scheduler
docker logs -f aqi_ollama
```

Access:
- Frontend: http://localhost:5800/
- API docs (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/health

### Local development (without Docker)

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
docker-compose up -d postgres          # DB only
uvicorn backend_api.main:app --reload
python -m backend_api.scheduler        # in a second terminal

cd frontend && npm install && npm run dev
```

### Tests

```bash
pytest                                  # tests/test_ingestion.py, test_lstm_model.py, test_validation.py
pytest --cov=backend_model tests/
```

## Configuration

Settings are loaded via `backend_model/config.py` (Pydantic `BaseSettings`, reads `.env`). Notable variables (see `.env.example` for the full list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL/PostGIS connection string |
| `SEQUENCE_LENGTH`, `LSTM_UNITS_1/2`, `BATCH_SIZE`, `EPOCHS`, `EARLY_STOPPING_PATIENCE` | LSTM hyperparameters |
| `INGEST_CRON_HOUR`, `INGEST_CRON_MINUTE` | Scheduler cadence |
| `AIR4THAI_API_KEY` | Air4Thai API access |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Optional Claude-backed chatbot |
| `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_WEBHOOK_BASE_URL` | LINE Bot/LIFF integration |
| `OLLAMA_MODEL`, `OLLAMA_TIMEOUT` | Local LLM chatbot |
| `VITE_API_BASE_URL` | Frontend build-time API base URL |

Data persists in Docker named volumes `postgres_data` (DB) and `ollama_data` (LLM weights); trained models/logs are bind-mounted from `./models` and `./logs`.

## Operational Scripts

- `dev.sh` / `dev-stop.sh` — hot-reload dev stack (`docker-compose.yml` + `docker-compose.dev.yml`)
- `backup_database.sh`, `database/init/03_restore_backup.sh` — DB backup/restore helpers
- `migrate_to_postgres.sh` — legacy migration helper
- `backend_api/scripts/bulk_download_air4thai.py` — historical bulk data download
- `backend_api/scripts/train_all_aqi_models.sh` / `train_aqi_models.py` — batch model training across pollutants/stations
- `scripts/prepare_roiet_data.py` — station-specific data prep
- `alembic/versions/` — run via Alembic to apply incremental schema changes (Air4Thai params, anomaly columns, NOx)

## Notes

- `.github/spec_chatbot.md` and `.github/spec_lstm.md` contain the original detailed specs for the chatbot and LSTM imputation pipeline.
- `.agent/workflows/deploy-production.md` documents the production deployment path to `envir-ai.com` (rsync + Docker Compose prod overlay + Nginx/Certbot).
- Frontend dev conventions (Atomic Design, reuse existing components/tokens, MapLibre/Tailwind/React docs as references) are captured in `.github/copilot-instructions.md`.
