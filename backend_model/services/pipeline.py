"""
Pipeline Service for Orchestrating Data Collection and Imputation

Provides high-level orchestration for:
- Full pipeline execution (ingest + impute)
- Imputation-only runs
- Data quality monitoring
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from backend_model.logger import logger
from backend_model.database import get_db_context
from backend_model.models import Station, AQIHourly
from backend_api.services.ingestion import ingestion_service
from backend_model.services.imputation import imputation_service


class PipelineService:
    """
    High-level orchestration service for data pipeline operations
    """
    
    async def run_full_pipeline(self) -> Dict[str, Any]:
        """
        Run the complete pipeline:
        1. Ingest latest data from Air4Thai
        2. Detect gaps
        3. Run LSTM imputation
        
        Returns:
            Summary of pipeline execution
        """
        logger.info("Starting full pipeline execution")
        start_time = datetime.now()
        
        results = {
            "started_at": start_time.isoformat(),
            "ingestion": {},
            "imputation": {},
            "status": "running"
        }
        
        try:
            # Step 1: Ingest latest data
            logger.info("Pipeline Step 1: Ingesting latest data")
            ingest_result = await ingestion_service.ingest_hourly_update()
            results["ingestion"] = ingest_result
            
            # Step 2: Run imputation
            logger.info("Pipeline Step 2: Running LSTM imputation")
            impute_result = await self.run_imputation_only()
            results["imputation"] = impute_result
            
            results["status"] = "completed"
            results["completed_at"] = datetime.now().isoformat()
            results["duration_seconds"] = (datetime.now() - start_time).total_seconds()
            
            logger.info(f"Full pipeline completed in {results['duration_seconds']:.1f}s")
            
        except Exception as e:
            results["status"] = "failed"
            results["error"] = str(e)
            results["completed_at"] = datetime.now().isoformat()
            logger.error(f"Pipeline failed: {e}")
        
        return results
    
    async def run_imputation_only(self) -> Dict[str, Any]:
        """
        Run LSTM imputation for all stations with gaps
        
        Returns:
            Summary of imputation results
        """
        logger.info("Starting imputation-only run")
        start_time = datetime.now()
        
        results = {
            "started_at": start_time.isoformat(),
            "stations_processed": 0,
            "total_imputed": 0,
            "stations_with_gaps": [],
            "status": "running"
        }
        
        try:
            # Get all stations
            with get_db_context() as db:
                stations = db.query(Station).all()
                station_ids = [s.station_id for s in stations]
            
            total_imputed = 0
            stations_with_gaps = []
            
            for station_id in station_ids:
                try:
                    # Run imputation for this station
                    imputed_count = await imputation_service.impute_station_gaps(station_id)
                    
                    if imputed_count > 0:
                        total_imputed += imputed_count
                        stations_with_gaps.append({
                            "station_id": station_id,
                            "imputed_count": imputed_count
                        })
                        
                except Exception as e:
                    logger.warning(f"Imputation failed for station {station_id}: {e}")
            
            results["stations_processed"] = len(station_ids)
            results["total_imputed"] = total_imputed
            results["stations_with_gaps"] = stations_with_gaps
            results["status"] = "completed"
            results["completed_at"] = datetime.now().isoformat()
            results["duration_seconds"] = (datetime.now() - start_time).total_seconds()
            
            logger.info(
                f"Imputation completed: {total_imputed} values imputed "
                f"across {len(stations_with_gaps)} stations in {results['duration_seconds']:.1f}s"
            )
            
        except Exception as e:
            results["status"] = "failed"
            results["error"] = str(e)
            results["completed_at"] = datetime.now().isoformat()
            logger.error(f"Imputation run failed: {e}")
        
        return results
    
    async def get_data_quality_summary(self) -> Dict[str, Any]:
        """
        Get summary of data quality across all stations
        
        Returns:
            Data quality metrics
        """
        from sqlalchemy import text
        
        with get_db_context() as db:
            # Overall stats for last 24 hours
            result = db.execute(text("""
                SELECT 
                    COUNT(*) as total_records,
                    COUNT(*) FILTER (WHERE pm25 IS NULL AND is_imputed = FALSE) as raw_gaps,
                    COUNT(*) FILTER (WHERE pm25 IS NOT NULL) as filled_records,
                    COUNT(*) FILTER (WHERE is_imputed = TRUE) as imputed_records,
                    COUNT(DISTINCT station_id) as active_stations
                FROM aqi_hourly
                WHERE datetime >= NOW() - INTERVAL '24 hours'
            """)).fetchone()
            
            # Station-level breakdown
            station_stats = db.execute(text("""
                SELECT 
                    station_id,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE pm25 IS NULL AND is_imputed = FALSE) as gaps,
                    COUNT(*) FILTER (WHERE is_imputed = TRUE) as imputed
                FROM aqi_hourly
                WHERE datetime >= NOW() - INTERVAL '24 hours'
                GROUP BY station_id
                HAVING COUNT(*) FILTER (WHERE pm25 IS NULL AND is_imputed = FALSE) > 0
                ORDER BY gaps DESC
                LIMIT 10
            """)).fetchall()
            
            stations_with_gaps = [
                {
                    "station_id": row[0],
                    "total_records": row[1],
                    "gaps": row[2],
                    "imputed": row[3]
                }
                for row in station_stats
            ]
        
        total = result[0] if result[0] else 0
        filled = result[2] if result[2] else 0
        
        return {
            "period": "last_24_hours",
            "total_records": total,
            "raw_gaps": result[1] or 0,
            "filled_records": filled,
            "imputed_records": result[3] or 0,
            "active_stations": result[4] or 0,
            "completeness_rate": round((filled / total * 100) if total > 0 else 0, 2),
            "stations_with_most_gaps": stations_with_gaps
        }


# Singleton instance
pipeline_service = PipelineService()
