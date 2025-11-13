import { Location, Waypoint } from '@shared/types/location.js';
import { Route, RouteSegment } from '@shared/types/route.js';
import { TravelMode, TravelConfig } from '@shared/types/travel.js';
import { validateCoordinates } from '@shared/utils/validation.js';

export interface RoutingResult {
    route: Route;
    confidence: number;
    warnings?: string[];
}

export class RoutingError extends Error {
    public code: string;
    public suggestions?: string[];

    constructor(code: string, message: string, suggestions?: string[]) {
        super(message);
        this.name = 'RoutingError';
        this.code = code;
        this.suggestions = suggestions;
    }
}

interface CacheEntry {
    result: RoutingResult;
    timestamp: number;
    ttl: number;
}

interface ExternalRoutingResponse {
    routes: Array<{
        legs: Array<{
            distance: { value: number; text: string };
            duration: { value: number; text: string };
            steps: Array<{
                distance: { value: number };
                duration: { value: number };
                start_location: { lat: number; lng: number };
                end_location: { lat: number; lng: number };
                polyline: { points: string };
            }>;
        }>;
        overview_polyline: { points: string };
        summary: string;
        warnings?: string[];
    }>;
    status: string;
}

// Default speeds in km/h for different travel modes
const DEFAULT_SPEEDS = {
    [TravelMode.DRIVING]: 60,
    [TravelMode.WALKING]: 5,
    [TravelMode.CYCLING]: 20,
    [TravelMode.FLYING]: 800,
    [TravelMode.SAILING]: 15,
    [TravelMode.CRUISE]: 25
};

// Waypoint intervals in kilometers for different travel modes
const WAYPOINT_INTERVALS = {
    [TravelMode.DRIVING]: 50,
    [TravelMode.WALKING]: 5,
    [TravelMode.CYCLING]: 20,
    [TravelMode.FLYING]: 200,
    [TravelMode.SAILING]: 100,
    [TravelMode.CRUISE]: 100
};

export class RoutingService {
    private cache = new Map<string, CacheEntry>();
    private readonly apiKey: string;
    private readonly baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';
    private readonly cacheTTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    private readonly maxCacheSize = 500;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.ROUTING_API_KEY || process.env.GEOCODING_API_KEY || '';
        if (!this.apiKey) {
            console.warn('⚠️  Routing API key not provided. Service will use mock data.');
        }
    }

    /**
     * Calculate route for land travel modes (driving, walking, cycling)
     */
    async calculateLandRoute(
        source: Location,
        destination: Location,
        travelConfig: TravelConfig
    ): Promise<RoutingResult> {
        // Validate that this is a land travel mode
        if (![TravelMode.DRIVING, TravelMode.WALKING, TravelMode.CYCLING].includes(travelConfig.mode)) {
            throw new RoutingError(
                'INVALID_TRAVEL_MODE',
                `Travel mode ${travelConfig.mode} is not supported by land routing service`,
                ['Use driving, walking, or cycling mode for land routes']
            );
        }

        // Validate coordinates
        this.validateLocationCoordinates(source);
        this.validateLocationCoordinates(destination);

        const cacheKey = this.generateCacheKey(source, destination, travelConfig);
        
        // Check cache first
        const cachedResult = this.getCachedResult(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        try {
            let result: RoutingResult;

            if (!this.apiKey) {
                result = this.getMockRoutingResult(source, destination, travelConfig);
            } else {
                result = await this.makeRoutingRequest(source, destination, travelConfig);
            }

            // Apply route optimization based on travel mode
            result = this.optimizeRoute(result, travelConfig);

            // Cache the result
            this.cacheResult(cacheKey, result);

            return result;
        } catch (error) {
            if (error instanceof RoutingError) {
                throw error;
            }

            console.error('Routing service error:', error);
            throw new RoutingError(
                'ROUTING_SERVICE_ERROR',
                'Failed to calculate route',
                [
                    'Please check your internet connection',
                    'Verify that both locations are accessible by the selected travel mode',
                    'Try a different travel mode if the route seems impossible'
                ]
            );
        }
    }

    /**
     * Generate waypoints along a route for weather sampling
     */
    generateWaypoints(route: Route, intervalKm?: number): Waypoint[] {
        const interval = intervalKm || WAYPOINT_INTERVALS[route.travelMode];
        const waypoints: Waypoint[] = [];

        // Always include the starting point
        waypoints.push({
            coordinates: route.source.coordinates,
            distanceFromStart: 0,
            estimatedTimeFromStart: 0
        });

        // Generate intermediate waypoints based on route segments
        let cumulativeDistance = 0;
        let cumulativeTime = 0;
        let nextWaypointDistance = interval;

        for (const segment of route.segments) {
            const segmentEndDistance = cumulativeDistance + segment.distance;
            const segmentEndTime = cumulativeTime + segment.estimatedDuration;

            // Add waypoints within this segment
            while (nextWaypointDistance <= segmentEndDistance) {
                const progressInSegment = (nextWaypointDistance - cumulativeDistance) / segment.distance;
                const timeInSegment = segment.estimatedDuration * progressInSegment;

                // Interpolate coordinates along the segment
                const coordinates = this.interpolateCoordinates(
                    segment.startPoint.coordinates,
                    segment.endPoint.coordinates,
                    progressInSegment
                );

                waypoints.push({
                    coordinates,
                    distanceFromStart: nextWaypointDistance,
                    estimatedTimeFromStart: cumulativeTime + timeInSegment
                });

                nextWaypointDistance += interval;
            }

            cumulativeDistance = segmentEndDistance;
            cumulativeTime = segmentEndTime;
        }

        // Always include the destination
        if (waypoints[waypoints.length - 1].distanceFromStart < route.totalDistance) {
            waypoints.push({
                coordinates: route.destination.coordinates,
                distanceFromStart: route.totalDistance,
                estimatedTimeFromStart: route.estimatedDuration
            });
        }

        return waypoints;
    }

    /**
     * Optimize route based on travel mode preferences
     */
    private optimizeRoute(result: RoutingResult, travelConfig: TravelConfig): RoutingResult {
        const { route } = result;
        const warnings: string[] = [...(result.warnings || [])];

        // Apply travel mode specific optimizations
        switch (travelConfig.mode) {
            case TravelMode.DRIVING:
                // For driving, prefer highways and faster routes
                if (route.totalDistance > 100) {
                    warnings.push('Long driving route detected. Consider rest stops every 2-3 hours.');
                }
                break;

            case TravelMode.WALKING:
                // For walking, prefer pedestrian-friendly routes
                if (route.totalDistance > 20) {
                    warnings.push('Long walking route detected. Plan for multiple days or consider alternative transport.');
                }
                if (route.estimatedDuration > 8 * 3600) { // 8 hours
                    warnings.push('Walking time exceeds 8 hours. Consider breaking into multiple days.');
                }
                break;

            case TravelMode.CYCLING:
                // For cycling, consider elevation and bike-friendly routes
                if (route.totalDistance > 100) {
                    warnings.push('Long cycling route detected. Plan for rest stops and consider elevation changes.');
                }
                break;
        }

        // Apply custom speed if provided
        if (travelConfig.customSpeed) {
            const newDuration = (route.totalDistance / travelConfig.customSpeed) * 3600; // Convert to seconds
            const speedRatio = newDuration / route.estimatedDuration;

            // Update route duration
            const optimizedRoute: Route = {
                ...route,
                estimatedDuration: newDuration,
                segments: route.segments.map(segment => ({
                    ...segment,
                    estimatedDuration: segment.estimatedDuration * speedRatio
                }))
            };

            // Regenerate waypoints with new timing
            optimizedRoute.waypoints = this.generateWaypoints(optimizedRoute);

            return {
                ...result,
                route: optimizedRoute,
                warnings
            };
        }

        return {
            ...result,
            warnings
        };
    }

    private validateLocationCoordinates(location: Location): void {
        const validation = validateCoordinates(location.coordinates.latitude, location.coordinates.longitude);
        if (!validation.isValid) {
            throw new RoutingError(
                'INVALID_COORDINATES',
                `Invalid coordinates for location ${location.name}: ${validation.errors.join(', ')}`,
                ['Ensure coordinates are within valid ranges (-90 to 90 for latitude, -180 to 180 for longitude)']
            );
        }
    }

    private generateCacheKey(source: Location, destination: Location, travelConfig: TravelConfig): string {
        const sourceKey = `${source.coordinates.latitude.toFixed(4)},${source.coordinates.longitude.toFixed(4)}`;
        const destKey = `${destination.coordinates.latitude.toFixed(4)},${destination.coordinates.longitude.toFixed(4)}`;
        const configKey = `${travelConfig.mode}-${travelConfig.customSpeed || 'default'}`;
        return `${sourceKey}-${destKey}-${configKey}`;
    }

    private getCachedResult(cacheKey: string): RoutingResult | null {
        const entry = this.cache.get(cacheKey);
        if (!entry) {
            return null;
        }

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(cacheKey);
            return null;
        }

        return entry.result;
    }

    private cacheResult(cacheKey: string, result: RoutingResult): void {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now(),
            ttl: this.cacheTTL
        });
    }

    private async makeRoutingRequest(
        source: Location,
        destination: Location,
        travelConfig: TravelConfig
    ): Promise<RoutingResult> {
        const url = new URL(this.baseUrl);
        url.searchParams.set('origin', `${source.coordinates.latitude},${source.coordinates.longitude}`);
        url.searchParams.set('destination', `${destination.coordinates.latitude},${destination.coordinates.longitude}`);
        url.searchParams.set('mode', this.getTravelModeForAPI(travelConfig.mode));
        url.searchParams.set('key', this.apiKey);

        // Add optimization preferences
        if (travelConfig.preferences.routeOptimization) {
            url.searchParams.set('optimize', 'true');
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new RoutingError(
                'API_REQUEST_FAILED',
                `Routing API request failed: ${response.status} ${response.statusText}`,
                ['Please try again later', 'Check your internet connection']
            );
        }

        const data: ExternalRoutingResponse = await response.json();
        return this.processRoutingResponse(data, source, destination, travelConfig);
    }

    private processRoutingResponse(
        data: ExternalRoutingResponse,
        source: Location,
        destination: Location,
        travelConfig: TravelConfig
    ): RoutingResult {
        if (data.status === 'ZERO_RESULTS') {
            throw new RoutingError(
                'NO_ROUTE_FOUND',
                `No route found between ${source.name} and ${destination.name} for ${travelConfig.mode}`,
                [
                    'Try a different travel mode',
                    'Check if both locations are accessible',
                    'Consider intermediate waypoints for long distances'
                ]
            );
        }

        if (data.status === 'OVER_QUERY_LIMIT') {
            throw new RoutingError(
                'RATE_LIMIT_EXCEEDED',
                'Too many routing requests. Please try again later.',
                ['Wait a few minutes before trying again']
            );
        }

        if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
            throw new RoutingError(
                'ROUTING_FAILED',
                `Routing failed: ${data.status}`,
                ['Please try again with different locations']
            );
        }

        const apiRoute = data.routes[0];
        const routeId = this.generateRouteId(source, destination, travelConfig);

        // Process route legs and create segments
        const segments: RouteSegment[] = [];
        let totalDistance = 0;
        let totalDuration = 0;

        for (const leg of apiRoute.legs) {
            totalDistance += leg.distance.value / 1000; // Convert to kilometers
            totalDuration += leg.duration.value; // Already in seconds

            // Create segments from steps
            for (const step of leg.steps) {
                const segment: RouteSegment = {
                    startPoint: {
                        coordinates: {
                            latitude: step.start_location.lat,
                            longitude: step.start_location.lng
                        },
                        distanceFromStart: totalDistance - (leg.distance.value / 1000) + (step.distance.value / 1000),
                        estimatedTimeFromStart: totalDuration - leg.duration.value + step.duration.value
                    },
                    endPoint: {
                        coordinates: {
                            latitude: step.end_location.lat,
                            longitude: step.end_location.lng
                        },
                        distanceFromStart: totalDistance - (leg.distance.value / 1000) + (step.distance.value / 1000),
                        estimatedTimeFromStart: totalDuration - leg.duration.value + step.duration.value
                    },
                    distance: step.distance.value / 1000,
                    estimatedDuration: step.duration.value,
                    travelMode: travelConfig.mode
                };
                segments.push(segment);
            }
        }

        const route: Route = {
            id: routeId,
            source,
            destination,
            travelMode: travelConfig.mode,
            waypoints: [], // Will be generated separately
            totalDistance,
            estimatedDuration: totalDuration,
            segments
        };

        // Generate waypoints
        route.waypoints = this.generateWaypoints(route);

        // Calculate confidence based on route quality
        const confidence = this.calculateRouteConfidence(apiRoute, travelConfig);

        return {
            route,
            confidence,
            warnings: apiRoute.warnings
        };
    }

    private getTravelModeForAPI(mode: TravelMode): string {
        switch (mode) {
            case TravelMode.DRIVING:
                return 'driving';
            case TravelMode.WALKING:
                return 'walking';
            case TravelMode.CYCLING:
                return 'bicycling';
            default:
                return 'driving';
        }
    }

    private calculateRouteConfidence(apiRoute: any, travelConfig: TravelConfig): number {
        let confidence = 0.8; // Base confidence

        // Boost confidence for routes with detailed steps
        if (apiRoute.legs && apiRoute.legs.length > 0) {
            const totalSteps = apiRoute.legs.reduce((sum: number, leg: any) => sum + (leg.steps?.length || 0), 0);
            if (totalSteps > 5) confidence += 0.1;
        }

        // Reduce confidence for routes with warnings
        if (apiRoute.warnings && apiRoute.warnings.length > 0) {
            confidence -= 0.1 * apiRoute.warnings.length;
        }

        // Adjust confidence based on travel mode appropriateness
        if (travelConfig.mode === TravelMode.CYCLING && !apiRoute.summary?.toLowerCase().includes('bike')) {
            confidence -= 0.1; // Route might not be bike-friendly
        }

        return Math.max(0.1, Math.min(confidence, 1.0));
    }

    private generateRouteId(source: Location, destination: Location, travelConfig: TravelConfig): string {
        const timestamp = Date.now();
        const sourceHash = `${source.coordinates.latitude.toFixed(4)}_${source.coordinates.longitude.toFixed(4)}`;
        const destHash = `${destination.coordinates.latitude.toFixed(4)}_${destination.coordinates.longitude.toFixed(4)}`;
        return `route_${travelConfig.mode}_${sourceHash}_${destHash}_${timestamp}`;
    }

    private interpolateCoordinates(
        start: { latitude: number; longitude: number },
        end: { latitude: number; longitude: number },
        progress: number
    ): { latitude: number; longitude: number } {
        return {
            latitude: start.latitude + (end.latitude - start.latitude) * progress,
            longitude: start.longitude + (end.longitude - start.longitude) * progress
        };
    }

    private getMockRoutingResult(
        source: Location,
        destination: Location,
        travelConfig: TravelConfig
    ): RoutingResult {
        // Calculate approximate distance using Haversine formula
        const distance = this.calculateHaversineDistance(
            source.coordinates.latitude,
            source.coordinates.longitude,
            destination.coordinates.latitude,
            destination.coordinates.longitude
        );

        const speed = travelConfig.customSpeed || DEFAULT_SPEEDS[travelConfig.mode];
        const duration = (distance / speed) * 3600; // Convert to seconds

        const routeId = this.generateRouteId(source, destination, travelConfig);

        // Create a simple direct route with a few segments
        const numSegments = Math.min(Math.max(Math.floor(distance / 20), 2), 10);
        const segments: RouteSegment[] = [];

        for (let i = 0; i < numSegments; i++) {
            const segmentProgress = i / numSegments;
            const nextSegmentProgress = (i + 1) / numSegments;
            
            const startCoords = this.interpolateCoordinates(
                source.coordinates,
                destination.coordinates,
                segmentProgress
            );
            
            const endCoords = this.interpolateCoordinates(
                source.coordinates,
                destination.coordinates,
                nextSegmentProgress
            );

            const segmentDistance = distance / numSegments;
            const segmentDuration = duration / numSegments;

            segments.push({
                startPoint: {
                    coordinates: startCoords,
                    distanceFromStart: segmentDistance * i,
                    estimatedTimeFromStart: segmentDuration * i
                },
                endPoint: {
                    coordinates: endCoords,
                    distanceFromStart: segmentDistance * (i + 1),
                    estimatedTimeFromStart: segmentDuration * (i + 1)
                },
                distance: segmentDistance,
                estimatedDuration: segmentDuration,
                travelMode: travelConfig.mode
            });
        }

        const route: Route = {
            id: routeId,
            source,
            destination,
            travelMode: travelConfig.mode,
            waypoints: [],
            totalDistance: distance,
            estimatedDuration: duration,
            segments
        };

        // Generate waypoints
        route.waypoints = this.generateWaypoints(route);

        const warnings: string[] = [];
        if (distance > 500) {
            warnings.push('Long distance route - consider breaking into multiple segments');
        }

        return {
            route,
            confidence: 0.7, // Lower confidence for mock data
            warnings
        };
    }

    private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    /**
     * Clear expired cache entries
     */
    clearExpiredCache(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                expiredKeys.push(key);
            }
        }

        expiredKeys.forEach(key => this.cache.delete(key));

        if (expiredKeys.length > 0) {
            console.log(`🧹 Cleared ${expiredKeys.length} expired routing cache entries`);
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; maxSize: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize
        };
    }
}

// Export a singleton instance
export const routingService = new RoutingService();