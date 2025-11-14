#!/bin/bash

# ==============================================
# Travel Weather Plotter - Docker Start Script
# ==============================================

set -e

echo "🚀 Starting Travel Weather Plotter..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "✅ Please edit .env file with your configuration before running again."
    exit 1
fi

# Load environment variables
source .env

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Docker installation
if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Parse command line arguments
ENVIRONMENT="production"
DETACHED=""
BUILD=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dev|--development)
            ENVIRONMENT="development"
            shift
            ;;
        --prod|--production)
            ENVIRONMENT="production"
            shift
            ;;
        -d|--detach)
            DETACHED="-d"
            shift
            ;;
        --build)
            BUILD="--build"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dev, --development    Start in development mode"
            echo "  --prod, --production    Start in production mode (default)"
            echo "  -d, --detach           Run in detached mode"
            echo "  --build                Force rebuild of images"
            echo "  -h, --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set compose file based on environment
if [ "$ENVIRONMENT" = "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    echo "🔧 Starting in development mode..."
else
    COMPOSE_FILE="docker-compose.yml"
    echo "🏭 Starting in production mode..."
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p data uploads ssl logs

# Set proper permissions
chmod 755 data uploads

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down --remove-orphans

# Pull latest images (for production)
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📥 Pulling latest images..."
    docker-compose -f $COMPOSE_FILE pull
fi

# Build and start containers
echo "🏗️  Building and starting containers..."
docker-compose -f $COMPOSE_FILE up $BUILD $DETACHED

if [ -n "$DETACHED" ]; then
    echo ""
    echo "✅ Travel Weather Plotter started successfully!"
    echo ""
    echo "🌐 Application: http://localhost:3001"
    if [ "$ENVIRONMENT" = "development" ]; then
        echo "🔧 Frontend Dev Server: http://localhost:5173"
        echo "📧 MailHog (Email Testing): http://localhost:8025"
    fi
    echo "📊 API Documentation: http://localhost:3001/api/docs"
    echo ""
    echo "📋 Useful commands:"
    echo "  docker-compose -f $COMPOSE_FILE logs -f    # View logs"
    echo "  docker-compose -f $COMPOSE_FILE ps         # View running containers"
    echo "  docker-compose -f $COMPOSE_FILE down       # Stop containers"
    echo ""
else
    echo ""
    echo "✅ Travel Weather Plotter is running!"
    echo "Press Ctrl+C to stop..."
fi