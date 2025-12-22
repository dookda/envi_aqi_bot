FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend_model/ ./backend_model/
COPY backend_api/ ./backend_api/
COPY alembic/ ./alembic/
COPY alembic.ini .

# Create directories for models and logs
RUN mkdir -p /app/models /app/logs

# Expose API port
EXPOSE 8000

# Default command: run API server
CMD ["uvicorn", "backend_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
