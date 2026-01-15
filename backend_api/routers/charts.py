"""
Chart API Router

Endpoints for generating and serving charts for LINE bot.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from datetime import datetime, timedelta
from typing import Optional
from backend_api.services.chart_generator import generate_timeseries_chart
from backend_api.services.ai.orchestrator import get_api_orchestrator
from backend_model.logger import logger

router = APIRouter(prefix="/api/charts", tags=["Charts"])


@router.get("/timeseries/{station_id}")
async def get_timeseries_chart(
    station_id: str,
    pollutant: str = Query(default="pm25", description="Pollutant type"),
    days: int = Query(default=7, ge=1, le=30, description="Number of days"),
    lang: str = Query(default="th", description="Language (th/en)")
):
    """
    Generate and return a time series chart as PNG image
    
    This endpoint can be used as an image URL for LINE messages.
    """
    try:
        # Get data from orchestrator
        orchestrator = get_api_orchestrator()
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        data = await orchestrator.get_aqi_history(
            station_id=station_id,
            pollutant=pollutant,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            interval="hour"
        )
        
        if not data:
            raise HTTPException(status_code=404, detail="No data available for this station")
        
        # Generate chart
        chart_bytes = generate_timeseries_chart(
            data=data,
            station_id=station_id,
            pollutant=pollutant,
            language=lang
        )
        
        if not chart_bytes:
            raise HTTPException(status_code=500, detail="Failed to generate chart")
        
        return Response(
            content=chart_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": f"inline; filename=chart_{station_id}_{pollutant}.png",
                "Cache-Control": "public, max-age=300"  # Cache for 5 minutes
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating chart: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/preview/{station_id}")
async def preview_chart(
    station_id: str,
    pollutant: str = "pm25",
    days: int = 7
):
    """
    Preview endpoint that returns chart info (for debugging)
    """
    orchestrator = get_api_orchestrator()
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    data = await orchestrator.get_aqi_history(
        station_id=station_id,
        pollutant=pollutant,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        interval="hour"
    )
    
    return {
        "station_id": station_id,
        "pollutant": pollutant,
        "data_points": len(data) if data else 0,
        "chart_url": f"/api/charts/timeseries/{station_id}?pollutant={pollutant}&days={days}",
        "sample_data": data[:5] if data else []
    }
