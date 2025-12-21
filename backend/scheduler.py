"""
Scheduler Service for automated pipeline execution

Handles:
- Hourly data ingestion cron job
- Automated imputation after ingestion
- Pipeline orchestration
"""

import asyncio
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.config import settings
from backend.logger import logger
from backend.database import check_database_connection
from backend.services.ingestion import ingestion_service
from backend.services.imputation import imputation_service


class SchedulerService:
    """Service for managing scheduled tasks"""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._is_running = False
    
    async def hourly_pipeline(self):
        """
        Hourly pipeline execution:
        1. Ingest latest data
        2. Detect missing values
        3. Impute missing values (where applicable)
        """
        logger.info("Starting hourly pipeline execution")
        start_time = datetime.now()
        
        try:
            # Step 1: Ingest hourly update
            logger.info("Step 1: Ingesting hourly data")
            ingest_result = await ingestion_service.ingest_hourly_update()
            logger.info(f"Ingestion completed: {ingest_result.get('completed', 0)} stations")
            
            # Step 2 & 3: Imputation cycle (includes detection)
            logger.info("Step 2: Running imputation cycle")
            impute_result = await imputation_service.run_imputation_cycle()
            logger.info(f"Imputation completed: {impute_result.get('total_imputed', 0)} values")
            
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"Hourly pipeline completed in {duration:.1f}s")
            
        except Exception as e:
            logger.error(f"Hourly pipeline failed: {e}")
            raise
    
    async def batch_ingestion(self, days: int = 30):
        """
        Batch ingestion for initial data load
        """
        logger.info(f"Starting batch ingestion for {days} days")
        
        try:
            result = await ingestion_service.ingest_all_stations(days)
            logger.info(
                f"Batch ingestion completed: "
                f"{result.get('completed', 0)}/{result.get('total_stations', 0)} stations, "
                f"{result.get('total_records', 0)} records"
            )
            return result
        except Exception as e:
            logger.error(f"Batch ingestion failed: {e}")
            raise
    
    def start(self):
        """Start the scheduler"""
        if self._is_running:
            logger.warning("Scheduler already running")
            return
        
        # Add hourly pipeline job
        self.scheduler.add_job(
            self.hourly_pipeline,
            trigger=CronTrigger(
                hour=settings.ingest_cron_hour,
                minute=settings.ingest_cron_minute
            ),
            id="hourly_pipeline",
            name="Hourly AQI Pipeline",
            replace_existing=True,
            max_instances=1,  # Prevent overlapping executions
        )
        
        self.scheduler.start()
        self._is_running = True
        
        logger.info(
            f"Scheduler started - hourly pipeline runs at {settings.ingest_cron_hour}:{settings.ingest_cron_minute}"
        )
    
    def stop(self):
        """Stop the scheduler"""
        if not self._is_running:
            return
        
        self.scheduler.shutdown(wait=True)
        self._is_running = False
        logger.info("Scheduler stopped")
    
    def get_jobs(self):
        """Get list of scheduled jobs"""
        return [
            {
                "id": job.id,
                "name": job.name,
                "next_run": str(job.next_run_time),
            }
            for job in self.scheduler.get_jobs()
        ]


# Singleton instance
scheduler_service = SchedulerService()


async def main():
    """Main entry point for scheduler service"""
    logger.info("Starting AQI Pipeline Scheduler Service")
    
    # Wait for database to be ready
    max_retries = 30
    for i in range(max_retries):
        if check_database_connection():
            break
        logger.warning(f"Database not ready, retrying... ({i+1}/{max_retries})")
        await asyncio.sleep(2)
    else:
        logger.error("Database connection failed after maximum retries")
        return
    
    # Run initial batch ingestion if no data exists
    from backend.database import get_db_context
    from backend.models import Station
    
    with get_db_context() as db:
        station_count = db.query(Station).count()
    
    if station_count == 0:
        logger.info("No stations found, running initial batch ingestion")
        await scheduler_service.batch_ingestion(days=30)
    
    # Start scheduler
    scheduler_service.start()
    
    # Run initial pipeline immediately
    await scheduler_service.hourly_pipeline()
    
    # Keep running
    try:
        while True:
            await asyncio.sleep(60)
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
        scheduler_service.stop()


if __name__ == "__main__":
    asyncio.run(main())
