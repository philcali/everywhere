import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { geocodingService, GeocodingError } from './services/geocodingService.js';

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'travel-weather-plotter-backend',
      version: '1.0.0',
      uptime: process.uptime()
    });
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

// Route calculation endpoint
app.post('/api/route', (req, res) => {
  try {
    // Basic request validation
    const { source, destination, travelMode, duration, speed } = req.body;
    
    if (!source || !destination) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Source and destination are required',
          timestamp: new Date().toISOString(),
          details: { source: !!source, destination: !!destination }
        }
      });
    }

    // Placeholder response - actual implementation will be in later tasks
    res.json({ 
      message: 'Route calculation endpoint - to be implemented',
      requestData: { source, destination, travelMode, duration, speed },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'ROUTE_CALCULATION_ERROR',
        message: 'Failed to process route calculation request',
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
        'POST /api/route',
        'GET /api/geocode'
      ]
    }
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Travel Weather Plotter Backend Server started`);
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /api/health   - Health check`);
  console.log(`   POST /api/route    - Route calculation`);
  console.log(`   GET  /api/geocode  - Location geocoding`);
});

// Set up periodic cache cleanup (every hour)
const cacheCleanupInterval = setInterval(() => {
  geocodingService.clearExpiredCache();
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
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  clearInterval(cacheCleanupInterval);
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  clearInterval(cacheCleanupInterval);
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
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