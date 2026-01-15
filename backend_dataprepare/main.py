"""
Data Preparation Microservice

A lightweight service for preparing raw CSV data from monitoring stations.
Isolated from main API to avoid caching issues with unformatted uploads.
"""

import os
import csv
import re
import io
import logging
from datetime import datetime as dt
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="AQI Data Preparation Service",
    description="Microservice for preparing raw CSV data from air quality monitoring stations",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Column mapping for raw CSVs
COLUMN_MAP = {
    'Date & Time': 'datetime',
    'PM10': 'pm10',
    'PM2.5': 'pm25',
    'CO': 'co',
    'NO': 'no',
    'NO2': 'no2',
    'NOX': 'nox',
    'SO2': 'so2',
    'O3': 'o3',
    'WS': 'ws',
    'WD': 'wd',
    'Temp': 'temp',
    'RH': 'rh',
    'BP': 'bp',
    'RAIN': 'rain'
}

OUTPUT_COLUMNS = [
    'station_id', 'datetime', 'pm10', 'pm25', 'co', 'no', 'no2', 'nox',
    'o3', 'so2', 'ws', 'wd', 'temp', 'rh', 'bp', 'rain'
]


def extract_station_id(header_line: str) -> str:
    """Extract station ID from header line"""
    match = re.search(r'Station:\s*(\w+)', header_line)
    return match.group(1) if match else 'UNKNOWN'


def parse_datetime(date_str: str) -> str:
    """Convert DD/MM/YYYY HH:MM to YYYY-MM-DD HH:MM:SS"""
    try:
        parsed = dt.strptime(date_str, '%d/%m/%Y %H:%M')
        return parsed.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return None


def clean_value(value: str) -> str:
    """Clean and validate numeric values"""
    if not value or value.strip() == '':
        return ''
    value = value.strip()
    if value in ['Calib', '<Samp', 'N/A', '-', 'NaN', 'nan']:
        return ''
    try:
        float(value)
        return value
    except:
        return ''


def decode_content(content: bytes) -> str:
    """Try multiple encodings to decode file content"""
    for encoding in ['utf-8-sig', 'utf-8', 'cp1252', 'iso-8859-1', 'tis-620']:
        try:
            return content.decode(encoding)
        except:
            continue
    raise ValueError("Could not decode file with any supported encoding")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "data-preparation",
        "version": "1.0.0"
    }


@app.post("/api/prepare-csv")
async def prepare_csv_data(file: UploadFile = File(...)):
    """
    Prepare raw monitoring station CSV data for upload.

    This endpoint cleans raw CSV exports from air quality monitoring stations:
    - Removes header/footer rows (station info, units, statistics)
    - Extracts station ID from header
    - Converts date format (DD/MM/YYYY HH:MM → YYYY-MM-DD HH:MM:SS)
    - Replaces invalid values (Calib, <Samp, N/A) with empty strings
    - Renames columns to system format

    Returns the cleaned CSV as a downloadable file.
    """
    try:
        content = await file.read()
        text_content = decode_content(content)
        lines = text_content.splitlines()

        if len(lines) < 5:
            raise HTTPException(
                status_code=400,
                detail="File too short. Expected monitoring station CSV format."
            )

        # Extract station ID from first line
        station_id = extract_station_id(lines[0])

        # Find header row (contains "Date & Time")
        header_row_idx = None
        for i, line in enumerate(lines):
            if 'Date & Time' in line or 'DateTime' in line:
                header_row_idx = i
                break

        if header_row_idx is None:
            raise HTTPException(
                status_code=400,
                detail="Could not find header row. Expected 'Date & Time' column."
            )

        # Parse header
        header_line = lines[header_row_idx]
        reader = csv.reader([header_line])
        header_cols = next(reader)

        # Skip units row (next line after header)
        data_start_idx = header_row_idx + 2

        output_data = []
        valid_count = 0
        skipped_count = 0
        issues = []

        for line_idx in range(data_start_idx, len(lines)):
            line = lines[line_idx].strip()

            if not line:
                continue

            # Stop at footer statistics
            if any(x in line for x in ['Minimum', 'Maximum', 'Avg,', 'Num,', 'Data[%]', 'STD,']):
                break

            try:
                reader = csv.reader([line])
                values = next(reader)
            except:
                skipped_count += 1
                continue

            if not values or len(values) < 1:
                skipped_count += 1
                continue

            # Parse datetime
            datetime_str = parse_datetime(values[0])
            if not datetime_str:
                skipped_count += 1
                if len(issues) < 5:
                    issues.append(f"Invalid date format at row {line_idx + 1}: {values[0][:30]}")
                continue

            row = {
                'station_id': station_id,
                'datetime': datetime_str
            }

            # Map columns
            for i, col_name in enumerate(header_cols):
                col_name = col_name.strip()
                if col_name in COLUMN_MAP:
                    mapped_name = COLUMN_MAP[col_name]
                    if mapped_name != 'datetime':
                        value = clean_value(values[i]) if i < len(values) else ''
                        row[mapped_name] = value

            output_data.append(row)
            valid_count += 1

        if valid_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No valid records found in file."
            )

        # Generate output CSV
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=OUTPUT_COLUMNS, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(output_data)

        csv_content = output.getvalue()
        output.close()

        # Return as downloadable file with processing stats in headers
        filename = f"{station_id}_prepared.csv"

        logger.info(f"Prepared CSV: {station_id}, {valid_count} valid, {skipped_count} skipped")

        response = StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Station-Id": station_id,
                "X-Valid-Records": str(valid_count),
                "X-Skipped-Records": str(skipped_count),
                "X-Issues": "; ".join(issues) if issues else "None",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error preparing CSV data: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/prepare-csv/preview")
async def preview_prepared_csv(file: UploadFile = File(...)):
    """
    Preview raw CSV preparation without downloading.
    Returns processing statistics and sample of cleaned data.
    """
    try:
        content = await file.read()
        text_content = decode_content(content)
        lines = text_content.splitlines()

        if len(lines) < 5:
            raise HTTPException(status_code=400, detail="File too short.")

        station_id = extract_station_id(lines[0])

        header_row_idx = None
        for i, line in enumerate(lines):
            if 'Date & Time' in line or 'DateTime' in line:
                header_row_idx = i
                break

        if header_row_idx is None:
            raise HTTPException(status_code=400, detail="Could not find header row.")

        header_line = lines[header_row_idx]
        reader = csv.reader([header_line])
        header_cols = next(reader)

        data_start_idx = header_row_idx + 2

        output_data = []
        valid_count = 0
        skipped_count = 0
        issues = []
        calib_count = 0
        samp_count = 0

        for line_idx in range(data_start_idx, len(lines)):
            line = lines[line_idx].strip()

            if not line:
                continue

            if any(x in line for x in ['Minimum', 'Maximum', 'Avg,', 'Num,', 'Data[%]', 'STD,']):
                break

            # Count special values
            if 'Calib' in line:
                calib_count += line.count('Calib')
            if '<Samp' in line:
                samp_count += line.count('<Samp')

            try:
                reader = csv.reader([line])
                values = next(reader)
            except:
                skipped_count += 1
                continue

            if not values or len(values) < 1:
                skipped_count += 1
                continue

            datetime_str = parse_datetime(values[0])
            if not datetime_str:
                skipped_count += 1
                if len(issues) < 5:
                    issues.append(f"Invalid date: {values[0][:20]}")
                continue

            row = {'station_id': station_id, 'datetime': datetime_str}

            for i, col_name in enumerate(header_cols):
                col_name = col_name.strip()
                if col_name in COLUMN_MAP:
                    mapped_name = COLUMN_MAP[col_name]
                    if mapped_name != 'datetime':
                        value = clean_value(values[i]) if i < len(values) else ''
                        row[mapped_name] = value

            output_data.append(row)
            valid_count += 1

        # Get date range
        first_date = output_data[0]['datetime'] if output_data else None
        last_date = output_data[-1]['datetime'] if output_data else None

        logger.info(f"Preview: {station_id}, {valid_count} valid, {skipped_count} skipped")

        return {
            "success": valid_count > 0,
            "station_id": station_id,
            "statistics": {
                "valid_records": valid_count,
                "skipped_records": skipped_count,
                "calib_values_replaced": calib_count,
                "samp_values_replaced": samp_count,
                "total_special_values_cleaned": calib_count + samp_count
            },
            "date_range": {
                "start": first_date,
                "end": last_date
            },
            "sample_data": output_data[:5],
            "issues": issues,
            "columns": OUTPUT_COLUMNS
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing CSV preparation: {e}")
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
