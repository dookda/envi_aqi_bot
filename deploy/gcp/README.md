# Google Cloud Platform Deployment Guide

This guide will help you deploy the AQI Monitoring Application to Google Cloud Platform with GPU support for ML model training.

## 📋 Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and configured
3. **kubectl** installed
4. **Docker** installed locally
5. **Terraform** (optional, for infrastructure as code)

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Cloud Load Balancer                      │   │
│  │                   (HTTPS + SSL)                           │   │
│  └─────────────────────┬────────────────────────────────────┘   │
│                        │                                         │
│  ┌─────────────────────▼────────────────────────────────────┐   │
│  │              Google Kubernetes Engine (GKE)               │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │  Frontend   │  │    API      │  │   Scheduler     │   │   │
│  │  │  (React)    │  │  (FastAPI)  │  │   (Python)      │   │   │
│  │  │  Nginx      │  │             │  │                 │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │         GPU Node Pool (for ML Training)             │ │   │
│  │  │  ┌─────────────┐  ┌────────────────────────────┐    │ │   │
│  │  │  │   Ollama    │  │  ML Training Jobs          │    │ │   │
│  │  │  │  (T4 GPU)   │  │  (NVIDIA T4/A100)          │    │ │   │
│  │  │  └─────────────┘  └────────────────────────────┘    │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └───────────────────────────────────────────────────────────┘   │
│                        │                                         │
│  ┌─────────────────────▼────────────────────────────────────┐   │
│  │              Cloud SQL (PostgreSQL)                       │   │
│  │              with PostGIS extension                       │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Artifact Registry                            │   │
│  │              (Container Images)                           │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start Deployment

### Step 1: Set up Google Cloud Project

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
export REGION="asia-southeast1"  # Singapore - closest to Thailand
export ZONE="${REGION}-b"

# Configure gcloud
gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION
gcloud config set compute/zone $ZONE

# Enable required APIs
gcloud services enable \
    container.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    compute.googleapis.com
```

### Step 2: Create Artifact Registry for Container Images

```bash
# Create container registry
gcloud artifacts repositories create aqi-app \
    --repository-format=docker \
    --location=$REGION \
    --description="AQI Application Container Images"

# Configure Docker authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

### Step 3: Build and Push Container Images

```bash
# Build and push images
export IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/aqi-app"

# Build API image
docker build -t ${IMAGE_PREFIX}/api:latest .
docker push ${IMAGE_PREFIX}/api:latest

# Build Frontend image
docker build -t ${IMAGE_PREFIX}/frontend:latest ./frontend
docker push ${IMAGE_PREFIX}/frontend:latest
```

### Step 4: Create Cloud SQL PostgreSQL Instance

```bash
# Create Cloud SQL instance with PostGIS
gcloud sql instances create aqi-postgres \
    --database-version=POSTGRES_15 \
    --tier=db-custom-2-4096 \
    --region=$REGION \
    --storage-size=20GB \
    --storage-auto-increase \
    --database-flags=cloudsql.enable_pg_audit=on

# Create database
gcloud sql databases create aqi_db --instance=aqi-postgres

# Create user
gcloud sql users create aqi_user \
    --instance=aqi-postgres \
    --password="YOUR_SECURE_PASSWORD"

# Enable PostGIS extension (connect via Cloud SQL proxy first)
# CREATE EXTENSION IF NOT EXISTS postgis;
# CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

### Step 5: Create GKE Cluster with GPU Support

```bash
# Create GKE cluster with GPU node pool
gcloud container clusters create aqi-cluster \
    --zone=$ZONE \
    --num-nodes=2 \
    --machine-type=e2-standard-4 \
    --enable-autoscaling \
    --min-nodes=1 \
    --max-nodes=5 \
    --enable-ip-alias \
    --workload-pool=${PROJECT_ID}.svc.id.goog

# Add GPU node pool for ML workloads
gcloud container node-pools create gpu-pool \
    --cluster=aqi-cluster \
    --zone=$ZONE \
    --machine-type=n1-standard-4 \
    --accelerator=type=nvidia-tesla-t4,count=1 \
    --num-nodes=1 \
    --enable-autoscaling \
    --min-nodes=0 \
    --max-nodes=2

# Get credentials
gcloud container clusters get-credentials aqi-cluster --zone=$ZONE

# Install NVIDIA GPU drivers
kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded-latest.yaml
```

### Step 6: Create Kubernetes Secrets

```bash
# Create secrets for database connection
kubectl create secret generic aqi-db-secret \
    --from-literal=DATABASE_URL="postgresql://aqi_user:YOUR_PASSWORD@/aqi_db?host=/cloudsql/${PROJECT_ID}:${REGION}:aqi-postgres"

# Create secret for Anthropic API key (if using Claude)
kubectl create secret generic aqi-api-secrets \
    --from-literal=ANTHROPIC_API_KEY="your-api-key"
```

### Step 7: Deploy Application

```bash
# Apply Kubernetes manifests
kubectl apply -f deploy/gcp/kubernetes/

# Check deployment status
kubectl get pods
kubectl get services
```

## 💰 Estimated Costs (Monthly)

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| **GKE Standard Cluster** | 2 x e2-standard-4 | ~$140 |
| **GPU Node Pool** | 1 x n1-standard-4 + T4 GPU | ~$250 (when active) |
| **Cloud SQL** | db-custom-2-4096, 20GB | ~$100 |
| **Load Balancer** | Standard | ~$20 |
| **Artifact Registry** | 5GB storage | ~$5 |
| **Network Egress** | ~50GB | ~$5 |
| **Total (GPU always on)** | | **~$520/month** |
| **Total (GPU on-demand)** | | **~$270/month** |

💡 **Cost Optimization Tips:**
- Use preemptible/spot VMs for GPU workloads (70% savings)
- Scale GPU nodes to 0 when not training
- Use Cloud Run for frontend (pay-per-request)
- Enable committed use discounts

## 🔧 Configuration Files

The following files are provided in this directory:

- `kubernetes/` - Kubernetes deployment manifests
- `terraform/` - Infrastructure as Code (optional)
- `cloudbuild/` - CI/CD pipeline configuration

## 📚 Additional Resources

- [GKE GPU Documentation](https://cloud.google.com/kubernetes-engine/docs/how-to/gpus)
- [Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres)
- [Artifact Registry](https://cloud.google.com/artifact-registry/docs)
