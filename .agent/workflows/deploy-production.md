---
description: Deploy Envir AI to production server with Docker, Nginx, and SSL
---

# 🚀 Production Deployment Guide

Deploy Envir AI to https://envir-ai.com with Docker, Nginx, and SSL.

## Prerequisites

- Server with Docker and Docker Compose installed
- Nginx installed as reverse proxy
- SSL certificates via Certbot (Let's Encrypt)
- Domain `envir-ai.com` pointing to your server

---

## Step 1: Upload Project to Server

On your local machine, upload the project:

```bash
# Using rsync (recommended)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'postgres_data' --exclude '__pycache__' \
  /Users/sakdahomhuan/Dev/envi_aqi_bot/ \
  user@your-server:/opt/envir-ai/
```

---

## Step 2: Configure Environment Variables

SSH into your server:

```bash
ssh user@your-server
cd /opt/envir-ai

# Copy production environment template
cp .env.production .env

# Edit with your actual values
nano .env
```

**Important:** Update these values in `.env`:
- `POSTGRES_PASSWORD` - Use a strong password
- `ANTHROPIC_API_KEY` - If using Claude AI
- `LINE_CHANNEL_SECRET` & `LINE_CHANNEL_ACCESS_TOKEN` - If using LINE Bot

---

## Step 3: Configure Nginx Reverse Proxy

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/envir-ai
```

Add this configuration:

```nginx
# /etc/nginx/sites-available/envir-ai

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name envir-ai.com www.envir-ai.com;
    return 301 https://envir-ai.com$request_uri;
}

# Redirect www to non-www
server {
    listen 443 ssl http2;
    server_name www.envir-ai.com;
    
    ssl_certificate /etc/letsencrypt/live/envir-ai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/envir-ai.com/privkey.pem;
    
    return 301 https://envir-ai.com$request_uri;
}

# Main HTTPS Server
server {
    listen 443 ssl http2;
    server_name envir-ai.com;

    # SSL Configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/envir-ai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/envir-ai.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Proxy all requests to Docker frontend
    location / {
        proxy_pass http://127.0.0.1:5800;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeout for AI operations
        proxy_read_timeout 120s;
        proxy_connect_timeout 30s;
    }

    # Health check endpoint (direct to API)
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # LINE Webhook (direct to API, bypasses frontend nginx)
    location /webhook {
        proxy_pass http://127.0.0.1:8000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Line-Signature $http_x_line_signature;
    }
}
```

Enable the site:

```bash
# Enable site
sudo ln -sf /etc/nginx/sites-available/envir-ai /etc/nginx/sites-enabled/

# Remove default site if exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Step 4: Build and Start Containers

```bash
cd /opt/envir-ai

# Build and start in production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Wait for containers to start
sleep 30

# Check container status
docker compose ps

# View logs
docker compose logs -f --tail=100
```

---

## Step 5: Verify Deployment

Test each component:

```bash
# Test API health
curl https://envir-ai.com/health

# Test frontend
curl -I https://envir-ai.com/

# Check all containers are healthy
docker compose ps
```

Visit https://envir-ai.com in your browser!

---

## Step 6: Pull Ollama Model (if not auto-downloaded)

```bash
# Check Ollama status
docker logs aqi_ollama

# Manually pull model if needed
docker exec aqi_ollama ollama pull qwen2.5:1.5b
```

---

## 🔄 Updating the Application

When you have code updates:

```bash
cd /opt/envir-ai

# Upload latest code from local machine
# (run on your local machine)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'postgres_data' \
  /Users/sakdahomhuan/Dev/envi_aqi_bot/ \
  user@your-server:/opt/envir-ai/

# On server: Rebuild and restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# View logs
docker compose logs -f --tail=100
```

---

## 📊 Monitoring Commands

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f ollama
docker compose logs -f scheduler

# Check resource usage
docker stats

# Check disk usage
docker system df
```

---

## 💾 Database Backup

```bash
# Create backup
docker exec aqi_postgres pg_dump -U aqi_user aqi_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup (if needed)
cat backup_20260117.sql | docker exec -i aqi_postgres psql -U aqi_user -d aqi_db
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Check containers: `docker compose ps` |
| SSL Certificate Error | Renew: `sudo certbot renew` |
| Ollama not responding | Check logs: `docker logs aqi_ollama` |
| Database connection error | Verify DATABASE_URL in .env |
| Frontend shows blank page | Check browser console for errors |
| API timeout | Increase proxy_read_timeout in nginx |

---

## 🛡️ Security Checklist

- [ ] Changed default database password
- [ ] Firewall configured (allow only 80, 443, 22)
- [ ] SSL certificate auto-renewal configured
- [ ] Log rotation set up
- [ ] Regular database backups scheduled
- [ ] Keep Docker and system packages updated
