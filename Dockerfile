# ==============================================
# Travel Weather Plotter - Production Dockerfile
# ==============================================

# Use Node.js 22 Alpine as base image for smaller size
FROM node:22-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# ==============================================
# Dependencies Stage
# ==============================================
FROM base AS dependencies

# Install all dependencies (including devDependencies for building)
RUN npm ci --include=dev
RUN cd shared && npm ci --include=dev
RUN cd backend && npm ci --include=dev
RUN cd frontend && npm ci --include=dev

# ==============================================
# Build Stage
# ==============================================
FROM dependencies AS build

# Copy source code
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY tsconfig.json ./

# Build all packages
RUN npm run build:shared
RUN npm run build:backend
RUN npm run build:frontend

# ==============================================
# Production Dependencies Stage
# ==============================================
FROM base AS prod-deps

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts
RUN cd shared && npm ci --only=production --ignore-scripts
RUN cd backend && npm ci --only=production --ignore-scripts

# ==============================================
# Production Stage
# ==============================================
FROM node:18-alpine AS production

# Set NODE_ENV to production
ENV NODE_ENV=production
ENV PORT=3001

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache sqlite

# Copy production dependencies
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /app/shared/node_modules ./shared/node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/shared/dist ./shared/dist
COPY --from=build --chown=nodejs:nodejs /app/backend/dist ./backend/dist
COPY --from=build --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist

# Copy package.json files
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs shared/package*.json ./shared/
COPY --chown=nodejs:nodejs backend/package*.json ./backend/

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

# Create uploads directory
RUN mkdir -p /app/uploads && chown nodejs:nodejs /app/uploads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "backend/dist/server.js"]