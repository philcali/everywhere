import { Router, Request, Response } from 'express';
import { weatherService, WeatherError } from '../services/weatherService.js';
import { Location } from '@shared/types/location.js';
import { createErrorResponse } from '@shared/utils/errorFormatting.js';

const router = Router();

/**
 * GET /api/weather/current
 * Get current weather for a specific location
 */
router.get('/current', async (req: Request, res: Response) => {
    try {
        const { lat, lon, name, address } = req.query;

        if (!lat || !lon) {
            return res.status(400).json(createErrorResponse(
                'MISSING_COORDINATES',
                'Latitude and longitude are required',
                ['Provide lat and lon query parameters', 'Example: ?lat=40.7128&lon=-74.0060']
            ));
        }

        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lon as string);

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json(createErrorResponse(
                'INVALID_COORDINATES',
                'Invalid latitude or longitude values',
                ['Ensure lat and lon are valid numbers', 'Latitude: -90 to 90, Longitude: -180 to 180']
            ));
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json(createErrorResponse(
                'COORDINATES_OUT_OF_RANGE',
                'Coordinates are out of valid range',
                ['Latitude must be between -90 and 90', 'Longitude must be between -180 and 180']
            ));
        }

        const location: Location = {
            name: (name as string) || `${latitude}, ${longitude}`,
            coordinates: { latitude, longitude },
            address: address as string
        };

        const weather = await weatherService.getCurrentWeather(location);

        res.json({
            success: true,
            data: weather,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Weather API error:', error);

        if (error instanceof WeatherError) {
            const statusCode = getStatusCodeForWeatherError(error.code);
            return res.status(statusCode).json(createErrorResponse(
                error.code as any,
                error.message,
                error.suggestions
            ));
        }

        res.status(500).json(createErrorResponse(
            'INTERNAL_SERVER_ERROR',
            'An unexpected error occurred while retrieving weather data',
            ['Please try again later', 'Contact support if the problem persists']
        ));
    }
});

/**
 * GET /api/weather/forecast
 * Get weather forecast for a specific location and time
 */
router.get('/forecast', async (req: Request, res: Response) => {
    try {
        const { lat, lon, name, address, timestamp } = req.query;

        if (!lat || !lon) {
            return res.status(400).json(createErrorResponse(
                'MISSING_COORDINATES',
                'Latitude and longitude are required',
                ['Provide lat and lon query parameters']
            ));
        }

        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lon as string);

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json(createErrorResponse(
                'INVALID_COORDINATES',
                'Invalid latitude or longitude values',
                ['Ensure lat and lon are valid numbers']
            ));
        }

        const location: Location = {
            name: (name as string) || `${latitude}, ${longitude}`,
            coordinates: { latitude, longitude },
            address: address as string
        };

        let targetTimestamp: Date | undefined;
        if (timestamp) {
            targetTimestamp = new Date(timestamp as string);
            if (isNaN(targetTimestamp.getTime())) {
                return res.status(400).json(createErrorResponse(
                    'INVALID_TIMESTAMP',
                    'Invalid timestamp format',
                    ['Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ', 'Example: 2023-12-25T12:00:00.000Z']
                ));
            }
        }

        const weather = await weatherService.getWeatherForLocationAndTime(location, targetTimestamp);

        res.json({
            success: true,
            data: weather,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Weather forecast API error:', error);

        if (error instanceof WeatherError) {
            const statusCode = getStatusCodeForWeatherError(error.code);
            return res.status(statusCode).json(createErrorResponse(
                error.code as any,
                error.message,
                error.suggestions
            ));
        }

        res.status(500).json(createErrorResponse(
            'INTERNAL_SERVER_ERROR',
            'An unexpected error occurred while retrieving weather forecast',
            ['Please try again later', 'Contact support if the problem persists']
        ));
    }
});

/**
 * POST /api/weather/route
 * Get weather forecasts for multiple locations along a route
 */
router.post('/route', async (req: Request, res: Response) => {
    try {
        const { locations, timestamps } = req.body;

        if (!locations || !Array.isArray(locations) || locations.length === 0) {
            return res.status(400).json(createErrorResponse(
                'MISSING_LOCATIONS',
                'Locations array is required and must not be empty',
                ['Provide an array of location objects with coordinates', 'Each location should have latitude and longitude']
            ));
        }

        // Validate locations
        const validatedLocations: Location[] = [];
        for (let i = 0; i < locations.length; i++) {
            const loc = locations[i];
            if (!loc.coordinates || typeof loc.coordinates.latitude !== 'number' || typeof loc.coordinates.longitude !== 'number') {
                return res.status(400).json(createErrorResponse(
                    'INVALID_LOCATION_FORMAT',
                    `Invalid location format at index ${i}`,
                    ['Each location must have coordinates.latitude and coordinates.longitude as numbers']
                ));
            }

            validatedLocations.push({
                name: loc.name || `Location ${i + 1}`,
                coordinates: {
                    latitude: loc.coordinates.latitude,
                    longitude: loc.coordinates.longitude
                },
                address: loc.address
            });
        }

        // Validate timestamps if provided
        let validatedTimestamps: Date[] | undefined;
        if (timestamps && Array.isArray(timestamps)) {
            validatedTimestamps = [];
            for (let i = 0; i < timestamps.length; i++) {
                const timestamp = new Date(timestamps[i]);
                if (isNaN(timestamp.getTime())) {
                    return res.status(400).json(createErrorResponse(
                        'INVALID_TIMESTAMP',
                        `Invalid timestamp at index ${i}`,
                        ['Use ISO 8601 format for timestamps']
                    ));
                }
                validatedTimestamps.push(timestamp);
            }

            if (validatedTimestamps.length !== validatedLocations.length) {
                return res.status(400).json(createErrorResponse(
                    'TIMESTAMP_LOCATION_MISMATCH',
                    'Number of timestamps must match number of locations',
                    ['Provide the same number of timestamps as locations', 'Or omit timestamps to use current time']
                ));
            }
        }

        const weatherForecasts = await weatherService.getRouteWeatherForecast(validatedLocations, validatedTimestamps);

        res.json({
            success: true,
            data: weatherForecasts,
            timestamp: new Date().toISOString(),
            meta: {
                locationCount: validatedLocations.length,
                hasTimestamps: !!validatedTimestamps
            }
        });

    } catch (error) {
        console.error('Route weather API error:', error);

        if (error instanceof WeatherError) {
            const statusCode = getStatusCodeForWeatherError(error.code);
            return res.status(statusCode).json(createErrorResponse(
                error.code as any,
                error.message,
                error.suggestions
            ));
        }

        res.status(500).json(createErrorResponse(
            'INTERNAL_SERVER_ERROR',
            'An unexpected error occurred while retrieving route weather data',
            ['Please try again later', 'Contact support if the problem persists']
        ));
    }
});

/**
 * POST /api/weather/route-forecast
 * Get comprehensive weather forecast for an entire route with interpolation
 */
router.post('/route-forecast', async (req: Request, res: Response) => {
    try {
        const { route, startTime, intervalKm, includeInterpolation } = req.body;

        if (!route) {
            return res.status(400).json(createErrorResponse(
                'MISSING_ROUTE',
                'Route object is required',
                ['Provide a route object with waypoints', 'Route must include source, destination, and waypoints']
            ));
        }

        if (!route.waypoints || !Array.isArray(route.waypoints) || route.waypoints.length === 0) {
            return res.status(400).json(createErrorResponse(
                'INVALID_ROUTE',
                'Route must contain waypoints',
                ['Ensure route has waypoints array with at least one waypoint', 'Each waypoint should have coordinates and timing information']
            ));
        }

        // Validate route structure
        if (!route.source || !route.destination || !route.travelMode) {
            return res.status(400).json(createErrorResponse(
                'INCOMPLETE_ROUTE',
                'Route must include source, destination, and travelMode',
                ['Provide complete route information', 'Include source and destination locations', 'Specify travel mode']
            ));
        }

        let parsedStartTime: Date | undefined;
        if (startTime) {
            parsedStartTime = new Date(startTime);
            if (isNaN(parsedStartTime.getTime())) {
                return res.status(400).json(createErrorResponse(
                    'INVALID_START_TIME',
                    'Invalid start time format',
                    ['Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ']
                ));
            }
        }

        const routeWeatherForecast = await weatherService.getRouteWeatherForecastWithInterpolation({
            route,
            startTime: parsedStartTime,
            intervalKm: intervalKm ? parseFloat(intervalKm) : undefined,
            includeInterpolation: includeInterpolation !== false // Default to true
        });

        res.json({
            success: true,
            data: routeWeatherForecast,
            timestamp: new Date().toISOString(),
            meta: {
                routeDistance: route.totalDistance,
                routeDuration: route.estimatedDuration,
                travelMode: route.travelMode,
                interpolationEnabled: includeInterpolation !== false,
                samplingInterval: intervalKm || 'auto'
            }
        });

    } catch (error) {
        console.error('Route weather forecast API error:', error);

        if (error instanceof WeatherError) {
            const statusCode = getStatusCodeForWeatherError(error.code);
            return res.status(statusCode).json(createErrorResponse(
                error.code as any,
                error.message,
                error.suggestions
            ));
        }

        res.status(500).json(createErrorResponse(
            'INTERNAL_SERVER_ERROR',
            'An unexpected error occurred while retrieving route weather forecast',
            ['Please try again later', 'Contact support if the problem persists']
        ));
    }
});

/**
 * POST /api/weather/timeline
 * Get weather timeline for a route with specific time intervals
 */
router.post('/timeline', async (req: Request, res: Response) => {
    try {
        const { route, startTime, timeIntervalMinutes } = req.body;

        if (!route) {
            return res.status(400).json(createErrorResponse(
                'MISSING_ROUTE',
                'Route object is required',
                ['Provide a route object with waypoints and timing information']
            ));
        }

        if (!route.waypoints || !Array.isArray(route.waypoints) || route.waypoints.length === 0) {
            return res.status(400).json(createErrorResponse(
                'INVALID_ROUTE',
                'Route must contain waypoints',
                ['Ensure route has waypoints array with timing information']
            ));
        }

        let parsedStartTime = new Date();
        if (startTime) {
            parsedStartTime = new Date(startTime);
            if (isNaN(parsedStartTime.getTime())) {
                return res.status(400).json(createErrorResponse(
                    'INVALID_START_TIME',
                    'Invalid start time format',
                    ['Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ']
                ));
            }
        }

        const interval = timeIntervalMinutes ? parseInt(timeIntervalMinutes) : 60;
        if (interval <= 0 || interval > 1440) { // Max 24 hours
            return res.status(400).json(createErrorResponse(
                'INVALID_TIME_INTERVAL',
                'Time interval must be between 1 and 1440 minutes',
                ['Provide a reasonable time interval', 'Default is 60 minutes (1 hour)']
            ));
        }

        const timeline = await weatherService.getWeatherTimeline(route, parsedStartTime, interval);

        res.json({
            success: true,
            data: timeline,
            timestamp: new Date().toISOString(),
            meta: {
                routeDistance: route.totalDistance,
                routeDuration: route.estimatedDuration,
                travelMode: route.travelMode,
                startTime: parsedStartTime.toISOString(),
                timeInterval: interval,
                timelinePoints: timeline.length
            }
        });

    } catch (error) {
        console.error('Weather timeline API error:', error);

        if (error instanceof WeatherError) {
            const statusCode = getStatusCodeForWeatherError(error.code);
            return res.status(statusCode).json(createErrorResponse(
                error.code as any,
                error.message,
                error.suggestions
            ));
        }

        res.status(500).json(createErrorResponse(
            'INTERNAL_SERVER_ERROR',
            'An unexpected error occurred while retrieving weather timeline',
            ['Please try again later', 'Contact support if the problem persists']
        ));
    }
});

/**
 * GET /api/weather/health
 * Health check endpoint for weather service
 */
router.get('/health', async (_req: Request, res: Response) => {
    try {
        const cacheStats = weatherService.getCacheStats();
        
        res.json({
            success: true,
            service: 'weather',
            status: 'healthy',
            cache: cacheStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Weather health check error:', error);
        res.status(500).json({
            success: false,
            service: 'weather',
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Map weather error codes to HTTP status codes
 */
function getStatusCodeForWeatherError(errorCode: string): number {
    switch (errorCode) {
        case 'INVALID_INPUT':
        case 'MISSING_COORDINATES':
        case 'INVALID_COORDINATES':
        case 'COORDINATES_OUT_OF_RANGE':
        case 'INVALID_TIMESTAMP':
        case 'MISSING_LOCATIONS':
        case 'INVALID_LOCATION_FORMAT':
        case 'TIMESTAMP_LOCATION_MISMATCH':
        case 'MISSING_ROUTE':
        case 'INVALID_ROUTE':
        case 'INCOMPLETE_ROUTE':
        case 'INVALID_START_TIME':
        case 'INVALID_TIME_INTERVAL':
        case 'NO_FORECAST_DATA':
            return 400; // Bad Request
        case 'INVALID_API_KEY':
            return 401; // Unauthorized
        case 'RATE_LIMIT_EXCEEDED':
            return 429; // Too Many Requests
        case 'API_REQUEST_FAILED':
        case 'WEATHER_SERVICE_ERROR':
        case 'WEATHER_FORECAST_ERROR':
        default:
            return 500; // Internal Server Error
    }
}

export default router;