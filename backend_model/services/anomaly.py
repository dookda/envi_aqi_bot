"""
Anomaly Detection Service

Detects anomalies in PM2.5 data using:
- Statistical methods (Z-score, IQR)
- Threshold-based detection
- Rate of change detection
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import numpy as np
from sqlalchemy import text

from backend_model.config import settings
from backend_model.logger import logger
from backend_model.database import get_db_context


class AnomalyDetectionService:
    """
    Service for detecting anomalies in PM2.5 data
    """
    
    def __init__(self):
        # Z-score threshold for statistical anomalies
        self.z_score_threshold = 3.0
        
        # IQR multiplier for outlier detection
        self.iqr_multiplier = 1.5
        
        # PM2.5 thresholds (Thailand AQI standards)
        self.thresholds = {
            "excellent": 25,
            "good": 50,
            "moderate": 100,
            "unhealthy_sensitive": 200,
            "unhealthy": 300,
            "hazardous": 500,
        }
        
        # Rate of change threshold (μg/m³ per hour)
        self.rate_threshold = 30
    
    def detect_anomalies(
        self,
        station_id: str,
        start_datetime: Optional[datetime] = None,
        end_datetime: Optional[datetime] = None,
        method: str = "all"
    ) -> Dict[str, Any]:
        """
        Detect anomalies in PM2.5 data for a station
        
        Args:
            station_id: Station identifier
            start_datetime: Start of analysis period
            end_datetime: End of analysis period
            method: Detection method ('statistical', 'threshold', 'rate', 'all')
            
        Returns:
            Dictionary with anomaly detection results
        """
        if end_datetime is None:
            end_datetime = datetime.now()
        if start_datetime is None:
            start_datetime = end_datetime - timedelta(days=7)
        
        logger.info(f"Detecting anomalies for {station_id} from {start_datetime} to {end_datetime}")
        
        with get_db_context() as db:
            # Fetch data
            result = db.execute(text("""
                SELECT datetime, pm25, is_imputed
                FROM aqi_hourly
                WHERE station_id = :station_id
                AND datetime >= :start
                AND datetime <= :end
                AND pm25 IS NOT NULL
                ORDER BY datetime
            """), {
                "station_id": station_id,
                "start": start_datetime,
                "end": end_datetime
            })
            
            data = list(result)
        
        if not data:
            return {
                "station_id": station_id,
                "period": {
                    "start": start_datetime.isoformat(),
                    "end": end_datetime.isoformat()
                },
                "anomalies": [],
                "summary": {
                    "total_points": 0,
                    "anomaly_count": 0,
                    "anomaly_types": {}
                }
            }
        
        # Extract values
        timestamps = [row[0] for row in data]
        values = np.array([row[1] for row in data])
        is_imputed = [row[2] for row in data]
        
        anomalies = []
        
        # Statistical anomalies (Z-score)
        if method in ("statistical", "all"):
            stat_anomalies = self._detect_statistical_anomalies(timestamps, values)
            anomalies.extend(stat_anomalies)
        
        # Threshold anomalies
        if method in ("threshold", "all"):
            threshold_anomalies = self._detect_threshold_anomalies(timestamps, values)
            anomalies.extend(threshold_anomalies)
        
        # Rate of change anomalies
        if method in ("rate", "all"):
            rate_anomalies = self._detect_rate_anomalies(timestamps, values)
            anomalies.extend(rate_anomalies)

        # 5x Spike anomalies (User defined: "spike is value that jumps 5 times")
        if method in ("spike", "all"):
            spike_anomalies = self._detect_spike_anomalies(timestamps, values)
            anomalies.extend(spike_anomalies)

        
        # Deduplicate and sort
        seen = set()
        unique_anomalies = []
        for a in anomalies:
            key = (a["datetime"], a["type"])
            if key not in seen:
                seen.add(key)
                unique_anomalies.append(a)
        
        unique_anomalies.sort(key=lambda x: x["datetime"])
        
        # Count by type
        type_counts = {}
        for a in unique_anomalies:
            t = a["type"]
            type_counts[t] = type_counts.get(t, 0) + 1
        
        return {
            "station_id": station_id,
            "period": {
                "start": start_datetime.isoformat(),
                "end": end_datetime.isoformat()
            },
            "anomalies": unique_anomalies,
            "summary": {
                "total_points": len(values),
                "anomaly_count": len(unique_anomalies),
                "anomaly_rate": round(len(unique_anomalies) / len(values) * 100, 2) if values.size else 0,
                "anomaly_types": type_counts,
                "mean_pm25": round(float(np.mean(values)), 2),
                "std_pm25": round(float(np.std(values)), 2),
                "max_pm25": round(float(np.max(values)), 2),
                "min_pm25": round(float(np.min(values)), 2),
            }
        }
    
    def _detect_statistical_anomalies(
        self,
        timestamps: List[datetime],
        values: np.ndarray
    ) -> List[Dict[str, Any]]:
        """Detect anomalies using Z-score method"""
        anomalies = []
        
        if len(values) < 3:
            return anomalies
        
        mean = np.mean(values)
        std = np.std(values)
        
        if std == 0:
            return anomalies
        
        z_scores = (values - mean) / std
        
        for i, z in enumerate(z_scores):
            if abs(z) > self.z_score_threshold:
                anomalies.append({
                    "datetime": timestamps[i].isoformat(),
                    "value": round(float(values[i]), 2),
                    "type": "statistical",
                    "severity": "high" if abs(z) > 4 else "medium",
                    "details": {
                        "z_score": round(float(z), 2),
                        "deviation_from_mean": round(float(values[i] - mean), 2)
                    }
                })
        
        return anomalies
    
    def _detect_threshold_anomalies(
        self,
        timestamps: List[datetime],
        values: np.ndarray
    ) -> List[Dict[str, Any]]:
        """Detect anomalies based on AQI thresholds"""
        anomalies = []
        
        for i, v in enumerate(values):
            severity = None
            level = None
            
            if v > self.thresholds["hazardous"]:
                severity = "critical"
                level = "hazardous"
            elif v > self.thresholds["unhealthy"]:
                severity = "high"
                level = "very_unhealthy"
            elif v > self.thresholds["unhealthy_sensitive"]:
                severity = "medium"
                level = "unhealthy"
            
            if severity:
                anomalies.append({
                    "datetime": timestamps[i].isoformat(),
                    "value": round(float(v), 2),
                    "type": "threshold",
                    "severity": severity,
                    "details": {
                        "aqi_level": level,
                        "threshold_exceeded": self.thresholds.get(
                            "unhealthy_sensitive" if level == "unhealthy" else 
                            "unhealthy" if level == "very_unhealthy" else "hazardous"
                        )
                    }
                })
        
        return anomalies
    
    def _detect_rate_anomalies(
        self,
        timestamps: List[datetime],
        values: np.ndarray
    ) -> List[Dict[str, Any]]:
        """Detect anomalies based on sudden rate of change"""
        anomalies = []
        
        if len(values) < 2:
            return anomalies
        
        for i in range(1, len(values)):
            time_diff = (timestamps[i] - timestamps[i-1]).total_seconds() / 3600
            if time_diff == 0:
                continue
            
            rate = abs(values[i] - values[i-1]) / time_diff
            
            if rate > self.rate_threshold:
                direction = "spike" if values[i] > values[i-1] else "drop"
                anomalies.append({
                    "datetime": timestamps[i].isoformat(),
                    "value": round(float(values[i]), 2),
                    "type": "rate_change",
                    "severity": "high" if rate > self.rate_threshold * 2 else "medium",
                    "details": {
                        "rate": round(float(rate), 2),
                        "direction": direction,
                        "previous_value": round(float(values[i-1]), 2)
                    }
                })
        
        return anomalies
    
    
    def _detect_spike_anomalies(
        self,
        timestamps: List[datetime],
        values: np.ndarray
    ) -> List[Dict[str, Any]]:
        """
        Detect anomalies based on "5x jump" rule
        Definition: Current value is >= 5 times the previous value
        """
        anomalies = []
        
        if len(values) < 2:
            return anomalies
        
        for i in range(1, len(values)):
            prev_val = values[i-1]
            curr_val = values[i]
            
            # Avoid division by zero or trivial jumps from very low values
            # We use a minimum base of 1.0 to check for 5x meaningful jump
            # e.g. 0.1 -> 0.6 is 6x but essentially noise. 10 -> 50 is real.
            base_val = max(float(prev_val), 1.0)
            
            if curr_val >= base_val * 5:
                ratio = curr_val / base_val
                anomalies.append({
                    "datetime": timestamps[i].isoformat(),
                    "value": round(float(curr_val), 2),
                    "type": "spike_5x",
                    "severity": "critical",
                    "details": {
                        "ratio": round(float(ratio), 1),
                        "previous_value": round(float(prev_val), 2),
                        "message": "Value jumped >= 5 times (User Rule)"
                    }
                })
        
        return anomalies

    def get_chart_data_with_anomalies(
        self,
        station_id: str,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Get chart data with anomaly flags for visualization
        """
        end_datetime = datetime.now()
        start_datetime = end_datetime - timedelta(days=days)
        
        # Get anomalies
        anomaly_result = self.detect_anomalies(
            station_id, 
            start_datetime, 
            end_datetime
        )
        
        # Create a set of anomaly timestamps for quick lookup
        anomaly_map = {}
        for a in anomaly_result["anomalies"]:
            dt = a["datetime"]
            if dt not in anomaly_map:
                anomaly_map[dt] = []
            anomaly_map[dt].append({
                "type": a["type"],
                "severity": a["severity"]
            })
        
        return {
            "anomalies": anomaly_result["anomalies"],
            "anomaly_timestamps": list(anomaly_map.keys()),
            "anomaly_map": anomaly_map,
            "summary": anomaly_result["summary"]
        }

    def analyze_and_flag_data(self, station_id: str, hours: int = 24) -> int:
        """
        Analyze recent data key, persist flags to DB, and send notifications.
        (TOR 16.2 & 16.5)
        """
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)
        
        # Detect anomalies using existing logic
        result = self.detect_anomalies(station_id, start_time, end_time)
        anomalies = result.get("anomalies", [])
        
        if not anomalies:
            return 0
            
        updated_count = 0
        
        # Delayed import to avoid circular dependency
        from backend_api.services.notification import NotificationService
        from backend_model.models import AQIHourly
        
        with get_db_context() as db:
            for anomaly in anomalies:
                # 1. Update DB Flags (TOR 16.2)
                timestamp = datetime.fromisoformat(anomaly["datetime"])
                
                record = db.query(AQIHourly).filter(
                    AQIHourly.station_id == station_id,
                    AQIHourly.datetime == timestamp
                ).first()
                
                if record and not record.is_anomaly:
                    record.is_anomaly = True
                    record.anomaly_type = anomaly["type"]
                    updated_count += 1
                    
                    # 2. Send Notification (TOR 16.5)
                    # Only notify for severe anomalies to prevent spam
                    if anomaly.get("severity") in ["high", "critical"]:
                         NotificationService.create_notification(
                             title=f"⚠️ {anomaly.get('severity').title()} Anomaly at {station_id}",
                             message=f"Type: {anomaly['type']}. Value: {anomaly['value']}. {anomaly.get('details', {}).get('message', '')}",
                             type="warning" if anomaly['severity'] == "high" else "critical",
                             station_id=station_id
                         )
            
            db.commit()
            logger.info(f"Flagged {updated_count} anomalies for station {station_id}")
            
        return updated_count


# Singleton instance
anomaly_service = AnomalyDetectionService()
