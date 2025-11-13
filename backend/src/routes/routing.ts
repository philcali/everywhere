import { Router, Request, Response } from 'express';
import { routingService, RoutingError } from '../services/routingService.js';
import { geocodingService, GeocodingError } from '../services/geocodingService.js';
import { TravelMode, TravelConfig } from '@shared/types/travel.js';
import { Location } from '@shared/types/location.js';
import { validateLocationString } from '@shared/utils/validation.js';
import { createErrorResponse, ErrorCode } from '@shared/utils/errorFormatting.js';

const router = Router();

interface RouteRequest {
    source: string;
    destination: string;
    travelMode?: TravelMode;
    customDuration?: number;
    customSpeed?: number;
    weatherUpdateInterval?: number;
    routeOptimization?: boolean;
}

interface RouteResponse {
    route: {
        id: string;
        source: Location;
        destination: Location;
        travelMode: TravelMode;
        waypoints: Array<{
            coordinates: { latitude: number; longitude: number };
            distanceFromStart: number;
            estimatedTimeFromStart: number;
        }>;
        totalDistance: number;
        estimatedDuration: number;
        segments: Array<{
            startPoint: {
                coordinates: { latitude: number; longitude: number };
                distanceFromStart: number;
                estimatedTimeFromStart: number;
            };
            endPoint: {
                coordinates: { latitude: number; longitude: number };
                distanceFromStart: number;
                estimatedTimeFromStart: number;
            };
            distance: number;
            estimatedDuration: number;
            travelMode: TravelMode;
        }>;
    };
    confidence: number;
    warnings?: string[];
}

/**
 * POST /api/route/calculate
 * Calculate route between two locations for all travel modes
 */
router.post('/calculate', async (req: Request, res: Response) => {
    try {
        const {
            source,
            destination,
            travelMode = TravelMode.DRIVING,
            customDuration,
            customSpeed,
            weatherUpdateInterval = 3600,
            routeOptimization = true
        }: RouteRequest = req.body;

        // Validate required fields
        if (!source || !destination) {
            return res.status(400).json(createErrorResponse(
                ErrorCode.MISSING_REQUIRED_FIELD,
                'Source and destination locations are required',
                { source: !!source, destination: !!destination },
                ['Provide both source and destination locations']
            ));
        }

        // Validate travel mode for all supported modes
        if (!Object.values(TravelMode).includes(travelMode)) {
            return res.status(400).json(createErrorResponse(
                ErrorCode.INVALID_TRAVEL_CONFIG,
                `Travel mode ${travelMode} is not supported`,
                { travelMode, supportedModes: Object.values(TravelMode) },
                ['Use one of: driving, walking, cycling, flying, sailing, cruise']
            ));
        }

        // Validate location strings
        const sourceValidation = validateLocationString(source);
        const destValidation = validateLocationString(destination);

        if (!sourceValidation.isValid) {
            return res.status(400).json(createErrorResponse(
                ErrorCode.INVALID_LOCATION,
                'Invalid source location format',
                { location: source, errors: sourceValidation.errors },
                sourceValidation.suggestions || ['Provide a valid location name or address']
            ));
        }

        if (!destValidation.isValid) {
            return res.status(400).json(createErrorResponse(
                ErrorCode.INVALID_LOCATION,
                'Invalid destination location format',
                { location: destination, errors: destValidation.errors },
                destValidation.suggestions || ['Provide a valid location name or address']
            ));
        }

        // Validate custom parameters
        if (customDuration && (customDuration <= 0 || customDuration > 7 * 24 * 3600)) {
            return res.status(400).json(createErrorResponse(
                ErrorCode.OUT_OF_RANGE,
                'Custom duration must be between 1 second and 7 days',
                { customDuration, validRange: '1 to 604800 seconds' },
                ['Provide a duration in seconds between 1 and 604800']
            ));
        }

        if (customSpeed && (customSpeed <= 0 || customSpeed > 2000)) {
            return res.status(400).json(createErrorResponse(
                ErrorCode.OUT_OF_RANGE,
                'Custom speed must be between 0 and 2000 km/h',
                { customSpeed, validRange: '0 to 2000 km/h' },
                ['Provide a realistic speed for the selected travel mode']
            ));
        }

        // Validate speed ranges for specific travel modes
        if (customSpeed) {
            const speedLimits = {
                [TravelMode.WALKING]: { min: 1, max: 15 },
                [TravelMode.CYCLING]: { min: 5, max: 80 },
                [TravelMode.DRIVING]: { min: 10, max: 200 },
                [TravelMode.FLYING]: { min: 200, max: 2000 },
                [TravelMode.SAILING]: { min: 5, max: 50 },
                [TravelMode.CRUISE]: { min: 10, max: 60 }
            };

            const limits = speedLimits[travelMode];
            if (limits && (customSpeed < limits.min || customSpeed > limits.max)) {
                return res.status(400).json(createErrorResponse(
                    ErrorCode.OUT_OF_RANGE,
                    `Custom speed for ${travelMode} must be between ${limits.min} and ${limits.max} km/h`,
                    { customSpeed, travelMode, validRange: `${limits.min} to ${limits.max} km/h` },
                    [`Typical ${travelMode} speeds range from ${limits.min} to ${limits.max} km/h`]
                ));
            }
        }

        // Geocode locations
        let sourceLocation: Location;
        let destinationLocation: Location;

        try {
            const [sourceResult, destResult] = await Promise.all([
                geocodingService.geocodeLocation(source),
                geocodingService.geocodeLocation(destination)
            ]);

            sourceLocation = sourceResult.location;
            destinationLocation = destResult.location;

            // Check geocoding confidence
            if (sourceResult.confidence < 0.5) {
                return res.status(400).json(createErrorResponse(
                    ErrorCode.INVALID_LOCATION,
                    `Low confidence in source location "${source}"`,
                    { location: source, confidence: sourceResult.confidence },
                    sourceResult.suggestions || ['Try a more specific location']
                ));
            }

            if (destResult.confidence < 0.5) {
                return res.status(400).json(createErrorResponse(
                    ErrorCode.INVALID_LOCATION,
                    `Low confidence in destination location "${destination}"`,
                    { location: destination, confidence: destResult.confidence },
                    destResult.suggestions || ['Try a more specific location']
                ));
            }
        } catch (error) {
            if (error instanceof GeocodingError) {
                return res.status(400).json(createErrorResponse(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    error.message,
                    { service: 'geocoding', originalCode: error.code },
                    error.suggestions || ['Please try a different location']
                ));
            }
            throw error; // Re-throw unexpected errors
        }

        // Create travel configuration
        const travelConfig: TravelConfig = {
            mode: travelMode,
            customDuration,
            customSpeed,
            preferences: {
                weatherUpdateInterval,
                routeOptimization
            }
        };

        // Calculate route using the appropriate method based on travel mode
        const routingResult = await routingService.calculateRoute(
            sourceLocation,
            destinationLocation,
            travelConfig
        );

        // Format response
        const response: RouteResponse = {
            route: routingResult.route,
            confidence: routingResult.confidence,
            warnings: routingResult.warnings
        };

        res.json(response);

    } catch (error) {
        console.error('Route calculation error:', error);

        if (error instanceof RoutingError) {
            return res.status(400).json(createErrorResponse(
                ErrorCode.EXTERNAL_SERVICE_ERROR,
                error.message,
                { service: 'routing', originalCode: error.code },
                error.suggestions || ['Please try again with different parameters']
            ));
        }

        // Handle unexpected errors
        res.status(500).json(createErrorResponse(
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            'An unexpected error occurred while calculating the route',
            { service: 'routing' },
            ['Please try again later', 'Contact support if the problem persists']
        ));
    }
});

/**
 * GET /api/route/health
 * Health check endpoint for routing service
 */
router.get('/health', (req: Request, res: Response) => {
    try {
        const routingStats = routingService.getCacheStats();
        const geocodingStats = geocodingService.getCacheStats();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                routing: {
                    status: 'operational',
                    cache: routingStats
                },
                geocoding: {
                    status: 'operational',
                    cache: geocodingStats
                }
            }
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Service health check failed'
        });
    }
});

/**
 * POST /api/route/clear-cache
 * Clear expired cache entries (maintenance endpoint)
 */
router.post('/clear-cache', (req: Request, res: Response) => {
    try {
        routingService.clearExpiredCache();
        geocodingService.clearExpiredCache();

        res.json({
            message: 'Cache cleared successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json(createErrorResponse(
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            'Failed to clear cache',
            { service: 'cache' },
            ['Please try again later']
        ));
    }
});

export default router;