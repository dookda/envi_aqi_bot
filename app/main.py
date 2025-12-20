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
from sqlalchemy.orm import Session
from sqlalchemy import text

from app import __version__
from app.config import settings
from app.logger import logger
from app.database import get_db, check_database_connection
from app.models import Station, AQIHourly, IngestionLog, ImputationLog, ModelTrainingLog
from app.schemas import (
    StationResponse, StationWithStats, AQIHourlyResponse,
    IngestionRequest, IngestionLogResponse,
    ImputationRequest, ImputationLogResponse,
    TrainModelRequest, ModelTrainingLogResponse,
    MissingDataAnalysis, MissingDataGap,
    ValidationResult, HealthResponse
)
from app.services.ingestion import ingestion_service
from app.services.imputation import imputation_service
from app.services.lstm_model import lstm_model_service
from app.services.validation import validation_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info(f"Starting AQI Pipeline API v{__version__}")
    
    # Check database connection
    if not check_database_connection():
        logger.error("Database connection failed on startup")
    
    yield
    
    logger.info("Shutting down AQI Pipeline API")


# Create FastAPI application
app = FastAPI(
    title="AQI Data Pipeline API",
    description="Hourly Air Quality Data Pipeline with LSTM-based Imputation",
    version=__version__,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== Health & Status ==============

@app.get("/health", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    """Check API and database health"""
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


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "AQI Data Pipeline API",
        "version": __version__,
        "docs": "/docs"
    }


# ============== Stations ==============

@app.get("/api/stations", response_model=List[StationResponse])
async def list_stations(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """List all stations"""
    stations = db.query(Station).offset(skip).limit(limit).all()
    return stations


@app.get("/api/stations/{station_id}", response_model=StationWithStats)
async def get_station(station_id: str, db: Session = Depends(get_db)):
    """Get station details with statistics"""
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


@app.post("/api/stations/sync")
async def sync_stations(background_tasks: BackgroundTasks):
    """Sync station metadata from Air4Thai API"""
    background_tasks.add_task(_sync_stations_task)
    return {"message": "Station sync started", "status": "processing"}


async def _sync_stations_task():
    """Background task for station sync"""
    stations = await ingestion_service.fetch_stations()
    from app.database import get_db_context
    with get_db_context() as db:
        ingestion_service.save_stations(db, stations)


# ============== AQI Data ==============

@app.get("/api/aqi/{station_id}", response_model=List[AQIHourlyResponse])
async def get_aqi_data(
    station_id: str,
    db: Session = Depends(get_db),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    include_imputed: bool = True,
    limit: int = Query(default=720, le=8760)  # Max 1 year of hourly data
):
    """Get AQI data for a station"""
    query = db.query(AQIHourly).filter(AQIHourly.station_id == station_id)
    
    if start:
        query = query.filter(AQIHourly.datetime >= start)
    if end:
        query = query.filter(AQIHourly.datetime <= end)
    if not include_imputed:
        query = query.filter(AQIHourly.is_imputed == False)
    
    data = query.order_by(AQIHourly.datetime.desc()).limit(limit).all()
    return data


@app.get("/api/aqi/{station_id}/latest", response_model=AQIHourlyResponse)
async def get_latest_aqi(station_id: str, db: Session = Depends(get_db)):
    """Get latest AQI reading for a station"""
    latest = db.query(AQIHourly)\
        .filter(AQIHourly.station_id == station_id)\
        .filter(AQIHourly.pm25.isnot(None))\
        .order_by(AQIHourly.datetime.desc())\
        .first()
    
    if not latest:
        raise HTTPException(status_code=404, detail="No data available")
    
    return latest


@app.get("/api/aqi/{station_id}/missing", response_model=MissingDataAnalysis)
async def analyze_missing_data(
    station_id: str,
    db: Session = Depends(get_db),
    days: int = Query(default=30, le=90)
):
    """Analyze missing data for a station"""
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


# ============== Ingestion ==============

@app.post("/api/ingest/batch")
async def start_batch_ingestion(
    request: IngestionRequest,
    background_tasks: BackgroundTasks
):
    """Start batch ingestion for stations"""
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


@app.post("/api/ingest/hourly")
async def trigger_hourly_update(background_tasks: BackgroundTasks):
    """Trigger hourly data update"""
    background_tasks.add_task(ingestion_service.ingest_hourly_update)
    return {"message": "Hourly update started"}


@app.get("/api/ingest/logs", response_model=List[IngestionLogResponse])
async def get_ingestion_logs(
    db: Session = Depends(get_db),
    station_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get ingestion run logs"""
    query = db.query(IngestionLog)
    
    if station_id:
        query = query.filter(IngestionLog.station_id == station_id)
    if status:
        query = query.filter(IngestionLog.status == status)
    
    logs = query.order_by(IngestionLog.started_at.desc()).limit(limit).all()
    return logs


# ============== Model Training ==============

@app.post("/api/model/train")
async def train_model(
    request: TrainModelRequest,
    background_tasks: BackgroundTasks
):
    """Train LSTM model for a station"""
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


@app.post("/api/model/train-all")
async def train_all_models(
    background_tasks: BackgroundTasks,
    force_retrain: bool = False
):
    """Train models for all stations"""
    background_tasks.add_task(_train_all_models_task, force_retrain)
    return {"message": "Training started for all stations"}


async def _train_all_models_task(force_retrain: bool):
    """Background task for training all models"""
    from app.database import get_db_context
    with get_db_context() as db:
        stations = db.query(Station).all()
    
    for station in stations:
        lstm_model_service.train_model(station.station_id, force_retrain=force_retrain)


@app.get("/api/model/{station_id}/info")
async def get_model_info(station_id: str):
    """Get model information for a station"""
    info = lstm_model_service.get_model_info(station_id)
    
    if not info:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return info


@app.get("/api/model/training-logs", response_model=List[ModelTrainingLogResponse])
async def get_training_logs(
    db: Session = Depends(get_db),
    station_id: Optional[str] = None,
    limit: int = 50
):
    """Get model training logs"""
    query = db.query(ModelTrainingLog)
    
    if station_id:
        query = query.filter(ModelTrainingLog.station_id == station_id)
    
    logs = query.order_by(ModelTrainingLog.created_at.desc()).limit(limit).all()
    return logs


# ============== Imputation ==============

@app.post("/api/impute")
async def trigger_imputation(
    request: ImputationRequest,
    background_tasks: BackgroundTasks
):
    """Trigger imputation for a station"""
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


@app.post("/api/impute/all")
async def trigger_imputation_all(background_tasks: BackgroundTasks):
    """Trigger imputation for all stations"""
    background_tasks.add_task(_imputation_all_task)
    return {"message": "Imputation started for all stations"}


async def _imputation_all_task():
    """Background task for imputing all stations"""
    await imputation_service.run_imputation_cycle()


@app.get("/api/impute/logs", response_model=List[ImputationLogResponse])
async def get_imputation_logs(
    db: Session = Depends(get_db),
    station_id: Optional[str] = None,
    limit: int = 100
):
    """Get imputation logs"""
    query = db.query(ImputationLog)
    
    if station_id:
        query = query.filter(ImputationLog.station_id == station_id)
    
    logs = query.order_by(ImputationLog.created_at.desc()).limit(limit).all()
    return logs


@app.post("/api/impute/rollback")
async def rollback_imputation(
    station_id: str,
    start: datetime,
    end: datetime,
    db: Session = Depends(get_db)
):
    """Rollback imputed values for a station"""
    rolled_back = imputation_service.rollback_imputation(db, station_id, start, end)
    db.commit()
    return {
        "station_id": station_id,
        "rolled_back": rolled_back
    }


# ============== Validation ==============

@app.post("/api/validate/{station_id}", response_model=ValidationResult)
async def validate_model(
    station_id: str,
    mask_percentage: float = Query(default=0.1, ge=0.05, le=0.3)
):
    """Validate model for a station"""
    result = validation_service.offline_validation(station_id, mask_percentage)
    
    if not result:
        raise HTTPException(status_code=400, detail="Validation failed - insufficient data or no model")
    
    return ValidationResult(**result)


@app.post("/api/validate/all")
async def validate_all_models(
    background_tasks: BackgroundTasks,
    mask_percentage: float = 0.1
):
    """Validate all trained models"""
    background_tasks.add_task(_validation_all_task, mask_percentage)
    return {"message": "Validation started for all models"}


def _validation_all_task(mask_percentage: float):
    """Background task for validating all models"""
    return validation_service.validate_all_stations(mask_percentage)


# ============== Pipeline ==============

@app.post("/api/pipeline/run")
async def run_full_pipeline(background_tasks: BackgroundTasks):
    """Run full pipeline: ingest -> detect -> impute"""
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
