#!/bin/bash
# =============================================================================
# Google Cloud Platform Deployment Script
# AQI Monitoring Application with GPU Support
# =============================================================================
# 
# Usage: ./deploy.sh [PROJECT_ID] [REGION]
# Example: ./deploy.sh my-project-id asia-southeast1
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - kubectl installed
# - Docker installed (for local builds)
# =============================================================================

set -e

# Configuration
PROJECT_ID="${1:-your-project-id}"
REGION="${2:-asia-southeast1}"
ZONE="${REGION}-b"
CLUSTER_NAME="aqi-cluster"
INSTANCE_NAME="aqi-postgres"
REPO_NAME="aqi-app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_step() {
    echo -e "${BLUE}==>${NC} ${GREEN}$1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# -----------------------------------------------------------------------------
# Validation
# -----------------------------------------------------------------------------
echo_step "Validating prerequisites..."

if ! command -v gcloud &> /dev/null; then
    echo_error "gcloud CLI is not installed. Please install it first."
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo_error "kubectl is not installed. Please install it first."
    exit 1
fi

if [ "$PROJECT_ID" = "your-project-id" ]; then
    echo_error "Please provide a valid PROJECT_ID"
    echo "Usage: ./deploy.sh [PROJECT_ID] [REGION]"
    exit 1
fi

echo_success "Prerequisites validated"

# -----------------------------------------------------------------------------
# Step 1: Configure gcloud
# -----------------------------------------------------------------------------
echo_step "Configuring gcloud..."
gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION
gcloud config set compute/zone $ZONE
echo_success "gcloud configured for project: $PROJECT_ID"

# -----------------------------------------------------------------------------
# Step 2: Enable APIs
# -----------------------------------------------------------------------------
echo_step "Enabling required APIs..."
gcloud services enable \
    container.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    compute.googleapis.com \
    --quiet

echo_success "APIs enabled"

# -----------------------------------------------------------------------------
# Step 3: Create Artifact Registry
# -----------------------------------------------------------------------------
echo_step "Creating Artifact Registry..."
if gcloud artifacts repositories describe $REPO_NAME --location=$REGION &> /dev/null; then
    echo_warning "Artifact Registry '$REPO_NAME' already exists"
else
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="AQI Application Container Images"
    echo_success "Artifact Registry created"
fi

# Configure Docker authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# -----------------------------------------------------------------------------
# Step 4: Create Cloud SQL Instance
# -----------------------------------------------------------------------------
echo_step "Creating Cloud SQL instance..."
if gcloud sql instances describe $INSTANCE_NAME &> /dev/null; then
    echo_warning "Cloud SQL instance '$INSTANCE_NAME' already exists"
else
    gcloud sql instances create $INSTANCE_NAME \
        --database-version=POSTGRES_15 \
        --tier=db-custom-2-4096 \
        --region=$REGION \
        --storage-size=20GB \
        --storage-auto-increase \
        --quiet
    
    # Create database
    gcloud sql databases create aqi_db --instance=$INSTANCE_NAME --quiet
    
    # Create user (prompt for password)
    echo "Enter password for database user 'aqi_user':"
    read -s DB_PASSWORD
    gcloud sql users create aqi_user \
        --instance=$INSTANCE_NAME \
        --password="$DB_PASSWORD" \
        --quiet
    
    echo_success "Cloud SQL instance created"
fi

# -----------------------------------------------------------------------------
# Step 5: Create GKE Cluster
# -----------------------------------------------------------------------------
echo_step "Creating GKE cluster..."
if gcloud container clusters describe $CLUSTER_NAME --zone=$ZONE &> /dev/null; then
    echo_warning "GKE cluster '$CLUSTER_NAME' already exists"
else
    gcloud container clusters create $CLUSTER_NAME \
        --zone=$ZONE \
        --num-nodes=2 \
        --machine-type=e2-standard-4 \
        --enable-autoscaling \
        --min-nodes=1 \
        --max-nodes=5 \
        --enable-ip-alias \
        --workload-pool=${PROJECT_ID}.svc.id.goog \
        --quiet
    
    echo_success "GKE cluster created"
fi

# Get credentials
gcloud container clusters get-credentials $CLUSTER_NAME --zone=$ZONE

# -----------------------------------------------------------------------------
# Step 6: Create GPU Node Pool
# -----------------------------------------------------------------------------
echo_step "Creating GPU node pool..."
if gcloud container node-pools describe gpu-pool --cluster=$CLUSTER_NAME --zone=$ZONE &> /dev/null; then
    echo_warning "GPU node pool already exists"
else
    gcloud container node-pools create gpu-pool \
        --cluster=$CLUSTER_NAME \
        --zone=$ZONE \
        --machine-type=n1-standard-4 \
        --accelerator=type=nvidia-tesla-t4,count=1 \
        --num-nodes=1 \
        --enable-autoscaling \
        --min-nodes=0 \
        --max-nodes=2 \
        --quiet
    
    echo_success "GPU node pool created"
fi

# Install NVIDIA drivers
echo_step "Installing NVIDIA GPU drivers..."
kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded-latest.yaml

# -----------------------------------------------------------------------------
# Step 7: Create Static IP
# -----------------------------------------------------------------------------
echo_step "Creating static IP..."
if gcloud compute addresses describe aqi-static-ip --global &> /dev/null; then
    echo_warning "Static IP already exists"
else
    gcloud compute addresses create aqi-static-ip --global
    echo_success "Static IP created"
fi

STATIC_IP=$(gcloud compute addresses describe aqi-static-ip --global --format='get(address)')
echo "Static IP: $STATIC_IP"

# -----------------------------------------------------------------------------
# Step 8: Create Service Account for Workload Identity
# -----------------------------------------------------------------------------
echo_step "Setting up Workload Identity..."
SA_NAME="aqi-app"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe $SA_EMAIL &> /dev/null; then
    echo_warning "Service account already exists"
else
    gcloud iam service-accounts create $SA_NAME \
        --display-name="AQI App Service Account"
    
    # Grant Cloud SQL Client role
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/cloudsql.client"
    
    echo_success "Service account created"
fi

# -----------------------------------------------------------------------------
# Step 9: Build and Push Images
# -----------------------------------------------------------------------------
echo_step "Building and pushing container images..."
IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

# Build API
docker build -t ${IMAGE_PREFIX}/api:latest .
docker push ${IMAGE_PREFIX}/api:latest

# Build Frontend
docker build -t ${IMAGE_PREFIX}/frontend:latest ./frontend
docker push ${IMAGE_PREFIX}/frontend:latest

echo_success "Images built and pushed"

# -----------------------------------------------------------------------------
# Step 10: Update Kubernetes manifests with project-specific values
# -----------------------------------------------------------------------------
echo_step "Updating Kubernetes manifests..."

# Create temp directory
TEMP_DIR=$(mktemp -d)
cp -r deploy/gcp/kubernetes/* $TEMP_DIR/

# Replace placeholders
find $TEMP_DIR -type f -name "*.yaml" -exec sed -i '' \
    -e "s|REGION-docker.pkg.dev/PROJECT_ID|${REGION}-docker.pkg.dev/${PROJECT_ID}|g" \
    -e "s|YOUR_PROJECT_ID|${PROJECT_ID}|g" \
    -e "s|aqi.yourdomain.com|${STATIC_IP}.nip.io|g" \
    {} \;

echo_success "Manifests updated"

# -----------------------------------------------------------------------------
# Step 11: Deploy to Kubernetes
# -----------------------------------------------------------------------------
echo_step "Deploying to Kubernetes..."

# Apply manifests in order
kubectl apply -f $TEMP_DIR/namespace.yaml
kubectl apply -f $TEMP_DIR/configmap.yaml
kubectl apply -f $TEMP_DIR/serviceaccount.yaml
kubectl apply -f $TEMP_DIR/pvc.yaml

echo_warning "Please create secrets manually before continuing:"
echo "kubectl create secret generic aqi-db-secret --namespace=aqi-app --from-literal=DATABASE_URL='YOUR_DB_URL'"
echo ""
read -p "Press Enter when secrets are created..."

kubectl apply -f $TEMP_DIR/api-deployment.yaml
kubectl apply -f $TEMP_DIR/frontend-deployment.yaml
kubectl apply -f $TEMP_DIR/scheduler-deployment.yaml
kubectl apply -f $TEMP_DIR/ingress.yaml

# Optionally deploy Ollama (GPU required)
read -p "Deploy Ollama with GPU support? (y/n): " DEPLOY_OLLAMA
if [ "$DEPLOY_OLLAMA" = "y" ]; then
    kubectl apply -f $TEMP_DIR/ollama-deployment.yaml
fi

# Cleanup
rm -rf $TEMP_DIR

echo_success "Kubernetes deployment complete"

# -----------------------------------------------------------------------------
# Step 12: Show deployment status
# -----------------------------------------------------------------------------
echo_step "Deployment Status:"
kubectl get pods -n aqi-app
kubectl get services -n aqi-app
kubectl get ingress -n aqi-app

echo ""
echo_success "Deployment complete!"
echo ""
echo "Access your application at:"
echo "  http://${STATIC_IP}.nip.io (HTTP - use for testing)"
echo "  https://your-domain.com (after configuring DNS)"
echo ""
echo "Monitor your application:"
echo "  kubectl logs -f deployment/api -n aqi-app"
echo "  kubectl logs -f deployment/frontend -n aqi-app"
echo ""
echo "Scale GPU nodes:"
echo "  gcloud container clusters resize $CLUSTER_NAME --node-pool=gpu-pool --num-nodes=1 --zone=$ZONE"
