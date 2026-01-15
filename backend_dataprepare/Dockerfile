# Data Preparation Service Dockerfile
# Lightweight container for CSV data preparation

FROM python:3.11-slim

# Set working directory  
WORKDIR /app

# Install curl for health checks and required Python packages
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir \
    fastapi==0.109.0 \
    uvicorn[standard]==0.27.0 \
    python-multipart==0.0.6

# Copy the data preparation service
COPY main.py /app/main.py

# Expose port
EXPOSE 8001

# Run the service
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
