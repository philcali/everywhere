# 🐳 Docker Setup for Travel Weather Plotter

This document provides comprehensive instructions for running Travel Weather Plotter using Docker.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Docker Files Overview](#-docker-files-overview)
- [Development Environment](#-development-environment)
- [Production Environment](#-production-environment)
- [Docker Scripts](#-docker-scripts)
- [Environment Variables](#-environment-variables)
- [Volumes and Data Persistence](#-volumes-and-data-persistence)
- [Networking](#-networking)
- [Backup and Restore](#-backup-and-restore)
- [Troubleshooting](#-troubleshooting)
- [Advanced Configuration](#-advanced-configuration)

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- At least 2GB of available RAM
- At least 5GB of available disk space

### 1. Clone and Setup

```bash
git clone https://github.com/philcali/travel-weather-plotter.git
cd travel-weather-plotter

# Copy environment file
cp .env.example .env

# Edit .env with your configuration (optional - works with defaults)
nano .env
```

### 2. Start the Application

**Production Mode:**
```bash
# Using npm script
npm run docker:start:prod

# Or using the script directly
./docker-scripts/start.sh --prod
```

**Development Mode:**
```bash
# Using npm script
npm run docker:start:dev

# Or using the script directly
./docker-scripts/start.sh --dev
```

### 3. Access the Application

- **Application**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs
- **Frontend Dev Server** (dev mode only): http://localhost:5173
- **MailHog** (dev mode only): http://localhost:8025

## 📁 Docker Files Overview

### Core Docker Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage production build |
| `Dockerfile.dev` | Development environment |
| `docker-compose.yml` | Production services configuration |
| `docker-compose.dev.yml` | Development services configuration |
| `.dockerignore` | Files to exclude from Docker context |
| `nginx.conf` | Nginx reverse proxy configuration |

### Docker Scripts

| Script | Purpose |
|--------|---------|
| `docker-scripts/start.sh` | Start application containers |
| `docker-scripts/stop.sh` | Stop and cleanup containers |
| `docker-scripts/logs.sh` | View container logs |
| `docker-scripts/backup.sh` | Backup application data |
| `docker-scripts/restore.sh` | Restore from backup |

## 🔧 Development Environment

The development environment includes:

- **Hot reloading** for both frontend and backend
- **Source code mounting** for instant changes
- **Development databases** (PostgreSQL + SQLite)
- **Redis** for caching
- **MailHog** for email testing

### Starting Development Environment

```bash
# Start in detached mode
./docker-scripts/start.sh --dev --detach

# Start with build (if you made changes to Dockerfile.dev)
./docker-scripts/start.sh --dev --build

# View logs
./docker-scripts/logs.sh --dev --follow
```

### Development Services

| Service | Port | Purpose |
|---------|------|---------|
| app-dev | 3001, 5173 | Main application with hot reload |
| postgres-dev | 5432 | PostgreSQL database |
| redis-dev | 6379 | Redis cache |
| mailhog | 1025, 8025 | Email testing |

### Development Environment Variables

```env
# Development-specific settings
NODE_ENV=development
USE_MOCK_APIS=true
DATABASE_URL=postgresql://dev_user:dev_password@postgres-dev:5432/travel_weather_dev
REDIS_URL=redis://redis-dev:6379
SMTP_HOST=mailhog
SMTP_PORT=1025
```

## 🏭 Production Environment

The production environment includes:

- **Optimized builds** with multi-stage Docker builds
- **Nginx reverse proxy** with SSL support
- **Redis caching** for performance
- **Health checks** and monitoring
- **Security hardening**

### Starting Production Environment

```bash
# Start production environment
./docker-scripts/start.sh --prod --detach

# Start with fresh build
./docker-scripts/start.sh --prod --build --detach

# View logs
./docker-scripts/logs.sh --prod --follow
```

### Production Services

| Service | Port | Purpose |
|---------|------|---------|
| app | 3001 | Main application |
| nginx | 80, 443 | Reverse proxy and static files |
| redis | 6379 | Redis cache |

### Production Security Features

- **Non-root user** in containers
- **Read-only file systems** where possible
- **Security headers** via Nginx
- **Rate limiting** on API endpoints
- **HTTPS support** (configure SSL certificates)

## 🛠️ Docker Scripts

### Start Script

```bash
./docker-scripts/start.sh [OPTIONS]

Options:
  --dev, --development    Start in development mode
  --prod, --production    Start in production mode (default)
  -d, --detach           Run in detached mode
  --build                Force rebuild of images
  -h, --help             Show help message
```

### Stop Script

```bash
./docker-scripts/stop.sh [OPTIONS]

Options:
  --dev, --development    Stop development environment
  --prod, --production    Stop production environment (default)
  --volumes              Remove volumes (data will be lost!)
  --images               Remove images
  --clean                Remove volumes and images (full cleanup)
  -h, --help             Show help message
```

### Logs Script

```bash
./docker-scripts/logs.sh [OPTIONS] [SERVICE]

Options:
  --dev, --development    View development environment logs
  --prod, --production    View production environment logs (default)
  -f, --follow           Follow log output
  --tail N               Number of lines to show (default: 100)

Services:
  --app                  Application logs
  --nginx                Nginx logs (production only)
  --redis                Redis logs
  --postgres             PostgreSQL logs (development only)
  --mailhog              MailHog logs (development only)
```

## 🌍 Environment Variables

### Required Variables

```env
# API Keys (optional - app works with mock data)
WEATHER_API_KEY=your_openweathermap_api_key
ROUTING_API_KEY=your_routing_api_key
GEOCODING_API_KEY=your_geocoding_api_key

# Security
JWT_SECRET=your_super_secret_jwt_key
```

### Optional Variables

```env
# Database
DATABASE_URL=./data/travel_weather.db

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:3001
NODE_ENV=production

# Caching
CACHE_TTL_WEATHER=300
CACHE_TTL_ROUTING=3600
REDIS_URL=redis://redis:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Uploads
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads
```

## 💾 Volumes and Data Persistence

### Production Volumes

| Volume | Purpose | Mount Point |
|--------|---------|-------------|
| `travel-weather-data` | SQLite database and app data | `/app/data` |
| `travel-weather-uploads` | User uploaded files | `/app/uploads` |
| `travel-weather-redis` | Redis data persistence | `/data` |

### Development Volumes

| Volume | Purpose | Mount Point |
|--------|---------|-------------|
| `travel-weather-dev-data` | Development database | `/app/data` |
| `travel-weather-dev-uploads` | Development uploads | `/app/uploads` |
| `travel-weather-postgres-dev` | PostgreSQL data | `/var/lib/postgresql/data` |
| `travel-weather-redis-dev` | Redis development data | `/data` |

### Volume Management

```bash
# List volumes
docker volume ls --filter name=travel-weather

# Inspect volume
docker volume inspect travel-weather-data

# Remove volume (⚠️ DATA WILL BE LOST!)
docker volume rm travel-weather-data

# Backup volume
./docker-scripts/backup.sh --include-uploads

# Restore volume
./docker-scripts/restore.sh backup-name
```

## 🌐 Networking

### Production Network

- **Network Name**: `travel-weather-network`
- **Driver**: bridge
- **Internal Communication**: Services communicate using service names

### Port Mapping

| Service | Internal Port | External Port | Purpose |
|---------|---------------|---------------|---------|
| app | 3001 | 3001 | API and static files |
| nginx | 80, 443 | 80, 443 | HTTP/HTTPS proxy |
| redis | 6379 | 6379 | Redis (optional external access) |

### Custom Network Configuration

```yaml
# In docker-compose.yml
networks:
  travel-weather-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## 💾 Backup and Restore

### Creating Backups

```bash
# Backup production environment
./docker-scripts/backup.sh --prod --include-uploads

# Backup development environment
./docker-scripts/backup.sh --dev

# Backup with custom name
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
./docker-scripts/backup.sh --prod --include-uploads
```

### Restoring from Backup

```bash
# List available backups
./docker-scripts/restore.sh --help

# Restore specific backup
./docker-scripts/restore.sh --prod travel-weather-backup-20240115_143022

# Force restore without confirmation
./docker-scripts/restore.sh --prod --force travel-weather-backup-20240115_143022
```

### Backup Contents

- **Database files** (SQLite or PostgreSQL dumps)
- **Configuration files** (.env, docker-compose files)
- **Upload files** (if --include-uploads is specified)
- **Metadata** (backup date, environment, contents)

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Check what's using the port
sudo lsof -i :3001

# Kill the process
sudo kill -9 <PID>

# Or use different ports
PORT=3002 ./docker-scripts/start.sh
```

#### 2. Permission Denied

```bash
# Make scripts executable
chmod +x docker-scripts/*.sh

# Fix volume permissions
sudo chown -R $USER:$USER data/ uploads/
```

#### 3. Out of Disk Space

```bash
# Clean up Docker resources
docker system prune -a

# Remove unused volumes
docker volume prune

# Check disk usage
docker system df
```

#### 4. Container Won't Start

```bash
# Check container logs
./docker-scripts/logs.sh --app

# Check container status
docker-compose ps

# Restart specific service
docker-compose restart app
```

#### 5. Database Connection Issues

```bash
# Check database container
docker-compose logs postgres-dev

# Reset database volume
./docker-scripts/stop.sh --dev --volumes
./docker-scripts/start.sh --dev
```

### Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# View health check logs
docker inspect --format='{{json .State.Health}}' travel-weather-plotter
```

### Debug Mode

```bash
# Start with debug logging
DEBUG=travel-weather-plotter:* ./docker-scripts/start.sh --dev

# Access container shell
docker exec -it travel-weather-plotter sh

# View container processes
docker exec travel-weather-plotter ps aux
```

## ⚙️ Advanced Configuration

### SSL/HTTPS Setup

1. **Obtain SSL certificates**:
   ```bash
   mkdir ssl
   # Copy your cert.pem and key.pem to ssl/
   ```

2. **Update nginx.conf**:
   ```nginx
   # Uncomment SSL server block in nginx.conf
   ```

3. **Update docker-compose.yml**:
   ```yaml
   nginx:
     volumes:
       - ./ssl:/etc/nginx/ssl:ro
   ```

### Custom Database

Replace SQLite with PostgreSQL in production:

```yaml
# Add to docker-compose.yml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_DB: travel_weather
    POSTGRES_USER: app_user
    POSTGRES_PASSWORD: secure_password
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

### Monitoring and Logging

Add monitoring services:

```yaml
# Add to docker-compose.yml
prometheus:
  image: prom/prometheus:latest
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana:latest
  ports:
    - "3000:3000"
  volumes:
    - grafana_data:/var/lib/grafana
```

### Scaling Services

```bash
# Scale application instances
docker-compose up --scale app=3

# Use load balancer
# Update nginx.conf with upstream configuration
```

### Development with Remote Debugging

```yaml
# Add to docker-compose.dev.yml
app-dev:
  command: ["node", "--inspect=0.0.0.0:9229", "backend/dist/server.js"]
  ports:
    - "9229:9229"  # Debug port
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [PostgreSQL Docker Guide](https://hub.docker.com/_/postgres)
- [Redis Docker Guide](https://hub.docker.com/_/redis)

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs**: `./docker-scripts/logs.sh --follow`
2. **Review this documentation**
3. **Check Docker system resources**: `docker system df`
4. **Create an issue** on GitHub with:
   - Docker version: `docker --version`
   - Docker Compose version: `docker-compose --version`
   - System information: `uname -a`
   - Error logs and steps to reproduce

---

**Happy Dockerizing! 🐳**