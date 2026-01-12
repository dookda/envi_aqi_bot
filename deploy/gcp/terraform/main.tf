# =============================================================================
# Terraform Configuration for AQI Application on Google Cloud
# =============================================================================
# 
# Usage:
#   1. cd deploy/gcp/terraform
#   2. terraform init
#   3. terraform plan -var="project_id=your-project-id"
#   4. terraform apply -var="project_id=your-project-id"
# =============================================================================

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
  
  # Uncomment to use remote state (recommended)
  # backend "gcs" {
  #   bucket = "your-terraform-state-bucket"
  #   prefix = "aqi-app"
  # }
}

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------
variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud Region"
  type        = string
  default     = "asia-southeast1"  # Singapore - closest to Thailand
}

variable "zone" {
  description = "Google Cloud Zone"
  type        = string
  default     = "asia-southeast1-b"
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "enable_gpu" {
  description = "Enable GPU node pool for ML workloads"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Provider Configuration
# -----------------------------------------------------------------------------
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# -----------------------------------------------------------------------------
# Enable Required APIs
# -----------------------------------------------------------------------------
resource "google_project_service" "apis" {
  for_each = toset([
    "container.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "compute.googleapis.com",
  ])
  
  service            = each.key
  disable_on_destroy = false
}

# -----------------------------------------------------------------------------
# Artifact Registry for Container Images
# -----------------------------------------------------------------------------
resource "google_artifact_registry_repository" "aqi_app" {
  provider      = google-beta
  location      = var.region
  repository_id = "aqi-app"
  description   = "AQI Application Container Images"
  format        = "DOCKER"
  
  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# VPC Network
# -----------------------------------------------------------------------------
resource "google_compute_network" "vpc" {
  name                    = "aqi-vpc"
  auto_create_subnetworks = false
  
  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "subnet" {
  name          = "aqi-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
  
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }
  
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/20"
  }
}

# -----------------------------------------------------------------------------
# Cloud SQL PostgreSQL Instance
# -----------------------------------------------------------------------------
resource "google_sql_database_instance" "postgres" {
  name             = "aqi-postgres"
  database_version = "POSTGRES_15"
  region           = var.region
  
  settings {
    tier              = "db-custom-2-4096"  # 2 vCPU, 4GB RAM
    disk_size         = 20
    disk_autoresize   = true
    disk_type         = "PD_SSD"
    availability_type = "ZONAL"  # Change to REGIONAL for HA
    
    backup_configuration {
      enabled    = true
      start_time = "03:00"  # UTC
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }
    
    database_flags {
      name  = "max_connections"
      value = "200"
    }
  }
  
  deletion_protection = true
  
  depends_on = [google_project_service.apis]
}

resource "google_sql_database" "aqi_db" {
  name     = "aqi_db"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "aqi_user" {
  name     = "aqi_user"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

# -----------------------------------------------------------------------------
# GKE Cluster
# -----------------------------------------------------------------------------
resource "google_container_cluster" "primary" {
  name     = "aqi-cluster"
  location = var.zone
  
  # Remove default node pool
  remove_default_node_pool = true
  initial_node_count       = 1
  
  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name
  
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }
  
  # Enable Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
  
  # Enable private nodes (recommended)
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }
  
  depends_on = [google_project_service.apis]
}

# Standard node pool for API and Frontend
resource "google_container_node_pool" "standard" {
  name       = "standard-pool"
  location   = var.zone
  cluster    = google_container_cluster.primary.name
  node_count = 2
  
  autoscaling {
    min_node_count = 1
    max_node_count = 5
  }
  
  node_config {
    machine_type = "e2-standard-4"  # 4 vCPU, 16GB RAM
    disk_size_gb = 50
    disk_type    = "pd-ssd"
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
    
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}

# GPU node pool for ML workloads
resource "google_container_node_pool" "gpu" {
  count      = var.enable_gpu ? 1 : 0
  name       = "gpu-pool"
  location   = var.zone
  cluster    = google_container_cluster.primary.name
  node_count = 0  # Start with 0, scale up when needed
  
  autoscaling {
    min_node_count = 0
    max_node_count = 2
  }
  
  node_config {
    machine_type = "n1-standard-4"  # 4 vCPU, 15GB RAM
    disk_size_gb = 100
    disk_type    = "pd-ssd"
    
    guest_accelerator {
      type  = "nvidia-tesla-t4"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "LATEST"
      }
    }
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
    
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
    
    # Taint GPU nodes so only GPU workloads are scheduled
    taint {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }
  }
}

# -----------------------------------------------------------------------------
# Static IP for Load Balancer
# -----------------------------------------------------------------------------
resource "google_compute_global_address" "static_ip" {
  name = "aqi-static-ip"
}

# -----------------------------------------------------------------------------
# Service Account for Workload Identity
# -----------------------------------------------------------------------------
resource "google_service_account" "aqi_app" {
  account_id   = "aqi-app"
  display_name = "AQI App Service Account"
}

resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.aqi_app.email}"
}

resource "google_project_iam_member" "artifact_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.aqi_app.email}"
}

# Workload Identity binding
resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.aqi_app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[aqi-app/aqi-app-sa]"
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "cluster_name" {
  value       = google_container_cluster.primary.name
  description = "GKE Cluster Name"
}

output "cluster_endpoint" {
  value       = google_container_cluster.primary.endpoint
  description = "GKE Cluster Endpoint"
  sensitive   = true
}

output "database_connection_name" {
  value       = google_sql_database_instance.postgres.connection_name
  description = "Cloud SQL Connection Name"
}

output "static_ip" {
  value       = google_compute_global_address.static_ip.address
  description = "Static IP Address for Load Balancer"
}

output "artifact_registry" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/aqi-app"
  description = "Artifact Registry URL"
}

output "service_account_email" {
  value       = google_service_account.aqi_app.email
  description = "Service Account Email"
}
