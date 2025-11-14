#!/bin/bash

# ==============================================
# Travel Weather Plotter - Docker Logs Script
# ==============================================

set -e

# Parse command line arguments
ENVIRONMENT="production"
SERVICE=""
FOLLOW=""
TAIL="100"

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
        -f|--follow)
            FOLLOW="-f"
            shift
            ;;
        --tail)
            TAIL="$2"
            shift 2
            ;;
        --app)
            SERVICE="app"
            shift
            ;;
        --nginx)
            SERVICE="nginx"
            shift
            ;;
        --redis)
            SERVICE="redis"
            shift
            ;;
        --postgres)
            SERVICE="postgres-dev"
            shift
            ;;
        --mailhog)
            SERVICE="mailhog"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS] [SERVICE]"
            echo ""
            echo "Options:"
            echo "  --dev, --development    View development environment logs"
            echo "  --prod, --production    View production environment logs (default)"
            echo "  -f, --follow           Follow log output"
            echo "  --tail N               Number of lines to show from end of logs (default: 100)"
            echo ""
            echo "Services:"
            echo "  --app                  Application logs"
            echo "  --nginx                Nginx logs (production only)"
            echo "  --redis                Redis logs"
            echo "  --postgres             PostgreSQL logs (development only)"
            echo "  --mailhog              MailHog logs (development only)"
            echo ""
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --dev --app -f      # Follow development app logs"
            echo "  $0 --prod --nginx      # View production nginx logs"
            echo "  $0 --follow            # Follow all logs"
            exit 0
            ;;
        *)
            if [ -z "$SERVICE" ]; then
                SERVICE="$1"
            else
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
            fi
            shift
            ;;
    esac
done

# Set compose file based on environment
if [ "$ENVIRONMENT" = "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    echo "🔧 Viewing development environment logs..."
    if [ "$SERVICE" = "app" ]; then
        SERVICE="app-dev"
    fi
else
    COMPOSE_FILE="docker-compose.yml"
    echo "🏭 Viewing production environment logs..."
fi

# Check if containers are running
if ! docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
    echo "❌ No containers are currently running."
    echo "Start the application first with: ./docker-scripts/start.sh"
    exit 1
fi

# Show logs
if [ -n "$SERVICE" ]; then
    echo "📋 Showing logs for service: $SERVICE"
    docker-compose -f $COMPOSE_FILE logs --tail=$TAIL $FOLLOW $SERVICE
else
    echo "📋 Showing logs for all services"
    docker-compose -f $COMPOSE_FILE logs --tail=$TAIL $FOLLOW
fi