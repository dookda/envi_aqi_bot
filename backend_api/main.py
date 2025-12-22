"""
FastAPI Application - Main Entry Point

Provides REST API for:
- Data ingestion management
- Model training and imputation
- Data querying and analytics
- System health monitoring
"""

from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend_api import __version__
from backend_model.config import settings
from backend_model.logger import logger
from backend_model.database import get_db, check_database_connection
from backend_model.models import Station, AQIHourly, IngestionLog, ImputationLog, ModelTrainingLog
from backend_api.schemas import (
    StationResponse, StationWithStats, AQIHourlyResponse,
    IngestionRequest, IngestionLogResponse,
    ImputationRequest, ImputationLogResponse,
    TrainModelRequest, ModelTrainingLogResponse,
    MissingDataAnalysis, MissingDataGap,
    ValidationResult, HealthResponse,
    AQIHistoryDataPoint, AQIHistoryRequest,
    ChatQueryRequest, ChatResponse
)
from backend_api.services.ingestion import ingestion_service
from backend_model.services.imputation import imputation_service
from backend_model.services.lstm_model import lstm_model_service
from backend_model.services.validation import validation_service
from backend_api.services.scheduler import scheduler_service
from backend_model.services.anomaly import anomaly_service
from backend_api.services.ai.chatbot import chatbot_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info(f"Starting AQI Pipeline API v{__version__}")
    
    # Check database connection
    if not check_database_connection():
        logger.error("Database connection failed on startup")
    
    # Start scheduler for automated data collection
    try:
        scheduler_service.start()
        logger.info("Scheduler started for automated hourly data collection")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
    
    yield
    
    # Stop scheduler gracefully
    scheduler_service.stop()
    logger.info("Shutting down AQI Pipeline API")


# API Tags for documentation organization
tags_metadata = [
    {
        "name": "🚀 Quick Start",
        "description": "**Key workflows to get started:**\n\n"
                       "1. `POST /api/ingest/batch` - Initial 30-day data load\n"
                       "2. `POST /api/model/train-all` - Train LSTM for all stations\n"
                       "3. `POST /api/impute/all` - Impute missing values\n"
                       "4. `POST /api/validate/{station_id}` - Validate model accuracy\n"
                       "5. `POST /api/pipeline/run` - Full automated pipeline",
    },
    {
        "name": "Health",
        "description": "API health and status monitoring",
    },
    {
        "name": "Stations",
        "description": "Station metadata management and sync from Air4Thai",
    },
    {
        "name": "AQI Data",
        "description": "Hourly PM2.5 measurements and missing data analysis",
    },
    {
        "name": "Ingestion",
        "description": "Data ingestion from Air4Thai APIs (batch and hourly)",
    },
    {
        "name": "Model Training",
        "description": "LSTM model training and management",
    },
    {
        "name": "Imputation",
        "description": "LSTM-based missing value imputation",
    },
    {
        "name": "Validation",
        "description": "Model validation with RMSE/MAE metrics and baseline comparison",
    },
    {
        "name": "Pipeline",
        "description": "Full automated pipeline execution",
    },
    {
        "name": "Scheduler",
        "description": "Automated hourly data collection and gap filling scheduler",
    },
    {
        "name": "AI Chat",
        "description": "Natural language chatbot for air quality queries (Thai/English) with local LLM",
    },
]

# Create FastAPI application
app = FastAPI(
    title="AQI Data Pipeline API",
    description="""
## 🌍 Hourly Air Quality Data Pipeline with LSTM-based Imputation

This API provides a complete solution for:
- **Data Ingestion**: Fetches PM2.5 data from Air4Thai APIs
- **Storage**: PostgreSQL with TimescaleDB for time-series data
- **LSTM Imputation**: Deep learning model for predicting missing values
- **Automated Pipeline**: Scheduled hourly ingestion and imputation
- **Validation**: RMSE/MAE metrics with baseline comparison

---

### 🚀 Quick Start Workflow

| Step | Endpoint | Description |
|------|----------|-------------|
| 1 | `POST /api/ingest/batch` | Initial 30-day data load from Air4Thai |
| 2 | `POST /api/model/train-all` | Train LSTM models for all stations |
| 3 | `POST /api/impute/all` | Impute missing PM2.5 values |
| 4 | `POST /api/validate/{station_id}` | Validate model accuracy |
| 5 | `POST /api/pipeline/run` | Run full automated pipeline |

---

### 📊 LSTM Model Architecture

```
Input (24 hours) → LSTM(64) → Dropout(0.2) → LSTM(32) → Dropout(0.2) → Dense(1)
```

### 📈 Missing Data Classification

| Gap Type | Duration | Action |
|----------|----------|--------|
| Short | 1-3 hours | Impute |
| Medium | 4-24 hours | Impute |
| Long | >24 hours | Flag only |
    """,
    version=__version__,
    lifespan=lifespan,
    openapi_tags=tags_metadata,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
import os
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


# ============== Visualization ==============

@app.get("/chart", tags=["Health"], include_in_schema=False)
async def chart_page():
    """Serve the time series chart visualization page"""
    chart_path = os.path.join(os.path.dirname(__file__), "static", "chart.html")
    if os.path.exists(chart_path):
        return FileResponse(chart_path, media_type="text/html")
    raise HTTPException(status_code=404, detail="Chart page not found")


# ============== Health & Status ==============

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check(db: Session = Depends(get_db)):
    """Check API and database health status"""
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        database=db_status,
        version=__version__,
        environment=settings.environment
    )


@app.get("/", tags=["Health"])
async def root():
    """API root endpoint with basic info"""
    return {
        "name": "AQI Data Pipeline API",
        "version": __version__,
        "docs": "/docs"
    }


# ============== Stations ==============

@app.get("/api/stations", response_model=List[StationResponse], tags=["Stations"])
async def list_stations(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """List all air quality monitoring stations with pagination"""
    stations = db.query(Station).offset(skip).limit(limit).all()
    return stations


@app.get("/api/stations/search", tags=["Stations", "AI Chat"])
async def search_stations(
    query: str = Query(..., description="Search query (e.g., 'Chiang Mai', 'เชียงใหม่', 'Bangkok')"),
    include_summary: bool = Query(default=True, description="Include recent AQI summary for each station")
):
    """
    Search for air quality monitoring stations by location name.

    **Supports Thai and English queries:**
    - "Chiang Mai" / "เชียงใหม่"
    - "Bangkok" / "กรุงเทพ"
    - Any station ID or partial name

    **Returns:**
    - List of matching stations with metadata
    - Recent AQI summary (7-day average, trend, AQI level) if `include_summary=true`
    - Overall search summary

    **Example:**
    ```
    GET /api/stations/search?query=Chiang%20Mai
    ```
    """
    from backend_api.services.ai.orchestrator import get_api_orchestrator
    
    orchestrator = get_api_orchestrator()
    
    if include_summary:
        result = await orchestrator.search_stations_with_summary(query)
    else:
        stations = orchestrator.search_stations(query)
        result = {
            "query": query,
            "total_found": len(stations),
            "stations": stations,
            "search_summary": f"Found {len(stations)} station(s) matching '{query}'"
        }
    
    return result


@app.get("/api/stations/{station_id}", response_model=StationWithStats, tags=["Stations"])
async def get_station(station_id: str, db: Session = Depends(get_db)):
    """Get station details with data statistics (total records, missing, imputed)"""
    station = db.query(Station).filter(Station.station_id == station_id).first()
    
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # Get statistics
    result = db.execute(
        text("""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE pm25 IS NULL) as missing,
                COUNT(*) FILTER (WHERE is_imputed = TRUE) as imputed
            FROM aqi_hourly
            WHERE station_id = :station_id
        """),
        {"station_id": station_id}
    ).first()
    
    total = result[0] if result else 0
    missing = result[1] if result else 0
    imputed = result[2] if result else 0
    
    return StationWithStats(
        **station.__dict__,
        total_records=total,
        missing_records=missing,
        imputed_records=imputed,
        missing_percentage=round(missing / total * 100, 2) if total > 0 else 0
    )


@app.post("/api/stations/sync", tags=["Stations"])
async def sync_stations(background_tasks: BackgroundTasks):
    """Sync station metadata from Air4Thai API (background task)"""
    background_tasks.add_task(_sync_stations_task)
    return {"message": "Station sync started", "status": "processing"}


async def _sync_stations_task():
    """Background task for station sync"""
    stations = await ingestion_service.fetch_stations()
    from backend_model.database import get_db_context
    with get_db_context() as db:
        ingestion_service.save_stations(db, stations)


# ============== AQI Data ==============

@app.get("/api/aqi/{station_id}", response_model=List[AQIHourlyResponse], tags=["AQI Data"])
async def get_aqi_data(
    station_id: str,
    db: Session = Depends(get_db),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    include_imputed: bool = True,
    limit: int = Query(default=720, le=8760)  # Max 1 year of hourly data
):
    """Get hourly PM2.5 data for a station with optional date range filtering"""
    query = db.query(AQIHourly).filter(AQIHourly.station_id == station_id)
    
    if start:
        query = query.filter(AQIHourly.datetime >= start)
    if end:
        query = query.filter(AQIHourly.datetime <= end)
    if not include_imputed:
        query = query.filter(AQIHourly.is_imputed == False)
    
    data = query.order_by(AQIHourly.datetime.desc()).limit(limit).all()
    return data


@app.get("/api/aqi/{station_id}/latest", response_model=AQIHourlyResponse, tags=["AQI Data"])
async def get_latest_aqi(station_id: str, db: Session = Depends(get_db)):
    """Get the most recent PM2.5 reading for a station"""
    latest = db.query(AQIHourly)\
        .filter(AQIHourly.station_id == station_id)\
        .filter(AQIHourly.pm25.isnot(None))\
        .order_by(AQIHourly.datetime.desc())\
        .first()
    
    if not latest:
        raise HTTPException(status_code=404, detail="No data available")
    
    return latest


@app.get("/api/aqi/{station_id}/missing", response_model=MissingDataAnalysis, tags=["AQI Data"])
async def analyze_missing_data(
    station_id: str,
    db: Session = Depends(get_db),
    days: int = Query(default=30, le=90)
):
    """Analyze missing data gaps for a station (short: 1-3h, medium: 4-24h, long: >24h)"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    analysis = ingestion_service.detect_missing_data(
        db, station_id, start_date, end_date
    )
    
    gaps = [
        MissingDataGap(
            start=g["start"],
            end=g["end"],
            hours=g["hours"],
            gap_type=g["type"]
        )
        for g in analysis.get("gaps", [])
    ]
    
    return MissingDataAnalysis(
        station_id=station_id,
        total_expected_hours=days * 24,
        total_present_hours=analysis.get("total_hours", 0) - analysis.get("missing_hours", 0),
        total_missing_hours=analysis.get("missing_hours", 0),
        missing_percentage=analysis.get("missing_percentage", 0),
        gaps=gaps,
        short_gaps=analysis.get("short_gaps", 0),
        medium_gaps=analysis.get("medium_gaps", 0),
        long_gaps=analysis.get("long_gaps", 0)
    )


@app.get("/api/aqi/history", response_model=List[AQIHistoryDataPoint], tags=["AQI Data"])
async def get_aqi_history(
    station_id: str = Query(..., description="Station ID"),
    pollutant: str = Query(default="pm25", description="Pollutant type (currently only pm25 supported)"),
    start_date: datetime = Query(..., description="Start datetime"),
    end_date: datetime = Query(..., description="End datetime"),
    interval: str = Query(default="hour", description="Aggregation interval: 15min | hour | day"),
    db: Session = Depends(get_db)
):
    """
    Get AQI history data for AI Layer queries.

    This endpoint is designed for the AI chatbot to retrieve air quality data
    based on parsed natural language queries.

    **Supported aggregation intervals:**
    - `15min`: 15-minute resolution (for periods ≤ 24 hours)
    - `hour`: Hourly resolution (for periods 1-7 days)
    - `day`: Daily resolution (for periods > 7 days)

    **Currently supported pollutants:**
    - `pm25`: PM2.5 particulate matter (μg/m³)
    """
    # Validate interval
    if interval not in ["15min", "hour", "day"]:
        raise HTTPException(status_code=400, detail="Invalid interval. Must be 15min, hour, or day")

    # Validate pollutant (currently only pm25)
    if pollutant != "pm25":
        raise HTTPException(status_code=400, detail="Currently only pm25 pollutant is supported")

    # Validate station exists
    station = db.query(Station).filter(Station.station_id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # For now, implement hour and day intervals
    # 15min would require additional TimescaleDB time_bucket functionality
    if interval == "15min":
        # Return raw hourly data (closest to 15min we have)
        query = db.query(AQIHourly).filter(
            AQIHourly.station_id == station_id,
            AQIHourly.datetime >= start_date,
            AQIHourly.datetime <= end_date
        ).order_by(AQIHourly.datetime.asc())

        data = query.all()
        return [
            AQIHistoryDataPoint(
                time=record.datetime.isoformat(),
                value=record.pm25
            )
            for record in data
        ]

    elif interval == "hour":
        # Return hourly data as-is
        query = db.query(AQIHourly).filter(
            AQIHourly.station_id == station_id,
            AQIHourly.datetime >= start_date,
            AQIHourly.datetime <= end_date
        ).order_by(AQIHourly.datetime.asc())

        data = query.all()
        return [
            AQIHistoryDataPoint(
                time=record.datetime.isoformat(),
                value=record.pm25
            )
            for record in data
        ]

    elif interval == "day":
        # Aggregate to daily averages using SQL
        result = db.execute(
            text("""
                SELECT
                    DATE_TRUNC('day', datetime) as day,
                    AVG(pm25) as avg_pm25
                FROM aqi_hourly
                WHERE station_id = :station_id
                    AND datetime >= :start_date
                    AND datetime <= :end_date
                    AND pm25 IS NOT NULL
                GROUP BY DATE_TRUNC('day', datetime)
                ORDER BY day ASC
            """),
            {
                "station_id": station_id,
                "start_date": start_date,
                "end_date": end_date
            }
        ).fetchall()

        return [
            AQIHistoryDataPoint(
                time=row[0].isoformat(),
                value=round(row[1], 2) if row[1] else None
            )
            for row in result
        ]


@app.get("/api/aqi/{station_id}/chart", tags=["AQI Data"])
async def get_chart_data(
    station_id: str,
    db: Session = Depends(get_db),
    days: int = Query(default=7, le=30),
    include_imputed: bool = True
):
    """
    Get time-series chart data for visualization
    
    Returns data formatted for charting with imputed value markers:
    - **timestamps**: ISO datetime strings for x-axis
    - **values**: PM2.5 values (null for gaps)
    - **is_imputed**: Boolean array to highlight gap-filled points
    - **gaps**: Array of gap period markers
    
    Use `is_imputed=true` points to render with different marker style (e.g., filled circles)
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    query = db.query(AQIHourly).filter(
        AQIHourly.station_id == station_id,
        AQIHourly.datetime >= start_date,
        AQIHourly.datetime <= end_date
    ).order_by(AQIHourly.datetime.asc())
    
    if not include_imputed:
        query = query.filter(AQIHourly.is_imputed == False)
    
    data = query.all()
    
    if not data:
        raise HTTPException(status_code=404, detail="No data available for this period")
    
    # Format for charting
    chart_data = {
        "station_id": station_id,
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days
        },
        "series": {
            "timestamps": [],
            "values": [],
            "is_imputed": []
        },
        "gaps": [],
        "statistics": {
            "total_points": 0,
            "valid_points": 0,
            "imputed_points": 0,
            "missing_points": 0,
            "completeness": 0,
            "mean": None,
            "min": None,
            "max": None
        }
    }
    
    # Build series data
    valid_values = []
    current_gap_start = None
    
    for record in data:
        chart_data["series"]["timestamps"].append(record.datetime.isoformat())
        chart_data["series"]["values"].append(record.pm25)
        chart_data["series"]["is_imputed"].append(record.is_imputed)
        
        if record.pm25 is not None:
            valid_values.append(record.pm25)
            if current_gap_start is not None:
                # End of gap
                chart_data["gaps"].append({
                    "start": current_gap_start.isoformat(),
                    "end": record.datetime.isoformat()
                })
                current_gap_start = None
            
            if record.is_imputed:
                chart_data["statistics"]["imputed_points"] += 1
        else:
            if current_gap_start is None:
                current_gap_start = record.datetime
            chart_data["statistics"]["missing_points"] += 1
    
    # Calculate statistics
    chart_data["statistics"]["total_points"] = len(data)
    chart_data["statistics"]["valid_points"] = len(valid_values)
    
    if valid_values:
        chart_data["statistics"]["mean"] = round(sum(valid_values) / len(valid_values), 2)
        chart_data["statistics"]["min"] = round(min(valid_values), 2)
        chart_data["statistics"]["max"] = round(max(valid_values), 2)
        chart_data["statistics"]["completeness"] = round(
            len(valid_values) / len(data) * 100, 2
        ) if data else 0
    
    # Add anomaly detection
    try:
        anomaly_data = anomaly_service.get_chart_data_with_anomalies(station_id, days)
        chart_data["anomalies"] = anomaly_data["anomalies"]
        chart_data["anomaly_timestamps"] = anomaly_data["anomaly_timestamps"]
        chart_data["statistics"]["anomaly_count"] = anomaly_data["summary"]["anomaly_count"]
    except Exception as e:
        logger.warning(f"Failed to detect anomalies for {station_id}: {e}")
        chart_data["anomalies"] = []
        chart_data["anomaly_timestamps"] = []
        chart_data["statistics"]["anomaly_count"] = 0
    
    return chart_data


# ============== Anomaly Detection ==============

@app.get("/api/aqi/{station_id}/anomalies", tags=["AQI Data"])
async def detect_anomalies(
    station_id: str,
    days: int = Query(default=7, ge=1, le=90, description="Number of days to analyze"),
    method: str = Query(default="all", description="Detection method: all, statistical, threshold, rate")
):
    """
    Detect anomalies in PM2.5 data for a station.
    
    **Detection Methods:**
    - `statistical`: Z-score based outlier detection
    - `threshold`: AQI threshold exceedances (unhealthy levels)
    - `rate`: Sudden spikes or drops in values
    - `all`: Combine all methods
    
    **Returns:**
    - List of anomalies with timestamps, values, types, and severity
    - Summary statistics including anomaly rate
    """
    from datetime import datetime, timedelta
    
    end_datetime = datetime.now()
    start_datetime = end_datetime - timedelta(days=days)
    
    result = anomaly_service.detect_anomalies(
        station_id=station_id,
        start_datetime=start_datetime,
        end_datetime=end_datetime,
        method=method
    )
    
    return result


@app.get("/api/anomalies/summary", tags=["AQI Data"])
async def get_anomaly_summary(
    days: int = Query(default=7, ge=1, le=30, description="Number of days to analyze"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of stations to check")
):
    """
    Get anomaly summary across all stations.
    
    Returns stations with the most anomalies for quick identification
    of problematic monitoring stations or areas with poor air quality.
    """
    from datetime import datetime, timedelta
    
    end_datetime = datetime.now()
    start_datetime = end_datetime - timedelta(days=days)
    
    with get_db_context() as db:
        # Get stations with data
        stations = db.query(Station).limit(limit).all()
    
    results = []
    for station in stations:
        try:
            anomaly_data = anomaly_service.detect_anomalies(
                station_id=station.station_id,
                start_datetime=start_datetime,
                end_datetime=end_datetime,
                method="all"
            )
            
            if anomaly_data["summary"]["anomaly_count"] > 0:
                results.append({
                    "station_id": station.station_id,
                    "station_name": station.name_en or station.name_th,
                    "anomaly_count": anomaly_data["summary"]["anomaly_count"],
                    "anomaly_rate": anomaly_data["summary"]["anomaly_rate"],
                    "anomaly_types": anomaly_data["summary"]["anomaly_types"],
                    "max_pm25": anomaly_data["summary"]["max_pm25"],
                })
        except Exception as e:
            logger.warning(f"Error checking anomalies for {station.station_id}: {e}")
    
    # Sort by anomaly count descending
    results.sort(key=lambda x: x["anomaly_count"], reverse=True)
    
    return {
        "period": {
            "start": start_datetime.isoformat(),
            "end": end_datetime.isoformat(),
            "days": days
        },
        "stations_analyzed": len(stations),
        "stations_with_anomalies": len(results),
        "results": results
    }




@app.post("/api/ingest/batch", tags=["🚀 Quick Start", "Ingestion"])
async def start_batch_ingestion(
    request: IngestionRequest,
    background_tasks: BackgroundTasks
):
    """
    **🚀 Step 1: Initial 30-day data load**
    
    Fetches historical PM2.5 data from Air4Thai API for all stations.
    This should be run first to populate the database with historical data.
    
    - Runs as a background task
    - Fetches up to 30 days of hourly data per station
    - Automatically detects and logs missing data gaps
    """
    background_tasks.add_task(
        _batch_ingest_task,
        request.station_ids,
        request.days
    )
    return {
        "message": "Batch ingestion started",
        "stations": request.station_ids or "all",
        "days": request.days
    }


async def _batch_ingest_task(station_ids: Optional[List[str]], days: int):
    """Background task for batch ingestion"""
    if station_ids:
        for station_id in station_ids:
            await ingestion_service.ingest_station_data(station_id, days)
    else:
        await ingestion_service.ingest_all_stations(days)


@app.post("/api/ingest/hourly", tags=["Ingestion"])
async def trigger_hourly_update(background_tasks: BackgroundTasks):
    """Trigger hourly data update (fetches last 24 hours for all stations)"""
    background_tasks.add_task(ingestion_service.ingest_hourly_update)
    return {"message": "Hourly update started"}


@app.get("/api/ingest/logs", response_model=List[IngestionLogResponse], tags=["Ingestion"])
async def get_ingestion_logs(
    db: Session = Depends(get_db),
    station_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get ingestion run history logs with status (running, completed, failed)"""
    query = db.query(IngestionLog)
    
    if station_id:
        query = query.filter(IngestionLog.station_id == station_id)
    if status:
        query = query.filter(IngestionLog.status == status)
    
    logs = query.order_by(IngestionLog.started_at.desc()).limit(limit).all()
    return logs


# ============== Model Training ==============

@app.post("/api/model/train", tags=["Model Training"])
async def train_model(
    request: TrainModelRequest,
    background_tasks: BackgroundTasks
):
    """Train LSTM model for a single station using contiguous sequences"""
    background_tasks.add_task(
        _train_model_task,
        request.station_id,
        request.epochs,
        request.force_retrain
    )
    return {
        "message": "Model training started",
        "station_id": request.station_id
    }


def _train_model_task(station_id: str, epochs: Optional[int], force_retrain: bool):
    """Background task for model training"""
    lstm_model_service.train_model(station_id, epochs, force_retrain)


@app.post("/api/model/train-all", tags=["🚀 Quick Start", "Model Training"])
async def train_all_models(
    background_tasks: BackgroundTasks,
    force_retrain: bool = False
):
    """
    **🚀 Step 2: Train LSTM for all stations**
    
    Trains LSTM models for each station using contiguous PM2.5 sequences.
    
    - Architecture: LSTM(64) → LSTM(32) → Dense(1)
    - Sequence length: 24 hours
    - Uses early stopping with patience=10
    - Set `force_retrain=true` to retrain existing models
    """
    background_tasks.add_task(_train_all_models_task, force_retrain)
    return {"message": "Training started for all stations"}


async def _train_all_models_task(force_retrain: bool):
    """Background task for training all models"""
    from backend_model.database import get_db_context
    with get_db_context() as db:
        stations = db.query(Station).all()
        station_ids = [station.station_id for station in stations]

    for station_id in station_ids:
        lstm_model_service.train_model(station_id, force_retrain=force_retrain)


@app.get("/api/model/{station_id}/info", tags=["Model Training"])
async def get_model_info(station_id: str):
    """Get trained model info including RMSE, MAE, and training samples"""
    info = lstm_model_service.get_model_info(station_id)
    
    if not info:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return info


@app.get("/api/models/status", tags=["Model Training"])
async def get_all_models_status(
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500)
):
    """
    Get status of all LSTM models and gap-filling capability per station.
    
    Returns:
    - Model availability per station
    - Training metrics (RMSE, MAE)
    - Data availability for training
    - Gap-filling readiness
    """
    stations = db.query(Station).limit(limit).all()
    
    results = []
    for station in stations:
        station_id = station.station_id
        
        # Get model info
        model_info = lstm_model_service.get_model_info(station_id)
        
        # Count data points
        data_count = db.execute(text("""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE pm25 IS NOT NULL) as valid,
                COUNT(*) FILTER (WHERE is_imputed = TRUE) as imputed,
                COUNT(*) FILTER (WHERE pm25 IS NULL) as missing
            FROM aqi_hourly WHERE station_id = :station_id
        """), {"station_id": station_id}).fetchone()
        
        # Determine gap-fill capability
        has_model = model_info is not None
        has_enough_data = data_count.valid >= 24 if data_count else False
        can_gap_fill = has_model and has_enough_data
        
        results.append({
            "station_id": station_id,
            "station_name": station.name_en or station.name_th,
            "model_status": {
                "has_model": has_model,
                "model_path": model_info.get("model_path") if model_info else None,
                "created_at": model_info.get("created_at").isoformat() if model_info and model_info.get("created_at") else None,
                "training_info": model_info.get("training_info") if model_info else None,
            },
            "data_status": {
                "total_points": data_count.total if data_count else 0,
                "valid_points": data_count.valid if data_count else 0,
                "imputed_points": data_count.imputed if data_count else 0,
                "missing_points": data_count.missing if data_count else 0,
                "has_enough_data": has_enough_data,
            },
            "gap_fill_ready": can_gap_fill,
        })
    
    # Summary
    total_stations = len(results)
    models_trained = sum(1 for r in results if r["model_status"]["has_model"])
    gap_fill_ready = sum(1 for r in results if r["gap_fill_ready"])
    
    return {
        "summary": {
            "total_stations": total_stations,
            "models_trained": models_trained,
            "gap_fill_ready": gap_fill_ready,
            "coverage_percent": round(models_trained / total_stations * 100, 1) if total_stations else 0,
        },
        "stations": results
    }



@app.get("/api/model/training-logs", response_model=List[ModelTrainingLogResponse], tags=["Model Training"])
async def get_training_logs(
    db: Session = Depends(get_db),
    station_id: Optional[str] = None,
    limit: int = 50
):
    """Get model training history with performance metrics"""
    query = db.query(ModelTrainingLog)
    
    if station_id:
        query = query.filter(ModelTrainingLog.station_id == station_id)
    
    logs = query.order_by(ModelTrainingLog.created_at.desc()).limit(limit).all()
    return logs


# ============== Imputation ==============

@app.post("/api/impute", tags=["Imputation"])
async def trigger_imputation(
    request: ImputationRequest,
    background_tasks: BackgroundTasks
):
    """Trigger LSTM-based imputation for a single station"""
    background_tasks.add_task(
        _imputation_task,
        request.station_id,
        request.start_datetime,
        request.end_datetime
    )
    return {
        "message": "Imputation started",
        "station_id": request.station_id
    }


def _imputation_task(
    station_id: str,
    start_datetime: Optional[datetime],
    end_datetime: Optional[datetime]
):
    """Background task for imputation"""
    imputation_service.impute_station_gaps(station_id, start_datetime, end_datetime)


@app.post("/api/impute/all", tags=["🚀 Quick Start", "Imputation"])
async def trigger_imputation_all(background_tasks: BackgroundTasks):
    """
    **🚀 Step 3: Impute missing values**
    
    Runs LSTM imputation for all stations with missing data.
    
    - Imputes short gaps (1-3 hours) and medium gaps (4-24 hours)
    - Skips long gaps (>24 hours) - flagged only
    - Requires minimum 24 hours of context for prediction
    - Logs all imputed values for auditability
    """
    background_tasks.add_task(_imputation_all_task)
    return {"message": "Imputation started for all stations"}


async def _imputation_all_task():
    """Background task for imputing all stations"""
    await imputation_service.run_imputation_cycle()


@app.get("/api/impute/logs", response_model=List[ImputationLogResponse], tags=["Imputation"])
async def get_imputation_logs(
    db: Session = Depends(get_db),
    station_id: Optional[str] = None,
    limit: int = 100
):
    """Get imputation audit logs with imputed values and model versions"""
    query = db.query(ImputationLog)
    
    if station_id:
        query = query.filter(ImputationLog.station_id == station_id)
    
    logs = query.order_by(ImputationLog.created_at.desc()).limit(limit).all()
    return logs


@app.post("/api/impute/rollback", tags=["Imputation"])
async def rollback_imputation(
    station_id: str,
    start: datetime,
    end: datetime,
    db: Session = Depends(get_db)
):
    """Rollback imputed values to NULL within a date range (for re-imputation)"""
    rolled_back = imputation_service.rollback_imputation(db, station_id, start, end)
    db.commit()
    return {
        "station_id": station_id,
        "rolled_back": rolled_back
    }


# ============== Validation ==============

@app.post("/api/validate/{station_id}", response_model=ValidationResult, tags=["🚀 Quick Start", "Validation"])
async def validate_model(
    station_id: str,
    mask_percentage: float = Query(default=0.1, ge=0.05, le=0.3)
):
    """
    **🚀 Step 4: Validate model accuracy**
    
    Performs offline validation by masking known values and comparing predictions.
    
    - Compares LSTM against linear interpolation and forward-fill baselines
    - Reports RMSE, MAE, and improvement percentages
    - Acceptance criteria: LSTM RMSE < Linear interpolation RMSE
    """
    result = validation_service.offline_validation(station_id, mask_percentage)
    
    if not result:
        raise HTTPException(status_code=400, detail="Validation failed - insufficient data or no model")
    
    return ValidationResult(**result)


@app.post("/api/validate/all", tags=["Validation"])
async def validate_all_models(
    background_tasks: BackgroundTasks,
    mask_percentage: float = 0.1
):
    """Validate all trained models against baselines (background task)"""
    background_tasks.add_task(_validation_all_task, mask_percentage)
    return {"message": "Validation started for all models"}


def _validation_all_task(mask_percentage: float):
    """Background task for validating all models"""
    return validation_service.validate_all_stations(mask_percentage)


# ============== Pipeline ==============

@app.post("/api/pipeline/run", tags=["🚀 Quick Start", "Pipeline"])
async def run_full_pipeline(background_tasks: BackgroundTasks):
    """
    **🚀 Step 5: Full automated pipeline**
    
    Runs the complete hourly pipeline:
    1. **Ingest**: Fetch latest data from Air4Thai
    2. **Detect**: Identify missing values
    3. **Impute**: Fill gaps using LSTM (where applicable)
    
    This is the same workflow that runs automatically every hour.
    """
    background_tasks.add_task(_full_pipeline_task)
    return {"message": "Full pipeline started"}


async def _full_pipeline_task():
    """Background task for full pipeline execution"""
    logger.info("Starting full pipeline")
    
    # Step 1: Ingest
    await ingestion_service.ingest_hourly_update()
    
    # Step 2: Impute
    await imputation_service.run_imputation_cycle()
    
    logger.info("Full pipeline completed")


# ============== Scheduler ==============

@app.get("/api/scheduler/status", tags=["Scheduler"])
async def get_scheduler_status():
    """
    Get current scheduler status and health
    
    Returns:
    - is_running: Whether scheduler is active
    - jobs: List of scheduled jobs with next run times
    - last_hourly_run: Last hourly ingestion time
    - last_imputation_run: Last imputation time
    - recent_jobs: Last 10 job execution results
    """
    return scheduler_service.get_status()


@app.get("/api/scheduler/jobs", tags=["Scheduler"])
async def list_scheduled_jobs():
    """
    List all scheduled jobs with their next run times
    
    **Scheduled Jobs:**
    | Job | Schedule | Description |
    |-----|----------|-------------|
    | hourly_ingest | XX:05 | Fetch latest AQI data |
    | gap_imputation | 00:30, 06:30, 12:30, 18:30 | LSTM gap filling |
    | daily_quality | 02:00 | Data quality check |
    | weekly_retrain | Sunday 03:00 | LSTM model retraining |
    | station_sync | 01:00 | Station metadata sync |
    """
    return {
        "scheduler_running": scheduler_service.is_running,
        "jobs": scheduler_service.get_jobs()
    }


@app.post("/api/scheduler/start", tags=["Scheduler"])
async def start_scheduler():
    """Start the automated scheduler (if not running)"""
    if scheduler_service.is_running:
        return {"message": "Scheduler already running", "status": "running"}
    
    scheduler_service.start()
    return {"message": "Scheduler started", "status": "running"}


@app.post("/api/scheduler/stop", tags=["Scheduler"])
async def stop_scheduler():
    """Stop the automated scheduler"""
    if not scheduler_service.is_running:
        return {"message": "Scheduler not running", "status": "stopped"}
    
    scheduler_service.stop()
    return {"message": "Scheduler stopped", "status": "stopped"}


@app.post("/api/scheduler/trigger/hourly", tags=["Scheduler"])
async def trigger_hourly_ingestion(background_tasks: BackgroundTasks):
    """
    Manually trigger hourly data ingestion
    
    **Best Practice**: Automated job runs at XX:05 (5 min after hour)
    to ensure Air4Thai has updated their data.
    """
    background_tasks.add_task(scheduler_service.trigger_hourly_ingest)
    return {"message": "Hourly ingestion triggered", "status": "processing"}


@app.post("/api/scheduler/trigger/imputation", tags=["Scheduler"])
async def trigger_gap_imputation(background_tasks: BackgroundTasks):
    """
    Manually trigger gap detection and LSTM imputation
    
    **Best Practice**: Automated job runs every 6 hours (00:30, 06:30, 12:30, 18:30)
    to fill accumulated gaps.
    """
    background_tasks.add_task(scheduler_service.trigger_imputation)
    return {"message": "Gap imputation triggered", "status": "processing"}


@app.post("/api/scheduler/trigger/quality", tags=["Scheduler"])
async def trigger_quality_check(background_tasks: BackgroundTasks):
    """
    Manually trigger daily data quality check

    Returns completeness rate, remaining gaps, and imputed record counts.
    """
    background_tasks.add_task(scheduler_service.trigger_quality_check)
    return {"message": "Quality check triggered", "status": "processing"}


# ============== AI Chat ==============

@app.post("/api/chat/query", response_model=ChatResponse, tags=["AI Chat"])
async def chat_query(request: ChatQueryRequest):
    """
    Process natural language query for air quality data.

    **Supported queries (Thai/English):**
    - "ขอดูค่า PM2.5 ย้อนหลัง 7 วันของสถานีเชียงใหม่"
    - "Show me PM2.5 for the last week in Bangkok"
    - "คุณภาพอากาศวันนี้ที่กรุงเทพฯ"
    - "Air quality today in Chiang Mai"

    **NEW: Station Search Queries:**
    - "Search for Chiang Mai stations"
    - "ค้นหาสถานีเชียงใหม่"
    - "List stations in Bangkok"
    - "Show me stations"

    **Three-Layer Guardrails:**
    1. Keyword filter (pre-LLM) - Rejects non-air-quality queries
    2. Domain-restricted prompt - LLM only handles air quality
    3. Intent validation (post-LLM) - Validates structured output

    **Security:**
    - NO direct database access
    - NO SQL generation
    - All data via whitelisted APIs only
    - Maximum query length: 300 characters

    **Response includes:**
    - `intent`: Parsed query parameters
    - `data`: Time-series data points OR station search results
    - `summary`: Statistics (min, max, mean, trend, AQI level) OR search summary
    - `output_type`: Presentation hint (text, chart, map, infographic)
    """
    try:
        result = await chatbot_service.process_query(request.query)
        return ChatResponse(**result)
    except Exception as e:
        import traceback
        logger.error(f"Chat query error: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return ChatResponse(
            status="error",
            message="An error occurred processing your query. Please try again.",
            intent=None,
            data=None,
            summary=None,
            output_type=None
        )


@app.get("/api/chat/health", tags=["AI Chat"])
async def chat_health_check():
    """
    Check health of AI chatbot components.

    Returns status of:
    - LLM service (Ollama)
    - API orchestrator
    - Guardrail system
    """
    health = await chatbot_service.health_check()
    return health
