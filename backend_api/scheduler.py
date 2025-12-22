"""
Scheduler Service Entry Point

This is the main entry point for the production scheduler service.
It uses the comprehensive scheduler from backend_api.services.scheduler
which includes:
- Hourly data ingestion (XX:05)
- Gap imputation every 6 hours (00:30, 06:30, 12:30, 18:30)
- Daily quality checks (02:00)
- Weekly model retraining (Sunday 03:00)
- Daily station metadata sync (01:00)
"""

import asyncio
from backend_model.logger import logger
from backend_model.database import check_database_connection
from backend_api.services.scheduler import scheduler_service


async def main():
    """Main entry point for production scheduler service"""
    logger.info("Starting AQI Production Scheduler Service")
    logger.info("=" * 60)

    # Wait for database to be ready
    logger.info("Waiting for database connection...")
    max_retries = 30
    for i in range(max_retries):
        if check_database_connection():
            logger.info("Database connection established")
            break
        logger.warning(f"Database not ready, retrying... ({i+1}/{max_retries})")
        await asyncio.sleep(2)
    else:
        logger.error("Database connection failed after maximum retries")
        return

    # Check if initial data load is needed
    from backend_model.database import get_db_context
    from backend_model.models import Station

    with get_db_context() as db:
        station_count = db.query(Station).count()

    if station_count == 0:
        logger.info("No stations found in database")
        logger.info("Running initial batch ingestion (30 days)...")

        from backend_api.services.ingestion import ingestion_service
        try:
            result = await ingestion_service.ingest_all_stations(days=30)
            logger.info(
                f"Initial batch completed: {result.get('completed', 0)} stations, "
                f"{result.get('total_records', 0)} records"
            )
        except Exception as e:
            logger.error(f"Initial batch ingestion failed: {e}")
    else:
        logger.info(f"Found {station_count} stations in database")

    # Initialize and start the comprehensive scheduler
    logger.info("Initializing production scheduler...")
    scheduler_service.initialize()

    # Display scheduled jobs
    logger.info("Scheduled jobs:")
    for job in scheduler_service.get_jobs():
        logger.info(f"  - {job['name']}: {job['trigger']}")
        logger.info(f"    Next run: {job['next_run']}")

    logger.info("=" * 60)

    # Start the scheduler
    scheduler_service.start()
    logger.info("Scheduler started successfully")

    # Run initial hourly ingestion immediately
    logger.info("Running initial data ingestion...")
    try:
        await scheduler_service.trigger_hourly_ingest()
        logger.info("Initial ingestion completed")
    except Exception as e:
        logger.error(f"Initial ingestion failed: {e}")

    # Keep the service running
    try:
        logger.info("Scheduler service is now running. Press Ctrl+C to stop.")
        while True:
            await asyncio.sleep(60)
            # Optional: Log heartbeat every hour
            if asyncio.get_event_loop().time() % 3600 < 60:
                logger.debug("Scheduler heartbeat - service is running")
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Unexpected error in scheduler main loop: {e}")
    finally:
        logger.info("Shutting down scheduler...")
        scheduler_service.stop()
        logger.info("Scheduler stopped gracefully")


if __name__ == "__main__":
    asyncio.run(main())
