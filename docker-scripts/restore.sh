#!/bin/bash

# ==============================================
# Travel Weather Plotter - Docker Restore Script
# ==============================================

set -e

# Configuration
BACKUP_DIR="./backups"

echo "🔄 Travel Weather Plotter - Restore from Backup"

# Parse command line arguments
ENVIRONMENT="production"
BACKUP_NAME=""
FORCE=""

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
        --force)
            FORCE="true"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS] BACKUP_NAME"
            echo ""
            echo "Options:"
            echo "  --dev, --development    Restore to development environment"
            echo "  --prod, --production    Restore to production environment (default)"
            echo "  --force                Force restore without confirmation"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Arguments:"
            echo "  BACKUP_NAME            Name of the backup to restore (without .tar.gz)"
            echo ""
            echo "Examples:"
            echo "  $0 travel-weather-backup-20240115_143022"
            echo "  $0 --dev travel-weather-backup-20240115_143022"
            echo ""
            echo "Available backups:"
            ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | sed 's|.*/||' | sed 's|\.tar\.gz$||' || echo "  No backups found"
            exit 0
            ;;
        *)
            if [ -z "$BACKUP_NAME" ]; then
                BACKUP_NAME="$1"
            else
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
            fi
            shift
            ;;
    esac
done

# Check if backup name is provided
if [ -z "$BACKUP_NAME" ]; then
    echo "❌ Error: Backup name is required"
    echo ""
    echo "Available backups:"
    ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | sed 's|.*/||' | sed 's|\.tar\.gz$||' || echo "  No backups found"
    echo ""
    echo "Use --help for usage information"
    exit 1
fi

# Set compose file and volume names based on environment
if [ "$ENVIRONMENT" = "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    DATA_VOLUME="travel-weather-dev-data"
    UPLOADS_VOLUME="travel-weather-dev-uploads"
    echo "🔧 Restoring to development environment..."
else
    COMPOSE_FILE="docker-compose.yml"
    DATA_VOLUME="travel-weather-data"
    UPLOADS_VOLUME="travel-weather-uploads"
    echo "🏭 Restoring to production environment..."
fi

# Check if backup file exists
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME.tar.gz"
if [ ! -f "$BACKUP_PATH" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_PATH"
    echo ""
    echo "Available backups:"
    ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | sed 's|.*/||' | sed 's|\.tar\.gz$||' || echo "  No backups found"
    exit 1
fi

# Show backup information
echo ""
echo "📊 Backup Information:"
echo "  File: $BACKUP_PATH"
echo "  Size: $(du -h "$BACKUP_PATH" | cut -f1)"
echo "  Environment: $ENVIRONMENT"
echo ""

# Extract and show backup metadata
TEMP_RESTORE_DIR="/tmp/restore-$BACKUP_NAME"
mkdir -p "$TEMP_RESTORE_DIR"
tar -xzf "$BACKUP_PATH" -C "$TEMP_RESTORE_DIR"

if [ -f "$TEMP_RESTORE_DIR/$BACKUP_NAME/backup-info.txt" ]; then
    echo "📋 Backup Details:"
    cat "$TEMP_RESTORE_DIR/$BACKUP_NAME/backup-info.txt"
    echo ""
fi

# Confirmation prompt
if [ "$FORCE" != "true" ]; then
    echo "⚠️  WARNING: This will replace all current data!"
    echo ""
    echo "This restore will:"
    echo "  - Stop all running containers"
    echo "  - Remove existing volumes (DATA WILL BE LOST!)"
    echo "  - Restore data from backup"
    echo "  - Restart the application"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "❌ Restore cancelled"
        rm -rf "$TEMP_RESTORE_DIR"
        exit 1
    fi
fi

echo ""
echo "🔄 Starting restore process..."

# Stop containers
echo "🛑 Stopping containers..."
docker-compose -f $COMPOSE_FILE down --remove-orphans

# Remove existing volumes
echo "🗑️  Removing existing volumes..."
docker volume rm "$DATA_VOLUME" 2>/dev/null || echo "Volume $DATA_VOLUME not found"
docker volume rm "$UPLOADS_VOLUME" 2>/dev/null || echo "Volume $UPLOADS_VOLUME not found"

# Create new volumes
echo "📁 Creating new volumes..."
docker volume create "$DATA_VOLUME"
docker volume create "$UPLOADS_VOLUME"

# Restore database
if [ -f "$TEMP_RESTORE_DIR/$BACKUP_NAME/database.tar.gz" ]; then
    echo "💾 Restoring database..."
    docker run --rm \
        -v "$DATA_VOLUME":/target \
        -v "$TEMP_RESTORE_DIR/$BACKUP_NAME":/backup:ro \
        alpine:latest \
        sh -c "cd /target && tar -xzf /backup/database.tar.gz"
    echo "✅ Database restored"
else
    echo "⚠️  No database backup found in archive"
fi

# Restore uploads
if [ -f "$TEMP_RESTORE_DIR/$BACKUP_NAME/uploads.tar.gz" ]; then
    echo "📸 Restoring uploads..."
    docker run --rm \
        -v "$UPLOADS_VOLUME":/target \
        -v "$TEMP_RESTORE_DIR/$BACKUP_NAME":/backup:ro \
        alpine:latest \
        sh -c "cd /target && tar -xzf /backup/uploads.tar.gz"
    echo "✅ Uploads restored"
else
    echo "ℹ️  No uploads backup found in archive"
fi

# Restore configuration files
echo "⚙️  Restoring configuration files..."
if [ -f "$TEMP_RESTORE_DIR/$BACKUP_NAME/.env" ]; then
    cp "$TEMP_RESTORE_DIR/$BACKUP_NAME/.env" .env.restored
    echo "✅ Environment file restored as .env.restored (review before using)"
fi

# Cleanup temporary directory
rm -rf "$TEMP_RESTORE_DIR"

echo ""
echo "✅ Restore completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Review restored configuration files"
echo "2. Start the application: ./docker-scripts/start.sh --$ENVIRONMENT"
echo "3. Verify that everything is working correctly"
echo ""
echo "📊 Restored volumes:"
echo "  Data: $DATA_VOLUME"
echo "  Uploads: $UPLOADS_VOLUME"