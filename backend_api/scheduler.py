"""
Scheduler Service Entry Point

This is the main entry point for the production scheduler service.
It uses the comprehensive scheduler from backend_api.services.scheduler
which includes:
- Auto-initialization: Downloads 30-day historical data on first startup
- Auto-training: Trains all LSTM models automatically on first startup
- Hourly data ingestion (XX:05)
- Gap imputation every 6 hours (00:30, 06:30, 12:30, 18:30)
- Daily quality checks (02:00)
- Weekly model retraining (Sunday 03:00)
- Daily station metadata sync (01:00)
"""

import sys
import asyncio
from backend_model.logger import logger
from backend_model.database import check_database_connection
from backend_api.services.scheduler import scheduler_service


async def main():
    """Main entry point for production scheduler service"""
    logger.info("Starting AQI Production Scheduler Service")
    logger.info("=" * 60)

    # Wait for database to be ready with exponential backoff
    logger.info("Waiting for database connection...")
    max_retries = 30
    for i in range(max_retries):
        if check_database_connection():
            logger.info("Database connection established")
            break
        # Exponential backoff: 2, 4, 8, 16, 32, 32, 32... seconds (max 32s)
        wait_time = min(2 ** i, 32)
        logger.warning(f"Database not ready, retrying in {wait_time}s... ({i+1}/{max_retries})")
        await asyncio.sleep(wait_time)
    else:
        logger.critical("Database connection failed after maximum retries. Exiting.")
        logger.critical("Docker will restart this service automatically.")
        sys.exit(1)  # Exit with error code to trigger Docker restart

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

    logger.info("=" * 60)

    # Start the scheduler
    scheduler_service.start()
    logger.info("Scheduler started successfully")

    # Display scheduled jobs (after scheduler is started so next_run_time is calculated)
    logger.info("Scheduled jobs:")
    for job in scheduler_service.get_jobs():
        logger.info(f"  - {job['name']}: {job['trigger']}")
        logger.info(f"    Next run: {job['next_run']}")

    # Run initial hourly ingestion immediately
    logger.info("Running initial data ingestion...")
    try:
        await scheduler_service.trigger_hourly_ingest()
        logger.info("Initial ingestion completed")
    except Exception as e:
        logger.error(f"Initial ingestion failed: {e}")

    # Check if LSTM models need to be trained on first startup
    logger.info("Checking if LSTM models need initial training...")
    try:
        from backend_model.services.lstm_model import lstm_model_service
        from backend_model.models import Station

        with get_db_context() as db:
            stations = db.query(Station).all()
            total_stations = len(stations)

            if total_stations > 0:
                # Check how many models already exist
                existing_models = sum(1 for s in stations if lstm_model_service.model_exists(s.station_id))

                if existing_models == 0:
                    logger.info(f"No LSTM models found. Training models for {total_stations} stations...")
                    logger.info("This may take 10-30 minutes depending on data size.")

                    trained_count = 0
                    failed_count = 0

                    for i, station in enumerate(stations, 1):
                        try:
                            logger.info(f"Training model {i}/{total_stations}: {station.station_id} ({station.name_en})")
                            result = lstm_model_service.train_model(
                                station_id=station.station_id,
                                force_retrain=False
                            )

                            if result and result.get("status") == "completed":
                                trained_count += 1
                                accuracy = result.get("accuracy_percent", 0)
                                logger.info(f"  ✓ Model trained: {accuracy}% accuracy (R²)")
                            else:
                                failed_count += 1
                                reason = result.get("reason", "unknown") if result else "no result"
                                logger.warning(f"  ✗ Training skipped/failed: {reason}")

                        except Exception as e:
                            failed_count += 1
                            logger.error(f"  ✗ Training failed for {station.station_id}: {e}")

                    logger.info("=" * 60)
                    logger.info(f"Initial model training completed:")
                    logger.info(f"  - Trained: {trained_count}/{total_stations}")
                    logger.info(f"  - Failed/Skipped: {failed_count}/{total_stations}")
                    logger.info("=" * 60)

                elif existing_models < total_stations:
                    logger.info(f"Found {existing_models}/{total_stations} models. Missing models will be trained weekly.")
                else:
                    logger.info(f"All {total_stations} LSTM models already exist. Skipping initial training.")
            else:
                logger.warning("No stations found. Skipping model training.")

    except Exception as e:
        logger.error(f"Initial model training check failed: {e}")

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
