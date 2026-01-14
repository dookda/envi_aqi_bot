#!/usr/bin/env python3
"""
Script to prepare Roi Et (ร้อยเอ็ด) station data for upload to AQI system

Usage:
    python prepare_roiet_data.py input.csv output.csv

Input format: Raw export from monitoring station
Output format: Clean CSV ready for upload
"""

import sys
import csv
import re
from datetime import datetime
from pathlib import Path


def extract_station_id(header_line):
    """Extract station ID from header like 'Station: 1RET1001'"""
    match = re.search(r'Station:\s*(\w+)', header_line)
    return match.group(1) if match else 'UNKNOWN'


def parse_datetime(date_str):
    """Convert DD/MM/YYYY HH:MM to YYYY-MM-DD HH:MM:SS"""
    try:
        dt = datetime.strptime(date_str, '%d/%m/%Y %H:%M')
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return None


def is_numeric_value(value):
    """Check if value is numeric (not Calib, <Samp, etc.)"""
    if not value or value.strip() == '':
        return False
    value = value.strip()
    if value in ['Calib', '<Samp', 'N/A', '-', '']:
        return False
    try:
        float(value)
        return True
    except:
        return False


def clean_value(value):
    """Clean value - return empty string for invalid values, otherwise return value"""
    if not value or value.strip() == '':
        return ''

    value = value.strip()

    # Replace special values with empty
    if value in ['Calib', '<Samp', 'N/A', '-']:
        return ''

    # Try to convert to float to validate
    try:
        float(value)
        return value
    except:
        return ''


def prepare_roiet_data(input_file, output_file):
    """
    Prepare Roi Et station data for upload

    Args:
        input_file: Path to raw CSV file
        output_file: Path to cleaned CSV file
    """
    print(f"Reading: {input_file}")

    with open(input_file, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()

    # Extract station ID from first line
    station_id = extract_station_id(lines[0])
    print(f"Station ID: {station_id}")

    # Find the header row (contains "Date & Time")
    header_row_idx = None
    for i, line in enumerate(lines):
        if 'Date & Time' in line or 'DateTime' in line:
            header_row_idx = i
            break

    if header_row_idx is None:
        print("ERROR: Could not find header row")
        return

    print(f"Found header at row {header_row_idx + 1}")

    # Parse header
    header_line = lines[header_row_idx]

    # Skip units row (next line after header)
    data_start_idx = header_row_idx + 2

    # Column mapping to system format
    column_map = {
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

    # Prepare output
    output_data = []
    output_columns = ['station_id', 'datetime', 'pm10', 'pm25', 'co', 'no', 'no2',
                      'o3', 'so2', 'ws', 'wd', 'temp', 'rh', 'bp', 'rain']

    # Parse data rows
    valid_count = 0
    skipped_count = 0

    reader = csv.reader([header_line])
    header_cols = next(reader)

    for line_idx in range(data_start_idx, len(lines)):
        line = lines[line_idx].strip()

        # Skip empty lines
        if not line:
            continue

        # Stop at footer (Minimum, Maximum, Avg, etc.)
        if any(x in line for x in ['Minimum', 'Maximum', 'Avg,', 'Num,', 'Data[%]', 'STD,']):
            print(f"Reached footer at line {line_idx + 1}, stopping")
            break

        # Parse CSV row
        try:
            reader = csv.reader([line])
            values = next(reader)
        except:
            skipped_count += 1
            continue

        # Must have datetime
        if not values or len(values) < 1:
            skipped_count += 1
            continue

        # Parse datetime
        datetime_str = parse_datetime(values[0])
        if not datetime_str:
            skipped_count += 1
            continue

        # Create row with cleaned values
        row = {
            'station_id': station_id,
            'datetime': datetime_str
        }

        # Map columns
        for i, col_name in enumerate(header_cols):
            col_name = col_name.strip()
            if col_name in column_map:
                mapped_name = column_map[col_name]
                if mapped_name != 'datetime':  # datetime already handled
                    value = clean_value(values[i]) if i < len(values) else ''
                    row[mapped_name] = value

        output_data.append(row)
        valid_count += 1

    print(f"\nProcessed:")
    print(f"  Valid records: {valid_count}")
    print(f"  Skipped: {skipped_count}")

    # Write output
    print(f"\nWriting to: {output_file}")
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=output_columns)
        writer.writeheader()
        writer.writerows(output_data)

    print(f"✅ Done! Ready to upload: {output_file}")
    print(f"\nNext steps:")
    print(f"1. Check training readiness: GET /api/model/{station_id}/training-readiness")
    print(f"2. Upload file: POST /api/upload/import-csv")
    print(f"3. Impute gaps: POST /api/impute (use method='auto' for new station)")


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python prepare_roiet_data.py <input.csv> <output.csv>")
        print("\nExample:")
        print("  python prepare_roiet_data.py roiet.csv roiet_clean.csv")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    if not Path(input_file).exists():
        print(f"ERROR: Input file not found: {input_file}")
        sys.exit(1)

    prepare_roiet_data(input_file, output_file)
