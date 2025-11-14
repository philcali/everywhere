import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { geocodingService, GeocodingError } from './services/geocodingService.js';
import { routingService } from './services/routingService.js';
import { weatherService } from './services/weatherService.js';
import { database } from './database/connection.js';
import { runMigrations, seedDatabase } from './database/migrations.js';
import { JWTService } from './auth/jwt.js';
import { AuthService } from './services/authService.js';
import authRoutes from './routes/auth.js';
import routingRoutes from './routes/routing.js';
import weatherRoutes from './routes/weather.js';
import journalRoutes from './routes/journal.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Request ID middleware
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || 
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const requestId = req.headers['x-request-id'];
  
  console.log(`[${timestamp}] [${requestId}] ${method} ${url} - ${userAgent}`);
  
  // Log response time
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] [${requestId}] ${method} ${url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Security and parsing middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Authentication routes
app.use('/api/auth', authRoutes);

// Routing routes
app.use('/api/route', routingRoutes);

// Weather routes
app.use('/api/weather', weatherRoutes);

// Journal routes
app.use('/api/journal', journalRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connectivity
    let dbStatus = 'ok';
    try {
      await database.get('SELECT 1');
    } catch (error) {
      dbStatus = 'error';
    }

    const health = {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'travel-weather-plotter-backend',
      version: '1.0.0',
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        type: 'sqlite3'
      }
    };

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});



// Geocoding endpoint
app.get('/api/geocode', async (req, res) => {
  try {
    const { location } = req.query;
    const requestId = req.headers['x-request-id'] as string;
    
    if (!location || typeof location !== 'string') {
      return res.status(400).json({
        error: {
          code: 'MISSING_LOCATION_PARAMETER',
          message: 'Location parameter is required',
          timestamp: new Date().toISOString(),
          requestId,
          suggestions: [
            'Provide a location parameter: /api/geocode?location=New York',
            'Location can be an address, city name, or coordinates'
          ]
        }
      });
    }

    // Use the geocoding service
    const result = await geocodingService.geocodeLocation(location);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error) {
    const requestId = req.headers['x-request-id'] as string;
    
    // Handle geocoding-specific errors
    if (error && typeof error === 'object' && 'code' in error) {
      const geocodingError = error as GeocodingError;
      const statusCode = geocodingError.code === 'INVALID_LOCATION_INPUT' ? 400 : 
                        geocodingError.code === 'LOCATION_NOT_FOUND' ? 404 :
                        geocodingError.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 500;
      
      return res.status(statusCode).json({
        error: {
          code: geocodingError.code,
          message: geocodingError.message,
          suggestions: geocodingError.suggestions,
          timestamp: new Date().toISOString(),
          requestId
        }
      });
    }
    
    // Handle unexpected errors
    console.error('Geocoding endpoint error:', error);
    res.status(500).json({
      error: {
        code: 'GEOCODING_ERROR',
        message: 'Failed to process geocoding request',
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  }
});

// Global error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] || 'unknown';
  
  // Log the error with context
  console.error(`[${timestamp}] Error in ${req.method} ${req.url}:`, {
    error: err.message,
    stack: err.stack,
    requestId,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Handle different types of errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        timestamp,
        requestId
      }
    });
  }

  if (err.name === 'SyntaxError' && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
        timestamp,
        requestId
      }
    });
  }

  // Default internal server error
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An internal server error occurred' 
        : err.message,
      timestamp,
      requestId,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
});

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 404 - ${req.method} ${req.url}`);
  
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.url} not found`,
      timestamp,
      availableEndpoints: [
        'GET /api/health',
        'POST /api/route/calculate',
        'GET /api/route/health',
        'POST /api/route/clear-cache',
        'GET /api/geocode',
        'GET /api/weather/current',
        'GET /api/weather/forecast',
        'POST /api/weather/route',
        'GET /api/weather/health',
        'POST /api/auth/register',
        'POST /api/auth/login',
        'POST /api/auth/refresh',
        'POST /api/auth/logout',
        'POST /api/auth/logout-all',
        'POST /api/auth/password-reset',
        'POST /api/auth/password-reset/confirm',
        'GET /api/auth/me',
        'POST /api/journal',
        'GET /api/journal',
        'GET /api/journal/:id',
        'PUT /api/journal/:id',
        'DELETE /api/journal/:id',
        'GET /api/journal/stats',
        'GET /api/journal/tags',
        'GET /api/journal/:id/export',
        'GET /api/journal/export/all',
        'GET /api/journal/search',
        'GET /api/journal/recent'
      ]
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Connect to database
    await database.connect();
    
    // Run migrations
    await runMigrations();
    
    // Seed database in development
    if (process.env.NODE_ENV !== 'production') {
      await seedDatabase();
    }
    
    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Travel Weather Plotter Backend Server started`);
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
      console.log(`💾 Database: Connected and migrated`);
      console.log(`📋 Available endpoints:`);
      console.log(`   GET  /api/health              - Health check`);
      console.log(`   POST /api/route/calculate     - Route calculation`);
      console.log(`   GET  /api/route/health        - Route service health`);
      console.log(`   POST /api/route/clear-cache   - Clear route cache`);
      console.log(`   GET  /api/geocode             - Location geocoding`);
      console.log(`   GET  /api/weather/current     - Current weather`);
      console.log(`   GET  /api/weather/forecast    - Weather forecast`);
      console.log(`   POST /api/weather/route       - Route weather data`);
      console.log(`   GET  /api/weather/health      - Weather service health`);
      console.log(`   POST /api/auth/register       - User registration`);
      console.log(`   POST /api/auth/login          - User login`);
      console.log(`   POST /api/auth/refresh        - Refresh tokens`);
      console.log(`   POST /api/auth/logout         - User logout`);
      console.log(`   POST /api/auth/logout-all     - Logout from all devices`);
      console.log(`   POST /api/auth/password-reset - Request password reset`);
      console.log(`   POST /api/auth/password-reset/confirm - Confirm password reset`);
      console.log(`   GET  /api/auth/me             - Get user profile`);
      console.log(`   POST /api/journal             - Save journey`);
      console.log(`   GET  /api/journal             - Get journeys`);
      console.log(`   GET  /api/journal/:id         - Get specific journey`);
      console.log(`   PUT  /api/journal/:id         - Update journey`);
      console.log(`   DELETE /api/journal/:id       - Delete journey`);
      console.log(`   GET  /api/journal/stats       - Get journey statistics`);
      console.log(`   GET  /api/journal/tags        - Get user tags`);
      console.log(`   GET  /api/journal/:id/export  - Export journey`);
      console.log(`   GET  /api/journal/export/all  - Export all journeys`);
      console.log(`   GET  /api/journal/search      - Search journeys`);
      console.log(`   GET  /api/journal/recent      - Get recent journeys`);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

const serverPromise = startServer();

// Set up periodic cleanup tasks (every hour)
const cleanupInterval = setInterval(async () => {
  try {
    // Clear expired geocoding cache
    geocodingService.clearExpiredCache();
    
    // Clear expired routing cache
    routingService.clearExpiredCache();
    
    // Clear expired weather cache
    weatherService.clearExpiredCache();
    
    // Clean up expired refresh tokens
    const expiredTokens = await JWTService.cleanupExpiredTokens();
    if (expiredTokens > 0) {
      console.log(`🧹 Cleaned up ${expiredTokens} expired refresh tokens`);
    }

    // Clean up expired password reset tokens
    const expiredResetTokens = await AuthService.cleanupExpiredResetTokens();
    if (expiredResetTokens > 0) {
      console.log(`🧹 Cleaned up ${expiredResetTokens} expired password reset tokens`);
    }
  } catch (error) {
    console.error('Error during periodic cleanup:', error);
  }
}, 60 * 60 * 1000);

// Add cache stats to health check
app.get('/api/health/cache', (req, res) => {
  try {
    const cacheStats = geocodingService.getCacheStats();
    res.json({
      status: 'ok',
      cache: cacheStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'CACHE_STATS_ERROR',
        message: 'Failed to retrieve cache statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  clearInterval(cleanupInterval);
  
  const server = await serverPromise;
  server.close(async () => {
    try {
      await database.close();
      console.log('✅ Database connection closed');
      console.log('✅ Server closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  clearInterval(cleanupInterval);
  
  const server = await serverPromise;
  server.close(async () => {
    try {
      await database.close();
      console.log('✅ Database connection closed');
      console.log('✅ Server closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});