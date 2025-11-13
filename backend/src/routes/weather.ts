import { Router, Request, Response } from 'express';
import { weatherService, WeatherError } from '../services/weatherService.js';
import { Location } from '@shared/types/location.js';
import { formatErrorResponse } from '@shared/utils/errorFormatting.js';

const router = Router();

/**
 * GET /api/weather/current
 * Get current weather for a specific location
 */
router.get('/current', async (req: Request, res: Response) => {
    try {
        const { lat, lon, name, address } = req.query;

        if (!lat || !lon) {
            return res.status(400).json(formatErrorResponse(
                'MISSING_COORDINATES',
                'Latitude and longitude are required',
                ['Provide lat and lon query parameters', 'Example: ?lat=40.7128&lon=-74.0060']
            ));
        }

        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lon as string);

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json(formatErrorResponse(
                'INVALID_COORDINATES',
                'Invalid latitude or longitude values',
                ['Ensure lat and lon are valid numbers', 'Latitude: -90 to 90, Longitude: -180 to 180']
            ));
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json(formatErrorResponse(
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
            return res.status(statusCode).json(formatErrorResponse(
                error.code,
                error.message,
                error.suggestions
            ));
        }

        res.status(500).json(formatErrorResponse(
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
            return res.status(400).json(formatErrorResponse(
                'MISSING_COORDINATES',
                'Latitude and longitude are required',
                ['Provide lat and lon query parameters']
            ));
        }

        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lon as string);

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json(formatErrorResponse(
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
                return res.status(400).json(formatErrorResponse(
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
            return res.status(statusCode).json(formatErrorResponse(
                error.code,
                error.message,
                error.suggestions
            ));
        }

        res.status(500).json(formatErrorResponse(
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
            return res.status(400).json(formatErrorResponse(
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
                return res.status(400).json(formatErrorResponse(
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
                    return res.status(400).json(formatErrorResponse(
                        'INVALID_TIMESTAMP',
                        `Invalid timestamp at index ${i}`,
                        ['Use ISO 8601 format for timestamps']
                    ));
                }
                validatedTimestamps.push(timestamp);
            }

            if (validatedTimestamps.length !== validatedLocations.length) {
                return res.status(400).json(formatErrorResponse(
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
            return res.status(statusCode).json(formatErrorResponse(
                error.code,
                error.message,
                error.suggestions
            ));
        }

        res.status(500).json(formatErrorResponse(
            'INTERNAL_SERVER_ERROR',
            'An unexpected error occurred while retrieving route weather data',
            ['Please try again later', 'Contact support if the problem persists']
        ));
    }
});

/**
 * GET /api/weather/health
 * Health check endpoint for weather service
 */
router.get('/health', async (req: Request, res: Response) => {
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