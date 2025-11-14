#!/bin/bash

# ==============================================
# Travel Weather Plotter - Docker Backup Script
# ==============================================

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="travel-weather-backup-$TIMESTAMP"

echo "💾 Creating backup: $BACKUP_NAME"

# Parse command line arguments
ENVIRONMENT="production"
INCLUDE_UPLOADS=""

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
        --include-uploads)
            INCLUDE_UPLOADS="true"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dev, --development    Backup development environment"
            echo "  --prod, --production    Backup production environment (default)"
            echo "  --include-uploads       Include uploads directory in backup"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Backup includes:"
            echo "  - Database files"
            echo "  - Configuration files"
            echo "  - Upload files (if --include-uploads is specified)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set compose file and volume names based on environment
if [ "$ENVIRONMENT" = "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    DATA_VOLUME="travel-weather-dev-data"
    UPLOADS_VOLUME="travel-weather-dev-uploads"
    echo "🔧 Backing up development environment..."
else
    COMPOSE_FILE="docker-compose.yml"
    DATA_VOLUME="travel-weather-data"
    UPLOADS_VOLUME="travel-weather-uploads"
    echo "🏭 Backing up production environment..."
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup archive
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME.tar.gz"

echo "📁 Creating backup directory structure..."
TEMP_BACKUP_DIR="/tmp/$BACKUP_NAME"
mkdir -p "$TEMP_BACKUP_DIR"

# Backup database
echo "💾 Backing up database..."
if docker volume inspect "$DATA_VOLUME" >/dev/null 2>&1; then
    docker run --rm \
        -v "$DATA_VOLUME":/source:ro \
        -v "$TEMP_BACKUP_DIR":/backup \
        alpine:latest \
        sh -c "cd /source && tar czf /backup/database.tar.gz ."
    echo "✅ Database backup completed"
else
    echo "⚠️  Database volume not found: $DATA_VOLUME"
fi

# Backup uploads if requested
if [ "$INCLUDE_UPLOADS" = "true" ]; then
    echo "📸 Backing up uploads..."
    if docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
        docker run --rm \
            -v "$UPLOADS_VOLUME":/source:ro \
            -v "$TEMP_BACKUP_DIR":/backup \
            alpine:latest \
            sh -c "cd /source && tar czf /backup/uploads.tar.gz ."
        echo "✅ Uploads backup completed"
    else
        echo "⚠️  Uploads volume not found: $UPLOADS_VOLUME"
    fi
fi

# Backup configuration files
echo "⚙️  Backing up configuration files..."
cp -r .env* "$TEMP_BACKUP_DIR/" 2>/dev/null || echo "⚠️  No .env files found"
cp docker-compose*.yml "$TEMP_BACKUP_DIR/" 2>/dev/null || echo "⚠️  No docker-compose files found"
cp nginx.conf "$TEMP_BACKUP_DIR/" 2>/dev/null || echo "⚠️  No nginx.conf found"

# Create metadata file
echo "📝 Creating backup metadata..."
cat > "$TEMP_BACKUP_DIR/backup-info.txt" << EOF
Travel Weather Plotter Backup
=============================

Backup Date: $(date)
Environment: $ENVIRONMENT
Backup Name: $BACKUP_NAME

Contents:
- Database: $([ -f "$TEMP_BACKUP_DIR/database.tar.gz" ] && echo "✅ Included" || echo "❌ Not found")
- Uploads: $([ -f "$TEMP_BACKUP_DIR/uploads.tar.gz" ] && echo "✅ Included" || echo "❌ Not included")
- Configuration: ✅ Included

Docker Volumes:
- Data Volume: $DATA_VOLUME
- Uploads Volume: $UPLOADS_VOLUME

Restore Instructions:
1. Stop the application: ./docker-scripts/stop.sh --$ENVIRONMENT
2. Extract backup: tar -xzf $BACKUP_NAME.tar.gz
3. Restore volumes using the restore script: ./docker-scripts/restore.sh --$ENVIRONMENT $BACKUP_NAME
4. Start the application: ./docker-scripts/start.sh --$ENVIRONMENT
EOF

# Create final backup archive
echo "📦 Creating final backup archive..."
cd /tmp
tar -czf "$BACKUP_PATH" "$BACKUP_NAME"
cd - > /dev/null

# Cleanup temporary directory
rm -rf "$TEMP_BACKUP_DIR"

# Show backup information
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo ""
echo "✅ Backup completed successfully!"
echo ""
echo "📊 Backup Information:"
echo "  Name: $BACKUP_NAME"
echo "  Path: $BACKUP_PATH"
echo "  Size: $BACKUP_SIZE"
echo "  Environment: $ENVIRONMENT"
echo ""
echo "📋 To restore this backup:"
echo "  ./docker-scripts/restore.sh --$ENVIRONMENT $BACKUP_NAME"
echo ""

# List recent backups
echo "📚 Recent backups:"
ls -lah "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -5 || echo "No previous backups found"