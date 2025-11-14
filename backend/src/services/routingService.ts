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
     * Calculate route for any travel mode - delegates to appropriate method
     */
    async calculateRoute(
        source: Location,
        destination: Location,
        travelConfig: TravelConfig
    ): Promise<RoutingResult> {
        switch (travelConfig.mode) {
            case TravelMode.DRIVING:
            case TravelMode.WALKING:
            case TravelMode.CYCLING:
                return this.calculateLandRoute(source, destination, travelConfig);
            
            case TravelMode.FLYING:
                return this.calculateAirRoute(source, destination, travelConfig);
            
            case TravelMode.SAILING:
            case TravelMode.CRUISE:
                return this.calculateSeaRoute(source, destination, travelConfig);
            
            default:
                throw new RoutingError(
                    'UNSUPPORTED_TRAVEL_MODE',
                    `Travel mode ${travelConfig.mode} is not supported`,
                    ['Use one of: driving, walking, cycling, flying, sailing, cruise']
                );
        }
    }

    /**
     * Calculate direct flight path for air travel
     */
    async calculateAirRoute(
        source: Location,
        destination: Location,
        travelConfig: TravelConfig
    ): Promise<RoutingResult> {
        // Validate that this is an air travel mode
        if (travelConfig.mode !== TravelMode.FLYING) {
            throw new RoutingError(
                'INVALID_TRAVEL_MODE',
                `Travel mode ${travelConfig.mode} is not supported by air routing service`,
                ['Use flying mode for air routes']
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
            // Air routes are direct paths - no external API needed for basic calculation
            const result = this.calculateDirectFlightPath(source, destination, travelConfig);

            // Cache the result
            this.cacheResult(cacheKey, result);

            return result;
        } catch (error) {
            if (error instanceof RoutingError) {
                throw error;
            }

            console.error('Air routing service error:', error);
            throw new RoutingError(
                'AIR_ROUTING_SERVICE_ERROR',
                'Failed to calculate flight path',
                [
                    'Verify that both locations are accessible by air',
                    'Check for restricted airspace or no-fly zones',
                    'Consider alternative airports if direct flight is not possible'
                ]
            );
        }
    }

    /**
     * Calculate maritime route for sea travel modes (sailing, cruise)
     */
    async calculateSeaRoute(
        source: Location,
        destination: Location,
        travelConfig: TravelConfig
    ): Promise<RoutingResult> {
        // Validate that this is a sea travel mode
        if (![TravelMode.SAILING, TravelMode.CRUISE].includes(travelConfig.mode)) {
            throw new RoutingError(
                'INVALID_TRAVEL_MODE',
                `Travel mode ${travelConfig.mode} is not supported by sea routing service`,
                ['Use sailing or cruise mode for sea routes']
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
            // Sea routes follow maritime paths considering coastlines and shipping lanes
            const result = this.calculateMaritimeRoute(source, destination, travelConfig);

            // Cache the result
            this.cacheResult(cacheKey, result);

            return result;
        } catch (error) {
            if (error instanceof RoutingError) {
                throw error;
            }

            console.error('Sea routing service error:', error);
            throw new RoutingError(
                'SEA_ROUTING_SERVICE_ERROR',
                'Failed to calculate maritime route',
                [
                    'Verify that both locations are accessible by sea',
                    'Check for navigable waterways between locations',
                    'Consider alternative ports if direct route is not possible'
                ]
            );
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

        // Apply custom speed or duration if provided
        if (travelConfig.customSpeed || travelConfig.customDuration) {
            const newDuration = this.calculateTravelDuration(
                route.totalDistance,
                travelConfig.mode,
                travelConfig
            );
            
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
     * Calculate direct flight path between two locations
     */
    private calculateDirectFlightPath(
        source: Location,
        destination: Location,
        travelConfig: TravelConfig
    ): RoutingResult {
        // Calculate great circle distance for flight path
        const distance = this.calculateHaversineDistance(
            source.coordinates.latitude,
            source.coordinates.longitude,
            destination.coordinates.latitude,
            destination.coordinates.longitude
        );

        const speed = travelConfig.customSpeed || DEFAULT_SPEEDS[TravelMode.FLYING];
        const duration = (distance / speed) * 3600; // Convert to seconds

        const routeId = this.generateRouteId(source, destination, travelConfig);

        // Create flight segments with intermediate waypoints for weather sampling
        const segments = this.createFlightSegments(source, destination, distance, duration, travelConfig);

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

        // Generate waypoints for weather sampling
        route.waypoints = this.generateWaypoints(route);

        const warnings: string[] = [];
        
        // Add flight-specific warnings
        if (distance > 10000) {
            warnings.push('Long-haul flight - consider fuel stops and crew rest requirements');
        }
        if (distance < 100) {
            warnings.push('Very short flight distance - ground transportation might be more practical');
        }

        // Check for potential weather considerations
        const latDiff = Math.abs(destination.coordinates.latitude - source.coordinates.latitude);
        if (latDiff > 30) {
            warnings.push('Flight crosses multiple climate zones - expect significant weather variations');
        }

        return {
            route,
            confidence: 0.9, // High confidence for direct flight paths
            warnings
        };
    }

    /**
     * Calculate estimated travel duration based on distance, mode, and configuration
     */
    calculateTravelDuration(
        distance: number,
        mode: TravelMode,
        travelConfig: TravelConfig,
        conditions?: { traffic?: string; weather?: string }
    ): number {
        // Use custom duration if provided (convert from hours to seconds)
        if (travelConfig.customDuration !== undefined && travelConfig.customDuration > 0) {
            return travelConfig.customDuration * 3600;
        }

        // Calculate duration based on speed
        const speed = this.calculateTravelSpeed(mode, distance, travelConfig.customSpeed, conditions);
        const durationHours = distance / speed;
        
        // Add mode-specific time adjustments (stops, delays, etc.)
        const adjustedDuration = this.applyModeSpecificTimeAdjustments(durationHours, mode, distance);
        
        return adjustedDuration * 3600; // Convert to seconds
    }

    /**
     * Generate timeline for weather forecast alignment
     */
    generateWeatherTimeline(
        route: Route,
        startTime: Date = new Date(),
        weatherUpdateInterval: number = 3600 // seconds
    ): Array<{ timestamp: Date; waypoint: Waypoint; segmentIndex: number }> {
        const timeline: Array<{ timestamp: Date; waypoint: Waypoint; segmentIndex: number }> = [];
        
        // Add starting point
        timeline.push({
            timestamp: new Date(startTime),
            waypoint: route.waypoints[0],
            segmentIndex: 0
        });

        // Generate timeline points based on weather update interval
        let currentTime = startTime.getTime();
        let lastWaypointIndex = 0;

        for (let i = 1; i < route.waypoints.length; i++) {
            const waypoint = route.waypoints[i];
            const waypointTime = startTime.getTime() + (waypoint.estimatedTimeFromStart * 1000);

            // Add intermediate timeline points if the gap is larger than update interval
            const timeDiff = waypointTime - currentTime;
            if (timeDiff > weatherUpdateInterval * 1000) {
                const numIntervals = Math.floor(timeDiff / (weatherUpdateInterval * 1000));
                
                for (let j = 1; j <= numIntervals; j++) {
                    const intervalTime = currentTime + (j * weatherUpdateInterval * 1000);
                    
                    // Interpolate waypoint position for this time
                    const timeProgress = (intervalTime - currentTime) / timeDiff;
                    const interpolatedWaypoint = this.interpolateWaypointAtTime(
                        route.waypoints[lastWaypointIndex],
                        waypoint,
                        timeProgress
                    );

                    timeline.push({
                        timestamp: new Date(intervalTime),
                        waypoint: interpolatedWaypoint,
                        segmentIndex: this.findSegmentIndexForWaypoint(route, interpolatedWaypoint)
                    });
                }
            }

            // Add the actual waypoint
            timeline.push({
                timestamp: new Date(waypointTime),
                waypoint,
                segmentIndex: this.findSegmentIndexForWaypoint(route, waypoint)
            });

            currentTime = waypointTime;
            lastWaypointIndex = i;
        }

        return timeline;
    }

    /**
     * Calculate travel time estimates with different scenarios
     */
    calculateTimeEstimates(
        route: Route,
        travelConfig: TravelConfig
    ): {
        optimistic: number;
        realistic: number;
        pessimistic: number;
        breakdown: {
            baseTime: number;
            stops: number;
            delays: number;
            weather: number;
        };
    } {
        const baseTime = route.estimatedDuration;
        
        // Calculate different scenarios
        const optimisticMultiplier = this.getTimeMultiplier(route.travelMode, 'optimistic');
        const realisticMultiplier = this.getTimeMultiplier(route.travelMode, 'realistic');
        const pessimisticMultiplier = this.getTimeMultiplier(route.travelMode, 'pessimistic');

        // Calculate breakdown components
        const stops = this.calculateStopTime(route.travelMode, route.totalDistance);
        const delays = this.calculateDelayTime(route.travelMode, route.totalDistance);
        const weather = this.calculateWeatherImpact(route.travelMode, route.totalDistance);

        return {
            optimistic: Math.round(baseTime * optimisticMultiplier),
            realistic: Math.round(baseTime * realisticMultiplier + stops + delays),
            pessimistic: Math.round(baseTime * pessimisticMultiplier + stops + delays + weather),
            breakdown: {
                baseTime: Math.round(baseTime),
                stops: Math.round(stops),
                delays: Math.round(delays),
                weather: Math.round(weather)
            }
        };
    }

    /**
     * Validate and adjust travel parameters
     */
    validateTravelParameters(
        distance: number,
        mode: TravelMode,
        customDuration?: number,
        customSpeed?: number
    ): {
        isValid: boolean;
        warnings: string[];
        adjustedDuration?: number;
        adjustedSpeed?: number;
    } {
        const warnings: string[] = [];
        let adjustedDuration = customDuration;
        let adjustedSpeed = customSpeed;

        // Validate custom speed
        if (customSpeed !== undefined) {
            const maxSpeed = this.getMaxReasonableSpeed(mode);
            const minSpeed = this.getMinReasonableSpeed(mode);

            if (customSpeed > maxSpeed) {
                warnings.push(`Speed ${customSpeed} km/h is unrealistic for ${mode}. Maximum reasonable speed is ${maxSpeed} km/h.`);
                adjustedSpeed = maxSpeed;
            }

            if (customSpeed < minSpeed) {
                warnings.push(`Speed ${customSpeed} km/h is too slow for ${mode}. Minimum reasonable speed is ${minSpeed} km/h.`);
                adjustedSpeed = minSpeed;
            }
        }

        // Validate custom duration
        if (customDuration !== undefined) {
            const minDuration = this.getMinReasonableDuration(distance, mode);
            const maxDuration = this.getMaxReasonableDuration(distance, mode);

            if (customDuration < minDuration) {
                warnings.push(`Duration ${customDuration} hours is too short for ${distance} km by ${mode}. Minimum reasonable duration is ${minDuration} hours.`);
                adjustedDuration = minDuration;
            }

            if (customDuration > maxDuration) {
                warnings.push(`Duration ${customDuration} hours is very long for ${distance} km by ${mode}. Consider if this is intentional.`);
            }
        }

        // Check for conflicting parameters
        if (customSpeed !== undefined && customDuration !== undefined) {
            const impliedSpeed = distance / customDuration;
            const speedDifference = Math.abs(impliedSpeed - customSpeed);
            
            if (speedDifference > customSpeed * 0.2) { // More than 20% difference
                warnings.push(`Custom speed (${customSpeed} km/h) and duration (${customDuration} hours) are inconsistent for distance ${distance} km.`);
            }
        }

        return {
            isValid: warnings.length === 0,
            warnings,
            adjustedDuration,
            adjustedSpeed
        };
    }

    private applyConditionAdjustments(
        baseSpeed: number,
        mode: TravelMode,
        conditions: { traffic?: string; weather?: string }
    ): number {
        let adjustedSpeed = baseSpeed;

        // Apply traffic conditions (mainly for land travel)
        if (conditions.traffic && [TravelMode.DRIVING, TravelMode.CYCLING].includes(mode)) {
            switch (conditions.traffic) {
                case 'heavy':
                    adjustedSpeed *= 0.7;
                    break;
                case 'moderate':
                    adjustedSpeed *= 0.85;
                    break;
                case 'light':
                    adjustedSpeed *= 1.1;
                    break;
            }
        }

        // Apply weather conditions
        if (conditions.weather) {
            switch (conditions.weather) {
                case 'storm':
                    adjustedSpeed *= mode === TravelMode.FLYING ? 0.8 : 0.6;
                    break;
                case 'rain':
                    adjustedSpeed *= mode === TravelMode.FLYING ? 0.9 : 0.8;
                    break;
                case 'headwind':
                    if ([TravelMode.FLYING, TravelMode.SAILING, TravelMode.CYCLING].includes(mode)) {
                        adjustedSpeed *= 0.9;
                    }
                    break;
                case 'favorable':
                    if ([TravelMode.SAILING, TravelMode.FLYING].includes(mode)) {
                        adjustedSpeed *= 1.3;
                    }
                    break;
            }
        }

        return adjustedSpeed;
    }

    private applyModeSpecificTimeAdjustments(durationHours: number, mode: TravelMode, distance: number): number {
        let adjustedDuration = durationHours;

        switch (mode) {
            case TravelMode.DRIVING:
                // Add time for rest stops on long drives
                if (distance > 200) {
                    const restStops = Math.floor(distance / 200);
                    adjustedDuration += restStops * 0.5; // 30 minutes per rest stop
                }
                break;

            case TravelMode.FLYING:
                // Add time for takeoff, landing, and taxi
                adjustedDuration += 1; // 1 hour for airport procedures
                break;

            case TravelMode.SAILING:
            case TravelMode.CRUISE:
                // Add time for tidal considerations and port procedures
                adjustedDuration += 0.5; // 30 minutes for port procedures
                break;

            case TravelMode.WALKING:
                // Add time for breaks on long walks
                if (distance > 10) {
                    const breaks = Math.floor(distance / 10);
                    adjustedDuration += breaks * 0.25; // 15 minutes per break
                }
                break;

            case TravelMode.CYCLING:
                // Add time for breaks on long rides
                if (distance > 50) {
                    const breaks = Math.floor(distance / 50);
                    adjustedDuration += breaks * 0.33; // 20 minutes per break
                }
                break;
        }

        return adjustedDuration;
    }

    private interpolateWaypointAtTime(
        startWaypoint: Waypoint,
        endWaypoint: Waypoint,
        timeProgress: number
    ): Waypoint {
        const distanceProgress = startWaypoint.distanceFromStart + 
            (endWaypoint.distanceFromStart - startWaypoint.distanceFromStart) * timeProgress;
        
        const timeProgress2 = startWaypoint.estimatedTimeFromStart + 
            (endWaypoint.estimatedTimeFromStart - startWaypoint.estimatedTimeFromStart) * timeProgress;

        return {
            coordinates: this.interpolateCoordinates(
                startWaypoint.coordinates,
                endWaypoint.coordinates,
                timeProgress
            ),
            distanceFromStart: distanceProgress,
            estimatedTimeFromStart: timeProgress2
        };
    }

    private findSegmentIndexForWaypoint(route: Route, waypoint: Waypoint): number {
        for (let i = 0; i < route.segments.length; i++) {
            const segment = route.segments[i];
            if (waypoint.distanceFromStart >= segment.startPoint.distanceFromStart &&
                waypoint.distanceFromStart <= segment.endPoint.distanceFromStart) {
                return i;
            }
        }
        return route.segments.length - 1; // Default to last segment
    }

    private getTimeMultiplier(mode: TravelMode, scenario: 'optimistic' | 'realistic' | 'pessimistic'): number {
        const multipliers = {
            [TravelMode.DRIVING]: { optimistic: 0.9, realistic: 1.1, pessimistic: 1.4 },
            [TravelMode.WALKING]: { optimistic: 0.95, realistic: 1.0, pessimistic: 1.2 },
            [TravelMode.CYCLING]: { optimistic: 0.9, realistic: 1.1, pessimistic: 1.3 },
            [TravelMode.FLYING]: { optimistic: 1.0, realistic: 1.2, pessimistic: 1.8 },
            [TravelMode.SAILING]: { optimistic: 0.8, realistic: 1.3, pessimistic: 2.0 },
            [TravelMode.CRUISE]: { optimistic: 0.95, realistic: 1.1, pessimistic: 1.4 }
        };

        return multipliers[mode][scenario];
    }

    private calculateStopTime(mode: TravelMode, distance: number): number {
        switch (mode) {
            case TravelMode.DRIVING:
                return Math.floor(distance / 200) * 1800; // 30 min stops every 200km
            case TravelMode.WALKING:
                return Math.floor(distance / 10) * 900; // 15 min breaks every 10km
            case TravelMode.CYCLING:
                return Math.floor(distance / 50) * 1200; // 20 min breaks every 50km
            case TravelMode.FLYING:
                return 3600; // 1 hour for airport procedures
            case TravelMode.SAILING:
            case TravelMode.CRUISE:
                return 1800; // 30 min for port procedures
            default:
                return 0;
        }
    }

    private calculateDelayTime(mode: TravelMode, distance: number): number {
        const baseDelay = {
            [TravelMode.DRIVING]: 0.1,
            [TravelMode.WALKING]: 0.05,
            [TravelMode.CYCLING]: 0.08,
            [TravelMode.FLYING]: 0.3,
            [TravelMode.SAILING]: 0.2,
            [TravelMode.CRUISE]: 0.15
        };

        return (distance / DEFAULT_SPEEDS[mode]) * 3600 * baseDelay[mode];
    }

    private calculateWeatherImpact(mode: TravelMode, distance: number): number {
        const weatherImpact = {
            [TravelMode.DRIVING]: 0.05,
            [TravelMode.WALKING]: 0.15,
            [TravelMode.CYCLING]: 0.2,
            [TravelMode.FLYING]: 0.1,
            [TravelMode.SAILING]: 0.3,
            [TravelMode.CRUISE]: 0.1
        };

        return (distance / DEFAULT_SPEEDS[mode]) * 3600 * weatherImpact[mode];
    }

    private getMaxReasonableSpeed(mode: TravelMode): number {
        const maxSpeeds = {
            [TravelMode.DRIVING]: 150,
            [TravelMode.WALKING]: 8,
            [TravelMode.CYCLING]: 50,
            [TravelMode.FLYING]: 1200,
            [TravelMode.SAILING]: 40,
            [TravelMode.CRUISE]: 50
        };
        return maxSpeeds[mode];
    }

    private getMinReasonableSpeed(mode: TravelMode): number {
        const minSpeeds = {
            [TravelMode.DRIVING]: 20,
            [TravelMode.WALKING]: 2,
            [TravelMode.CYCLING]: 8,
            [TravelMode.FLYING]: 200,
            [TravelMode.SAILING]: 5,
            [TravelMode.CRUISE]: 10
        };
        return minSpeeds[mode];
    }

    private getMinReasonableDuration(distance: number, mode: TravelMode): number {
        const maxSpeed = this.getMaxReasonableSpeed(mode);
        return distance / maxSpeed;
    }

    private getMaxReasonableDuration(distance: number, mode: TravelMode): number {
        const minSpeed = this.getMinReasonableSpeed(mode);
        return distance / minSpeed;
    }

    /**
     * Analyze cross-mode route recommendations
     */
    analyzeCrossModeRoute(
        source: Location,
        destination: Location,
        currentMode: TravelMode
    ): {
        recommendations: string[];
        alternativeModes: TravelMode[];
        considerations: string[];
    } {
        const distance = this.calculateHaversineDistance(
            source.coordinates.latitude,
            source.coordinates.longitude,
            destination.coordinates.latitude,
            destination.coordinates.longitude
        );

        const recommendations: string[] = [];
        const alternativeModes: TravelMode[] = [];
        const considerations: string[] = [];

        // Distance-based recommendations
        if (distance < 5) {
            recommendations.push('Short distance - walking or cycling recommended');
            alternativeModes.push(TravelMode.WALKING, TravelMode.CYCLING);
        } else if (distance > 1000) {
            recommendations.push('Very long distance - flying recommended for speed');
            alternativeModes.push(TravelMode.FLYING);
        }

        // Geographic considerations
        const latDiff = Math.abs(destination.coordinates.latitude - source.coordinates.latitude);
        const lonDiff = Math.abs(destination.coordinates.longitude - source.coordinates.longitude);

        // Check for ocean crossings
        if (lonDiff > 30 || (lonDiff > 15 && latDiff < 10)) {
            if ([TravelMode.DRIVING, TravelMode.WALKING, TravelMode.CYCLING].includes(currentMode)) {
                considerations.push('Ocean crossing required - ferry or shipping needed for vehicle');
                alternativeModes.push(TravelMode.FLYING, TravelMode.CRUISE);
            }
        }

        // Multi-day journey warnings for walking/cycling
        if ([TravelMode.WALKING, TravelMode.CYCLING].includes(currentMode)) {
            if (distance > 100) { // More than 100km for walking/cycling
                considerations.push('Very long journey - plan for multiple days and accommodation');
            }
        }

        // Climate zone crossing detection
        if (latDiff > 15) { // Significant latitude difference indicates climate zone crossing
            considerations.push('Route crosses climate zones - pack for varying weather conditions');
        }

        // Multi-modal journey detection
        if (distance > 500 && distance < 2000) {
            considerations.push('Consider multi-modal journey combining different transport types');
        }

        return {
            recommendations,
            alternativeModes: [...new Set(alternativeModes)], // Remove duplicates
            considerations
        };
    }

    private calculateMaritimeRoute(
        source: Location,
        destination: Location,
        travelConfig: TravelConfig
    ): RoutingResult {
        // For maritime routes, we need to consider:
        // 1. Coastal navigation vs open ocean
        // 2. Shipping lanes and traffic separation schemes
        // 3. Weather routing for optimal conditions
        
        const directDistance = this.calculateHaversineDistance(
            source.coordinates.latitude,
            source.coordinates.longitude,
            destination.coordinates.latitude,
            destination.coordinates.longitude
        );

        // Maritime routes are typically 10-20% longer than direct distance due to navigation constraints
        const maritimeDistance = this.calculateMaritimeDistance(source, destination, directDistance);

        const speed = this.calculateTravelSpeed(travelConfig.mode, maritimeDistance, travelConfig.customSpeed);
        const duration = this.calculateTravelDuration(maritimeDistance, travelConfig.mode, travelConfig);

        const routeId = this.generateRouteId(source, destination, travelConfig);

        // Create maritime segments considering shipping lanes and coastal navigation
        const segments = this.createMaritimeSegments(source, destination, maritimeDistance, duration, travelConfig);

        const route: Route = {
            id: routeId,
            source,
            destination,
            travelMode: travelConfig.mode,
            waypoints: [],
            totalDistance: maritimeDistance,
            estimatedDuration: duration,
            segments
        };

        // Generate waypoints for weather sampling
        route.waypoints = this.generateWaypoints(route);

        const warnings: string[] = [];
        
        // Add maritime-specific warnings
        if (maritimeDistance > 1000) {
            warnings.push('Long ocean voyage - plan for weather routing and fuel/supply stops');
        }

        // Check for equator crossing
        const sourceLat = source.coordinates.latitude;
        const destLat = destination.coordinates.latitude;
        if ((sourceLat > 0 && destLat < 0) || (sourceLat < 0 && destLat > 0)) {
            warnings.push('Route crosses equator - expect tropical weather systems and seasonal variations');
        }

        // Check for high-latitude routes
        if (Math.abs(sourceLat) > 60 || Math.abs(destLat) > 60) {
            warnings.push('High-latitude route - expect challenging weather conditions and ice hazards');
        }

        return {
            route,
            confidence: 0.8, // Good confidence for maritime routes
            warnings
        };
    }

    /**
     * Create flight segments for direct air travel
     */
    private createFlightSegments(
        source: Location,
        destination: Location,
        totalDistance: number,
        totalDuration: number,
        travelConfig: TravelConfig
    ): RouteSegment[] {
        // For flights, create segments every ~200km for weather sampling
        const segmentDistance = WAYPOINT_INTERVALS[TravelMode.FLYING];
        const numSegments = Math.max(Math.ceil(totalDistance / segmentDistance), 2);
        const actualSegmentDistance = totalDistance / numSegments;
        const segmentDuration = totalDuration / numSegments;

        const segments: RouteSegment[] = [];

        for (let i = 0; i < numSegments; i++) {
            const startProgress = i / numSegments;
            const endProgress = (i + 1) / numSegments;

            const startCoords = this.interpolateCoordinates(
                source.coordinates,
                destination.coordinates,
                startProgress
            );

            const endCoords = this.interpolateCoordinates(
                source.coordinates,
                destination.coordinates,
                endProgress
            );

            segments.push({
                startPoint: {
                    coordinates: startCoords,
                    distanceFromStart: actualSegmentDistance * i,
                    estimatedTimeFromStart: segmentDuration * i
                },
                endPoint: {
                    coordinates: endCoords,
                    distanceFromStart: actualSegmentDistance * (i + 1),
                    estimatedTimeFromStart: segmentDuration * (i + 1)
                },
                distance: actualSegmentDistance,
                estimatedDuration: segmentDuration,
                travelMode: travelConfig.mode
            });
        }

        return segments;
    }

    /**
     * Create maritime segments following shipping routes
     */
    private createMaritimeSegments(
        source: Location,
        destination: Location,
        totalDistance: number,
        totalDuration: number,
        travelConfig: TravelConfig
    ): RouteSegment[] {
        // For maritime routes, create segments every ~100km for weather sampling
        const segmentDistance = WAYPOINT_INTERVALS[travelConfig.mode];
        const numSegments = Math.max(Math.ceil(totalDistance / segmentDistance), 2);
        const actualSegmentDistance = totalDistance / numSegments;
        const segmentDuration = totalDuration / numSegments;

        const segments: RouteSegment[] = [];

        // For maritime routes, we might need to follow coastlines or shipping lanes
        // This is a simplified implementation - in practice, you'd use maritime routing APIs
        const waypoints = this.generateMaritimeWaypoints(source, destination, numSegments);

        for (let i = 0; i < numSegments; i++) {
            const startPoint = waypoints[i];
            const endPoint = waypoints[i + 1];

            segments.push({
                startPoint: {
                    coordinates: startPoint,
                    distanceFromStart: actualSegmentDistance * i,
                    estimatedTimeFromStart: segmentDuration * i
                },
                endPoint: {
                    coordinates: endPoint,
                    distanceFromStart: actualSegmentDistance * (i + 1),
                    estimatedTimeFromStart: segmentDuration * (i + 1)
                },
                distance: actualSegmentDistance,
                estimatedDuration: segmentDuration,
                travelMode: travelConfig.mode
            });
        }

        return segments;
    }

    /**
     * Calculate maritime distance accounting for navigation constraints
     */
    private calculateMaritimeDistance(
        source: Location,
        destination: Location,
        directDistance: number
    ): number {
        // Maritime routes are typically longer than direct distance due to:
        // - Coastal navigation requirements
        // - Shipping lane adherence
        // - Weather routing
        // - Port approach requirements

        let distanceMultiplier = 1.0;

        // Increase distance for coastal routes
        if (this.isCoastalRoute(source, destination)) {
            distanceMultiplier += 0.15; // 15% longer for coastal navigation
        }

        // Increase distance for trans-oceanic routes
        if (directDistance > 3000) {
            distanceMultiplier += 0.10; // 10% longer for weather routing
        }

        // Increase distance for routes through congested areas
        if (this.passesThroughCongestedWaters(source, destination)) {
            distanceMultiplier += 0.05; // 5% longer for traffic separation
        }

        return directDistance * distanceMultiplier;
    }

    /**
     * Generate waypoints for maritime routes
     */
    private generateMaritimeWaypoints(
        source: Location,
        destination: Location,
        numSegments: number
    ): Array<{ latitude: number; longitude: number }> {
        const waypoints: Array<{ latitude: number; longitude: number }> = [];
        
        // Start with source
        waypoints.push(source.coordinates);

        // Generate intermediate waypoints
        // In a real implementation, this would consider:
        // - Great circle routes for open ocean
        // - Rhumb line routes for coastal navigation
        // - Traffic separation schemes
        // - Weather routing
        
        for (let i = 1; i < numSegments; i++) {
            const progress = i / numSegments;
            const coords = this.interpolateCoordinates(
                source.coordinates,
                destination.coordinates,
                progress
            );
            waypoints.push(coords);
        }

        // End with destination
        waypoints.push(destination.coordinates);

        return waypoints;
    }

    /**
     * Check if route crosses the equator
     */
    private crossesEquator(source: Location, destination: Location): boolean {
        return (source.coordinates.latitude > 0 && destination.coordinates.latitude < 0) ||
               (source.coordinates.latitude < 0 && destination.coordinates.latitude > 0);
    }

    /**
     * Check if route crosses the international date line
     */
    private crossesDateLine(source: Location, destination: Location): boolean {
        const lonDiff = Math.abs(destination.coordinates.longitude - source.coordinates.longitude);
        return lonDiff > 180;
    }

    /**
     * Check if this is primarily a coastal route
     */
    private isCoastalRoute(source: Location, destination: Location): boolean {
        // Simplified check - in practice, you'd use coastal database
        // Consider it coastal if both points are within certain latitude ranges
        // that typically have complex coastlines
        const sourceNearCoast = this.isNearMajorCoastline(source.coordinates);
        const destNearCoast = this.isNearMajorCoastline(destination.coordinates);
        return sourceNearCoast && destNearCoast;
    }

    /**
     * Check if coordinates are near major coastlines
     */
    private isNearMajorCoastline(coords: { latitude: number; longitude: number }): boolean {
        // Simplified heuristic - major coastlines and archipelagos
        const { latitude, longitude } = coords;
        
        // Mediterranean, Baltic, North Sea regions
        if (latitude > 35 && latitude < 70 && longitude > -10 && longitude < 40) return true;
        
        // Southeast Asia archipelagos
        if (latitude > -10 && latitude < 25 && longitude > 90 && longitude < 140) return true;
        
        // Caribbean and Central America
        if (latitude > 5 && latitude < 30 && longitude > -90 && longitude < -60) return true;
        
        // This is a simplified implementation
        return false;
    }

    /**
     * Check if route passes through congested waters
     */
    private passesThroughCongestedWaters(source: Location, destination: Location): boolean {
        // Check if route passes through major shipping chokepoints
        // Simplified implementation - in practice, you'd check against known congested areas
        
        const routeBounds = {
            minLat: Math.min(source.coordinates.latitude, destination.coordinates.latitude),
            maxLat: Math.max(source.coordinates.latitude, destination.coordinates.latitude),
            minLon: Math.min(source.coordinates.longitude, destination.coordinates.longitude),
            maxLon: Math.max(source.coordinates.longitude, destination.coordinates.longitude)
        };

        // Check for major chokepoints (simplified)
        const chokepoints = [
            { name: 'Strait of Gibraltar', lat: 36, lon: -5.5, range: 2 },
            { name: 'Suez Canal', lat: 30, lon: 32.5, range: 1 },
            { name: 'Strait of Hormuz', lat: 26, lon: 56.5, range: 1 },
            { name: 'Strait of Malacca', lat: 1.5, lon: 103, range: 2 },
            { name: 'Panama Canal', lat: 9, lon: -79.5, range: 1 },
            { name: 'English Channel', lat: 50.5, lon: 1, range: 2 }
        ];

        return chokepoints.some(point => 
            point.lat >= routeBounds.minLat - point.range &&
            point.lat <= routeBounds.maxLat + point.range &&
            point.lon >= routeBounds.minLon - point.range &&
            point.lon <= routeBounds.maxLon + point.range
        );
    }

    /**
     * Calculate appropriate travel speed for different modes
     */
    calculateTravelSpeed(
        travelMode: TravelMode,
        distance: number,
        customSpeed?: number,
        conditions?: {
            weather?: string;
            terrain?: string;
            traffic?: string;
        }
    ): number {
        let baseSpeed = customSpeed || DEFAULT_SPEEDS[travelMode];

        // Apply mode-specific speed adjustments based on conditions
        switch (travelMode) {
            case TravelMode.DRIVING:
                if (conditions?.traffic === 'heavy') baseSpeed *= 0.7;
                if (conditions?.weather === 'poor') baseSpeed *= 0.8;
                if (distance > 500) baseSpeed *= 1.1; // Highway speeds for long distances
                break;

            case TravelMode.WALKING:
                if (conditions?.terrain === 'mountainous') baseSpeed *= 0.7;
                if (conditions?.weather === 'poor') baseSpeed *= 0.8;
                break;

            case TravelMode.CYCLING:
                if (conditions?.terrain === 'mountainous') baseSpeed *= 0.6;
                if (conditions?.weather === 'poor') baseSpeed *= 0.7;
                if (conditions?.weather === 'tailwind') baseSpeed *= 1.2;
                break;

            case TravelMode.FLYING:
                if (distance > 10000) baseSpeed *= 1.1; // Higher speeds for long-haul flights
                if (conditions?.weather === 'headwind') baseSpeed *= 0.9;
                if (conditions?.weather === 'tailwind') baseSpeed *= 1.1;
                break;

            case TravelMode.SAILING:
                if (conditions?.weather === 'calm') baseSpeed *= 0.5; // No wind
                if (conditions?.weather === 'favorable') baseSpeed *= 1.3; // Good wind
                if (conditions?.weather === 'storm') baseSpeed *= 0.3; // Storm conditions
                break;

            case TravelMode.CRUISE:
                // Cruise ships maintain more consistent speeds regardless of conditions
                if (conditions?.weather === 'storm') baseSpeed *= 0.8;
                break;
        }

        return Math.max(baseSpeed, 1); // Minimum 1 km/h
    }



    /**
     * Check if there's a viable water route between locations
     */
    private hasWaterRoute(source: Location, destination: Location): boolean {
        // Simplified check - in practice, you'd use maritime routing databases
        // Check if both locations are coastal or connected by navigable waterways
        
        const sourceCoastal = this.isCoastalLocation(source);
        const destCoastal = this.isCoastalLocation(destination);
        
        // If both are coastal and on same ocean/sea system, water route likely exists
        if (sourceCoastal && destCoastal) {
            return this.areConnectedByWater(source, destination);
        }
        
        return false;
    }

    /**
     * Check if location is coastal
     */
    private isCoastalLocation(location: Location): boolean {
        // Simplified heuristic - in practice, use coastal database
        // Check if location name suggests coastal area or coordinates are near known coasts
        const name = location.name.toLowerCase();
        const coastalKeywords = ['port', 'harbor', 'bay', 'coast', 'beach', 'island', 'peninsula'];
        
        if (coastalKeywords.some(keyword => name.includes(keyword))) {
            return true;
        }
        
        // Use coordinate-based heuristic
        return this.isNearMajorCoastline(location.coordinates);
    }

    /**
     * Check if two coastal locations are connected by navigable water
     */
    private areConnectedByWater(source: Location, destination: Location): boolean {
        // Simplified implementation - in practice, use maritime routing APIs
        // Check if locations are on same ocean/sea system
        
        const sourceOcean = this.getOceanSystem(source.coordinates);
        const destOcean = this.getOceanSystem(destination.coordinates);
        
        // Same ocean system or connected systems
        return sourceOcean === destOcean || this.areOceansConnected(sourceOcean, destOcean);
    }

    /**
     * Determine which ocean system a location belongs to
     */
    private getOceanSystem(coords: { latitude: number; longitude: number }): string {
        const { latitude, longitude } = coords;
        
        // Simplified ocean boundaries
        if (longitude >= -30 && longitude <= 50) {
            if (latitude > 30) return 'North Atlantic';
            if (latitude < -30) return 'South Atlantic';
            return 'Atlantic';
        }
        
        if (longitude >= 50 && longitude <= 150) {
            return 'Indian Ocean';
        }
        
        if (longitude >= 150 || longitude <= -120) {
            if (latitude > 30) return 'North Pacific';
            if (latitude < -30) return 'South Pacific';
            return 'Pacific';
        }
        
        if (longitude >= -120 && longitude <= -30) {
            return 'Atlantic';
        }
        
        return 'Unknown';
    }

    /**
     * Check if ocean systems are connected for navigation
     */
    private areOceansConnected(ocean1: string, ocean2: string): boolean {
        // All major oceans are connected, but some routes are more practical
        const connections = new Set([
            'Atlantic-Indian Ocean', 'Indian Ocean-Atlantic',
            'Atlantic-Pacific', 'Pacific-Atlantic',
            'Indian Ocean-Pacific', 'Pacific-Indian Ocean',
            'North Atlantic-South Atlantic', 'South Atlantic-North Atlantic',
            'North Pacific-South Pacific', 'South Pacific-North Pacific'
        ]);
        
        return connections.has(`${ocean1}-${ocean2}`);
    }

    /**
     * Check if route crosses an ocean
     */
    private crossesOcean(source: Location, destination: Location): boolean {
        const distance = this.calculateHaversineDistance(
            source.coordinates.latitude,
            source.coordinates.longitude,
            destination.coordinates.latitude,
            destination.coordinates.longitude
        );
        
        // If distance > 2000km and crosses major longitude differences, likely crosses ocean
        const lonDiff = Math.abs(destination.coordinates.longitude - source.coordinates.longitude);
        return distance > 2000 && lonDiff > 30;
    }

    /**
     * Check if route is seasonal (affected by ice, monsoons, etc.)
     */
    private isSeasonalRoute(source: Location, destination: Location): boolean {
        const maxLat = Math.max(Math.abs(source.coordinates.latitude), Math.abs(destination.coordinates.latitude));
        
        // High latitude routes affected by ice
        if (maxLat > 60) return true;
        
        // Routes through monsoon regions
        const inMonsoonRegion = (coords: { latitude: number; longitude: number }) => {
            return coords.latitude > 0 && coords.latitude < 30 && 
                   coords.longitude > 60 && coords.longitude < 120;
        };
        
        return inMonsoonRegion(source.coordinates) || inMonsoonRegion(destination.coordinates);
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