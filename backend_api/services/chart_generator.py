"""
Chart Generation Service for LINE Bot

Generates matplotlib charts for time series data to be sent via LINE.
"""

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server use

import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.figure import Figure
from datetime import datetime
from typing import List, Dict, Any, Optional
import io
import base64
from backend_model.logger import logger


# AQI Color bands for PM2.5 (Thailand PCD Standard)
AQI_COLORS = {
    "excellent": "#00BFFF",      # Blue (0-25 - ดีมาก)
    "good": "#00E400",           # Green (26-50 - ดี)
    "moderate": "#FFFF00",       # Yellow (51-100 - ปานกลาง)
    "unhealthy_sensitive": "#FF7E00",  # Orange (101-200 - เริ่มมีผลกระทบ)
    "unhealthy": "#FF0000",      # Red (201-300 - มีผลกระทบ)
    "hazardous": "#7E0023"       # Dark Red (>300 - อันตราย)
}

PM25_THRESHOLDS = [
    (25, "excellent", "#00BFFF"),      # Blue
    (50, "good", "#00E400"),           # Green
    (100, "moderate", "#FFFF00"),      # Yellow
    (200, "unhealthy_sensitive", "#FF7E00"),  # Orange
    (300, "unhealthy", "#FF0000"),     # Red
    (float('inf'), "hazardous", "#7E0023")    # Dark Red
]



def get_color_for_value(value: float) -> str:
    """Get color based on PM2.5 value"""
    for threshold, _, color in PM25_THRESHOLDS:
        if value <= threshold:
            return color
    return "#8f3f97"


def generate_timeseries_chart(
    data: List[Dict[str, Any]],
    station_id: str,
    pollutant: str = "pm25",
    title: Optional[str] = None,
    language: str = "th"
) -> Optional[bytes]:
    """
    Generate a time series chart as PNG bytes
    
    Args:
        data: List of data points with 'datetime' and 'value' keys
        station_id: Station identifier for title
        pollutant: Pollutant type (pm25, pm10, etc.)
        title: Custom title (optional)
        language: Language for labels (th/en)
        
    Returns:
        PNG image as bytes, or None on error
    """
    if not data or len(data) < 2:
        logger.warning("Insufficient data for chart generation")
        return None
    
    try:
        # Parse data
        timestamps = []
        values = []
        colors = []
        
        for point in data:
            dt_str = point.get("datetime") or point.get("timestamp")
            val = point.get("value") or point.get(pollutant)
            
            if dt_str and val is not None:
                if isinstance(dt_str, str):
                    dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
                else:
                    dt = dt_str
                timestamps.append(dt)
                values.append(float(val))
                colors.append(get_color_for_value(float(val)))
        
        if len(timestamps) < 2:
            logger.warning("Not enough valid data points for chart")
            return None
        
        # Sort by time
        sorted_data = sorted(zip(timestamps, values, colors), key=lambda x: x[0])
        timestamps, values, colors = zip(*sorted_data)
        
        # Create figure
        fig, ax = plt.subplots(figsize=(10, 5), dpi=100)
        
        # Plot line
        ax.plot(timestamps, values, color='#1976d2', linewidth=2, marker='o', markersize=4)
        
        # Fill background with AQI color bands
        ax.axhspan(0, 25, alpha=0.2, color='#00e400', label='Excellent')
        ax.axhspan(25, 50, alpha=0.2, color='#92d050', label='Good')
        ax.axhspan(50, 100, alpha=0.2, color='#ffff00', label='Moderate')
        ax.axhspan(100, 200, alpha=0.2, color='#ff7e00', label='Unhealthy (Sensitive)')
        
        max_val = max(values)
        if max_val > 200:
            ax.axhspan(200, 300, alpha=0.2, color='#ff0000', label='Unhealthy')
        if max_val > 300:
            ax.axhspan(300, max_val + 50, alpha=0.2, color='#8f3f97', label='Hazardous')
        
        # Add Thailand standard line
        ax.axhline(y=50, color='red', linestyle='--', linewidth=1.5, alpha=0.7, label='TH Standard (50 μg/m³)')
        
        # Labels and title
        pollutant_labels = {
            "pm25": "PM2.5 (μg/m³)",
            "pm10": "PM10 (μg/m³)",
            "o3": "O₃ (ppb)",
            "co": "CO (ppm)",
            "no2": "NO₂ (ppb)",
            "so2": "SO₂ (ppb)"
        }
        
        if title:
            chart_title = title
        elif language == "th":
            chart_title = f"📊 กราฟ {pollutant.upper()} สถานี {station_id}"
        else:
            chart_title = f"📊 {pollutant.upper()} Chart for Station {station_id}"
        
        ax.set_title(chart_title, fontsize=14, fontweight='bold', pad=10)
        ax.set_xlabel("Date/Time" if language == "en" else "วันที่/เวลา", fontsize=11)
        ax.set_ylabel(pollutant_labels.get(pollutant, pollutant), fontsize=11)
        
        # Format x-axis
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
        ax.xaxis.set_major_locator(mdates.AutoDateLocator())
        plt.xticks(rotation=45, ha='right')
        
        # Grid
        ax.grid(True, alpha=0.3)
        ax.set_ylim(bottom=0)
        
        # Add statistics text
        mean_val = sum(values) / len(values)
        stats_text = f"Avg: {mean_val:.1f} | Max: {max(values):.1f} | Min: {min(values):.1f}"
        ax.text(0.02, 0.98, stats_text, transform=ax.transAxes, fontsize=9,
                verticalalignment='top', bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
        
        # Tight layout
        plt.tight_layout()
        
        # Save to bytes
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=100)
        buf.seek(0)
        image_bytes = buf.getvalue()
        
        plt.close(fig)
        
        logger.info(f"Generated chart for {station_id} with {len(values)} data points")
        return image_bytes
        
    except Exception as e:
        logger.error(f"Error generating chart: {e}")
        return None


def generate_chart_base64(
    data: List[Dict[str, Any]],
    station_id: str,
    pollutant: str = "pm25",
    language: str = "th"
) -> Optional[str]:
    """
    Generate chart and return as base64 string
    """
    image_bytes = generate_timeseries_chart(data, station_id, pollutant, language=language)
    if image_bytes:
        return base64.b64encode(image_bytes).decode('utf-8')
    return None
