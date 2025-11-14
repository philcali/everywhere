#!/bin/bash

# ==============================================
# Travel Weather Plotter - Docker Stop Script
# ==============================================

set -e

echo "🛑 Stopping Travel Weather Plotter..."

# Parse command line arguments
ENVIRONMENT="production"
REMOVE_VOLUMES=""
REMOVE_IMAGES=""

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
        --volumes)
            REMOVE_VOLUMES="--volumes"
            shift
            ;;
        --images)
            REMOVE_IMAGES="--rmi all"
            shift
            ;;
        --clean)
            REMOVE_VOLUMES="--volumes"
            REMOVE_IMAGES="--rmi all"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dev, --development    Stop development environment"
            echo "  --prod, --production    Stop production environment (default)"
            echo "  --volumes              Remove volumes (data will be lost!)"
            echo "  --images               Remove images"
            echo "  --clean                Remove volumes and images (full cleanup)"
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
    echo "🔧 Stopping development environment..."
else
    COMPOSE_FILE="docker-compose.yml"
    echo "🏭 Stopping production environment..."
fi

# Stop and remove containers
echo "🛑 Stopping containers..."
docker-compose -f $COMPOSE_FILE down --remove-orphans $REMOVE_VOLUMES $REMOVE_IMAGES

# Additional cleanup if requested
if [ -n "$REMOVE_VOLUMES" ]; then
    echo "⚠️  Removing volumes (data will be lost)..."
fi

if [ -n "$REMOVE_IMAGES" ]; then
    echo "🗑️  Removing images..."
fi

# Clean up dangling images and containers
echo "🧹 Cleaning up dangling resources..."
docker system prune -f

echo ""
echo "✅ Travel Weather Plotter stopped successfully!"

# Show remaining resources
echo ""
echo "📊 Remaining Docker resources:"
echo "Containers:"
docker ps -a --filter "name=travel-weather" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Images:"
docker images --filter "reference=*travel-weather*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""
echo "Volumes:"
docker volume ls --filter "name=travel-weather" --format "table {{.Name}}\t{{.Driver}}"