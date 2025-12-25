"""
Scheduler Service for Automated Data Collection and Gap Filling

Best Practices Implementation:
1. Hourly collection at XX:05 (5 min after hour to ensure data availability)
2. Gap detection and LSTM imputation every 6 hours
3. Daily full sync for data quality assurance
4. Retry logic for API failures
5. Health monitoring and alerting
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass, field
from enum import Enum

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from backend_model.logger import logger
from backend_model.config import settings
from backend_api.services.ingestion import ingestion_service
from backend_model.services.pipeline import pipeline_service
from backend_model.database import get_db_context


class JobStatus(Enum):
    """Job execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class JobResult:
    """Result of a scheduled job execution"""
    job_id: str
    job_name: str
    status: JobStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    records_processed: int = 0
    gaps_filled: int = 0
    error_message: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


class SchedulerService:
    """
    Scheduler for automated data collection and maintenance tasks
    
    Schedule Overview:
    - Hourly (XX:05): Fetch latest AQI data + scan gaps + fill with LSTM models
    - Every 6 hours (00:30, 06:30, 12:30, 18:30): Additional gap detection & imputation (safety net)
    - Daily (02:00): Full data quality check and cleanup
    - Weekly (Sunday 03:00): Retrain LSTM models with fresh data
    """
    
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.is_running = False
        self.last_hourly_run: Optional[datetime] = None
        self.last_imputation_run: Optional[datetime] = None
        self.job_history: list[JobResult] = []
        self.max_history = 100
    
    def initialize(self) -> None:
        """Initialize the scheduler with all jobs"""
        if self.scheduler is not None:
            return
        
        self.scheduler = AsyncIOScheduler(timezone="Asia/Bangkok")
        
        # === HOURLY DATA COLLECTION + GAP FILLING ===
        # Run at minute 5 of every hour (gives Air4Thai time to update)
        # Gap filling happens IMMEDIATELY after download (no separate job needed)
        self.scheduler.add_job(
            self._hourly_ingest_job,
            CronTrigger(minute=5),  # XX:05 every hour
            id="hourly_ingest",
            name="Hourly Data Ingestion + Gap Filling",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        
        # NOTE: Removed 6-hour gap imputation job
        # Gap filling now happens immediately after each hourly download
        # This is more efficient and fills gaps faster
        
        # === DAILY DATA QUALITY CHECK ===
        # Run at 2 AM daily
        self.scheduler.add_job(
            self._daily_quality_check_job,
            CronTrigger(hour=2, minute=0),  # 02:00 daily
            id="daily_quality",
            name="Daily Data Quality Check",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        
        # === WEEKLY MODEL RETRAINING ===
        # Run at 3 AM every Sunday
        self.scheduler.add_job(
            self._weekly_model_retrain_job,
            CronTrigger(day_of_week="sun", hour=3, minute=0),  # Sunday 03:00
            id="weekly_retrain",
            name="Weekly LSTM Model Retraining",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        
        # === STATION SYNC ===
        # Sync station metadata daily at 1 AM
        self.scheduler.add_job(
            self._station_sync_job,
            CronTrigger(hour=1, minute=0),  # 01:00 daily
            id="station_sync",
            name="Station Metadata Sync",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        
        logger.info("Scheduler initialized with all jobs")
    
    def start(self) -> None:
        """Start the scheduler"""
        if self.scheduler is None:
            self.initialize()
        
        if not self.is_running:
            self.scheduler.start()
            self.is_running = True
            logger.info("Scheduler started")
    
    def stop(self) -> None:
        """Stop the scheduler gracefully"""
        if self.scheduler is not None and self.is_running:
            self.scheduler.shutdown(wait=True)
            self.is_running = False
            logger.info("Scheduler stopped")
    
    def get_jobs(self) -> list[Dict[str, Any]]:
        """Get list of scheduled jobs with next run times"""
        if self.scheduler is None:
            return []
        
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            })
        return jobs
    
    def get_status(self) -> Dict[str, Any]:
        """Get scheduler status and health"""
        return {
            "is_running": self.is_running,
            "jobs": self.get_jobs(),
            "last_hourly_run": self.last_hourly_run.isoformat() if self.last_hourly_run else None,
            "last_imputation_run": self.last_imputation_run.isoformat() if self.last_imputation_run else None,
            "recent_jobs": [
                {
                    "job_name": r.job_name,
                    "status": r.status.value,
                    "started_at": r.started_at.isoformat(),
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "records_processed": r.records_processed,
                    "gaps_filled": r.gaps_filled,
                }
                for r in self.job_history[-10:]
            ],
        }
    
    def _add_job_result(self, result: JobResult) -> None:
        """Add job result to history"""
        self.job_history.append(result)
        if len(self.job_history) > self.max_history:
            self.job_history = self.job_history[-self.max_history:]
    
    async def _hourly_ingest_job(self) -> None:
        """
        Hourly data ingestion job with automatic gap filling
        
        Best Practice: 
        1. Fetch data at XX:05 to ensure Air4Thai has updated their data
        2. Immediately scan for gaps and fill with trained LSTM models
        """
        job_id = f"hourly_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        result = JobResult(
            job_id=job_id,
            job_name="Hourly Data Ingestion",
            status=JobStatus.RUNNING,
            started_at=datetime.now(),
        )
        
        logger.info("Starting hourly data ingestion")
        
        try:
            # Step 1: Fetch last 24 hours of data (overlap for safety)
            ingest_result = await ingestion_service.ingest_hourly_update()
            
            records_processed = sum(
                r.get("records", 0) for r in ingest_result.get("results", [])
            )
            
            logger.info(
                f"Data ingestion completed: {records_processed} records from "
                f"{ingest_result.get('completed', 0)}/{ingest_result.get('stations', 0)} stations"
            )
            
            # Step 2: Scan for gaps and fill with trained models
            gaps_filled = 0
            try:
                logger.info("Scanning for gaps and filling with trained models...")
                impute_result = await pipeline_service.run_imputation_only()
                gaps_filled = impute_result.get("total_imputed", 0)
                
                if gaps_filled > 0:
                    logger.info(f"Gap filling completed: {gaps_filled} gaps filled")
                else:
                    logger.info("No gaps found to fill")
                    
            except Exception as impute_error:
                logger.warning(f"Gap imputation after ingestion failed: {impute_error}")
                # Don't fail the whole job if imputation fails
            
            result.status = JobStatus.COMPLETED
            result.completed_at = datetime.now()
            result.records_processed = records_processed
            result.gaps_filled = gaps_filled
            result.details = {
                **ingest_result,
                "gaps_filled": gaps_filled,
            }
            
            self.last_hourly_run = datetime.now()
            
            logger.info(
                f"Hourly job completed: {records_processed} records ingested, "
                f"{gaps_filled} gaps filled"
            )
            
        except Exception as e:
            result.status = JobStatus.FAILED
            result.completed_at = datetime.now()
            result.error_message = str(e)
            logger.error(f"Hourly ingestion failed: {e}")
        
        self._add_job_result(result)
    
    async def _gap_imputation_job(self) -> None:
        """
        Gap detection and LSTM imputation job
        
        Best Practice: Run every 6 hours to fill any gaps that may have
        accumulated from API failures or missing data.
        """
        job_id = f"imputation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        result = JobResult(
            job_id=job_id,
            job_name="Gap Detection & LSTM Imputation",
            status=JobStatus.RUNNING,
            started_at=datetime.now(),
        )
        
        logger.info("Starting gap detection and imputation")
        
        try:
            # Run imputation for all stations
            impute_result = await pipeline_service.run_imputation_only()
            
            result.status = JobStatus.COMPLETED
            result.completed_at = datetime.now()
            result.gaps_filled = impute_result.get("total_imputed", 0)
            result.details = impute_result
            
            self.last_imputation_run = datetime.now()
            
            logger.info(f"Imputation completed: {result.gaps_filled} gaps filled")
            
        except Exception as e:
            result.status = JobStatus.FAILED
            result.completed_at = datetime.now()
            result.error_message = str(e)
            logger.error(f"Imputation job failed: {e}")
        
        self._add_job_result(result)
    
    async def _daily_quality_check_job(self) -> None:
        """
        Daily data quality check job
        
        Best Practice: Run at low-traffic time (2 AM) to analyze data quality,
        identify persistent gaps, and generate reports.
        """
        job_id = f"quality_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        result = JobResult(
            job_id=job_id,
            job_name="Daily Data Quality Check",
            status=JobStatus.RUNNING,
            started_at=datetime.now(),
        )
        
        logger.info("Starting daily data quality check")
        
        try:
            # Check data completeness for last 24 hours
            from sqlalchemy import text
            
            with get_db_context() as db:
                # Count total records and gaps
                quality_result = db.execute(text("""
                    SELECT 
                        COUNT(*) as total_records,
                        COUNT(*) FILTER (WHERE pm25 IS NULL AND is_imputed = FALSE) as raw_gaps,
                        COUNT(*) FILTER (WHERE pm25 IS NOT NULL) as filled_records,
                        COUNT(*) FILTER (WHERE is_imputed = TRUE) as imputed_records,
                        COUNT(DISTINCT station_id) as active_stations
                    FROM aqi_hourly
                    WHERE datetime >= NOW() - INTERVAL '24 hours'
                """)).fetchone()
                
                result.status = JobStatus.COMPLETED
                result.completed_at = datetime.now()
                result.details = {
                    "total_records": quality_result[0],
                    "raw_gaps": quality_result[1],
                    "filled_records": quality_result[2],
                    "imputed_records": quality_result[3],
                    "active_stations": quality_result[4],
                    "completeness_rate": round(
                        (quality_result[2] / quality_result[0] * 100) if quality_result[0] > 0 else 0, 2
                    ),
                }
                
                logger.info(
                    f"Quality check completed: {result.details['completeness_rate']}% completeness, "
                    f"{result.details['raw_gaps']} remaining gaps"
                )
                
        except Exception as e:
            result.status = JobStatus.FAILED
            result.completed_at = datetime.now()
            result.error_message = str(e)
            logger.error(f"Quality check failed: {e}")
        
        self._add_job_result(result)
    
    async def _weekly_model_retrain_job(self) -> None:
        """
        Weekly LSTM model retraining job
        
        Best Practice: Retrain models weekly with fresh data to adapt to
        seasonal changes and improve imputation accuracy.
        """
        job_id = f"retrain_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        result = JobResult(
            job_id=job_id,
            job_name="Weekly LSTM Model Retraining",
            status=JobStatus.RUNNING,
            started_at=datetime.now(),
        )
        
        logger.info("Starting weekly model retraining")
        
        try:
            # Get all stations and retrain models
            from backend_model.services.lstm_model import lstm_service
            
            with get_db_context() as db:
                from backend_model.models import Station
                stations = db.query(Station).all()
                station_ids = [s.station_id for s in stations]
            
            trained_count = 0
            for station_id in station_ids:
                try:
                    success = await lstm_service.train_model(station_id)
                    if success:
                        trained_count += 1
                except Exception as e:
                    logger.warning(f"Failed to retrain model for {station_id}: {e}")
                
                # Small delay between training
                await asyncio.sleep(0.5)
            
            result.status = JobStatus.COMPLETED
            result.completed_at = datetime.now()
            result.records_processed = trained_count
            result.details = {
                "total_stations": len(station_ids),
                "models_trained": trained_count,
            }
            
            logger.info(f"Retraining completed: {trained_count}/{len(station_ids)} models")
            
        except Exception as e:
            result.status = JobStatus.FAILED
            result.completed_at = datetime.now()
            result.error_message = str(e)
            logger.error(f"Retraining job failed: {e}")
        
        self._add_job_result(result)
    
    async def _station_sync_job(self) -> None:
        """
        Daily station metadata sync job
        
        Best Practice: Sync station metadata daily to catch new stations
        or updates to existing station information.
        """
        job_id = f"sync_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        result = JobResult(
            job_id=job_id,
            job_name="Station Metadata Sync",
            status=JobStatus.RUNNING,
            started_at=datetime.now(),
        )
        
        logger.info("Starting station metadata sync")
        
        try:
            stations = await ingestion_service.fetch_stations()
            
            with get_db_context() as db:
                count = ingestion_service.save_stations(db, stations)
            
            result.status = JobStatus.COMPLETED
            result.completed_at = datetime.now()
            result.records_processed = count
            result.details = {"stations_synced": count}
            
            logger.info(f"Station sync completed: {count} stations")
            
        except Exception as e:
            result.status = JobStatus.FAILED
            result.completed_at = datetime.now()
            result.error_message = str(e)
            logger.error(f"Station sync failed: {e}")
        
        self._add_job_result(result)
    
    # === MANUAL TRIGGER METHODS ===
    
    async def trigger_hourly_ingest(self) -> Dict[str, Any]:
        """Manually trigger hourly ingestion"""
        await self._hourly_ingest_job()
        return self.job_history[-1].details if self.job_history else {}
    
    async def trigger_imputation(self) -> Dict[str, Any]:
        """Manually trigger gap imputation"""
        await self._gap_imputation_job()
        return self.job_history[-1].details if self.job_history else {}
    
    async def trigger_quality_check(self) -> Dict[str, Any]:
        """Manually trigger quality check"""
        await self._daily_quality_check_job()
        return self.job_history[-1].details if self.job_history else {}


# Singleton instance
scheduler_service = SchedulerService()
