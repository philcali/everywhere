import { WeatherForecast, WeatherCondition, PrecipitationType } from '@shared/types/weather.js';
import { Location, Waypoint } from '@shared/types/location.js';
import { Route } from '@shared/types/route.js';

export interface WeatherQuery {
    location: Location;
    timestamp?: Date;
    includeHourly?: boolean;
    includeDailyForecast?: boolean;
}

export interface RouteWeatherQuery {
    route: Route;
    startTime?: Date;
    intervalKm?: number;
    includeInterpolation?: boolean;
}

export interface WeatherInterpolationResult {
    forecast: WeatherForecast;
    confidence: number;
    interpolated: boolean;
    sourceForecasts?: WeatherForecast[];
}

export interface RouteWeatherForecast {
    waypoints: Array<{
        waypoint: Waypoint;
        weather: WeatherInterpolationResult;
        travelTime: Date;
    }>;
    route: Route;
    startTime: Date;
    totalForecasts: number;
    missingDataPoints: number;
    warnings: string[];
}

export interface WeatherServiceOptions {
    apiKey?: string;
    units?: 'metric' | 'imperial';
    language?: string;
}

export class WeatherError extends Error {
    public code: string;
    public suggestions?: string[];

    constructor(code: string, message: string, suggestions?: string[]) {
        super(message);
        this.name = 'WeatherError';
        this.code = code;
        this.suggestions = suggestions;
    }
}

interface CacheEntry {
    forecast: WeatherForecast;
    timestamp: number;
    ttl: number;
}

// OpenWeatherMap API response interfaces
interface OpenWeatherMapResponse {
    coord: {
        lon: number;
        lat: number;
    };
    weather: Array<{
        id: number;
        main: string;
        description: string;
        icon: string;
    }>;
    main: {
        temp: number;
        feels_like: number;
        temp_min: number;
        temp_max: number;
        pressure: number;
        humidity: number;
    };
    visibility: number;
    wind: {
        speed: number;
        deg: number;
        gust?: number;
    };
    rain?: {
        '1h'?: number;
        '3h'?: number;
    };
    snow?: {
        '1h'?: number;
        '3h'?: number;
    };
    dt: number;
    sys: {
        country: string;
        sunrise: number;
        sunset: number;
    };
    name: string;
}

interface OpenWeatherMapForecastResponse {
    list: Array<{
        dt: number;
        main: {
            temp: number;
            feels_like: number;
            temp_min: number;
            temp_max: number;
            pressure: number;
            humidity: number;
        };
        weather: Array<{
            id: number;
            main: string;
            description: string;
            icon: string;
        }>;
        wind: {
            speed: number;
            deg: number;
            gust?: number;
        };
        visibility: number;
        pop: number; // Probability of precipitation
        rain?: {
            '3h'?: number;
        };
        snow?: {
            '3h'?: number;
        };
        dt_txt: string;
    }>;
    city: {
        id: number;
        name: string;
        coord: {
            lat: number;
            lon: number;
        };
        country: string;
    };
}

export class WeatherService {
    private cache = new Map<string, CacheEntry>();
    private readonly apiKey: string;
    private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';
    private readonly cacheTTL = 10 * 60 * 1000; // 10 minutes for weather data
    private readonly maxCacheSize = 500;
    private readonly units: string;
    private readonly language: string;

    constructor(options: WeatherServiceOptions = {}) {
        this.apiKey = options.apiKey || process.env.WEATHER_API_KEY || '';
        this.units = options.units || 'metric';
        this.language = options.language || 'en';

        if (!this.apiKey) {
            console.warn('⚠️  Weather API key not provided. Service will use mock data.');
        }
    }

    /**
     * Get current weather for a specific location
     */
    async getCurrentWeather(location: Location): Promise<WeatherForecast> {
        const cacheKey = this.generateCacheKey(location, 'current');

        // Check cache first
        const cachedResult = this.getCachedResult(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        try {
            // If no API key, return mock data for development
            if (!this.apiKey) {
                return this.getMockWeatherForecast(location);
            }

            const forecast = await this.makeCurrentWeatherRequest(location);

            // Cache the result
            this.cacheResult(cacheKey, forecast);

            return forecast;
        } catch (error) {
            if (error instanceof WeatherError) {
                throw error;
            }

            console.error('Weather service error:', error);
            throw this.createWeatherError(
                'WEATHER_SERVICE_ERROR',
                'Failed to retrieve weather data',
                [
                    'Please check your internet connection',
                    'Try again in a few moments',
                    'Verify the location coordinates are valid'
                ]
            );
        }
    }

    /**
     * Get weather forecast for multiple points along a route
     */
    async getRouteWeatherForecast(locations: Location[], timestamps?: Date[]): Promise<WeatherForecast[]> {
        if (locations.length === 0) {
            throw this.createWeatherError(
                'INVALID_INPUT',
                'No locations provided for weather forecast',
                ['Provide at least one location for weather data']
            );
        }

        const forecasts: WeatherForecast[] = [];
        const batchSize = 5; // Process in batches to respect rate limits

        for (let i = 0; i < locations.length; i += batchSize) {
            const batch = locations.slice(i, i + batchSize);
            const batchTimestamps = timestamps?.slice(i, i + batchSize);

            const batchPromises = batch.map(async (location, index) => {
                const timestamp = batchTimestamps?.[index];
                return this.getWeatherForLocationAndTime(location, timestamp);
            });

            const batchResults = await Promise.all(batchPromises);
            forecasts.push(...batchResults);

            // Small delay between batches to respect rate limits
            if (i + batchSize < locations.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        return forecasts;
    }

    /**
     * Get detailed weather forecast for a specific location and time
     */
    async getWeatherForLocationAndTime(location: Location, timestamp?: Date): Promise<WeatherForecast> {
        const targetTime = timestamp || new Date();
        const now = new Date();

        // If timestamp is current or very recent, get current weather
        if (Math.abs(targetTime.getTime() - now.getTime()) < 30 * 60 * 1000) { // Within 30 minutes
            return this.getCurrentWeather(location);
        }

        // For future timestamps, get forecast data
        if (targetTime > now) {
            return this.getForecastWeather(location, targetTime);
        }

        // For historical data, we'd need a different API endpoint
        // For now, return current weather with a warning
        console.warn(`Historical weather data requested for ${targetTime.toISOString()}, returning current weather instead`);
        return this.getCurrentWeather(location);
    }

    /**
     * Get forecast weather for a specific location and future timestamp
     */
    async getForecastWeather(location: Location, timestamp: Date): Promise<WeatherForecast> {
        const cacheKey = this.generateCacheKey(location, 'forecast', timestamp);

        // Check cache first
        const cachedResult = this.getCachedResult(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        try {
            if (!this.apiKey) {
                return this.getMockWeatherForecast(location, timestamp);
            }

            const forecast = await this.makeForecastWeatherRequest(location, timestamp);

            // Cache the result
            this.cacheResult(cacheKey, forecast);

            return forecast;
        } catch (error) {
            if (error instanceof WeatherError) {
                throw error;
            }

            console.error('Weather forecast error:', error);
            throw this.createWeatherError(
                'WEATHER_FORECAST_ERROR',
                'Failed to retrieve weather forecast',
                [
                    'Please check your internet connection',
                    'Try again in a few moments',
                    'Verify the location coordinates are valid'
                ]
            );
        }
    }

    /**
     * Get comprehensive weather forecast for an entire route with interpolation
     */
    async getRouteWeatherForecastWithInterpolation(query: RouteWeatherQuery): Promise<RouteWeatherForecast> {
        const { route, startTime = new Date(), intervalKm, includeInterpolation = true } = query;

        if (!route.waypoints || route.waypoints.length === 0) {
            throw this.createWeatherError(
                'INVALID_ROUTE',
                'Route must contain waypoints for weather forecasting',
                ['Ensure the route has been properly calculated with waypoints']
            );
        }

        const warnings: string[] = [];
        const waypointWeatherData: Array<{
            waypoint: Waypoint;
            weather: WeatherInterpolationResult;
            travelTime: Date;
        }> = [];

        // Determine which waypoints to sample for weather
        const samplingWaypoints = this.selectWeatherSamplingPoints(route, intervalKm);

        // Get weather data for sampling points
        const weatherPromises = samplingWaypoints.map(async (waypoint) => {
            const travelTime = new Date(startTime.getTime() + waypoint.estimatedTimeFromStart * 1000);
            const location: Location = {
                name: `Route point at ${waypoint.coordinates.latitude.toFixed(4)}, ${waypoint.coordinates.longitude.toFixed(4)}`,
                coordinates: waypoint.coordinates
            };

            try {
                const weather = await this.getWeatherForLocationAndTime(location, travelTime);
                return {
                    waypoint,
                    weather: {
                        forecast: weather,
                        confidence: 1.0,
                        interpolated: false
                    } as WeatherInterpolationResult,
                    travelTime
                };
            } catch (error) {
                console.warn(`Failed to get weather for waypoint at ${waypoint.coordinates.latitude}, ${waypoint.coordinates.longitude}:`, error);
                warnings.push(`Weather data unavailable for point at ${waypoint.distanceFromStart.toFixed(1)}km`);
                return null;
            }
        });

        const weatherResults = await Promise.all(weatherPromises);
        const validWeatherResults = weatherResults.filter(result => result !== null) as Array<{
            waypoint: Waypoint;
            weather: WeatherInterpolationResult;
            travelTime: Date;
        }>;

        // If interpolation is enabled, fill in missing data points
        if (includeInterpolation && validWeatherResults.length >= 2) {
            const interpolatedResults = await this.interpolateWeatherAlongRoute(
                route,
                validWeatherResults,
                startTime
            );
            waypointWeatherData.push(...interpolatedResults);
        } else {
            waypointWeatherData.push(...validWeatherResults);
        }

        // Sort by distance from start
        waypointWeatherData.sort((a, b) => a.waypoint.distanceFromStart - b.waypoint.distanceFromStart);

        // Add warnings for data quality
        const missingDataPoints = samplingWaypoints.length - validWeatherResults.length;
        if (missingDataPoints > 0) {
            warnings.push(`${missingDataPoints} weather data points could not be retrieved`);
        }

        if (validWeatherResults.length < 2 && includeInterpolation) {
            warnings.push('Insufficient data points for weather interpolation');
        }

        // Check for significant weather changes along route
        this.analyzeWeatherPatterns(waypointWeatherData, warnings);

        return {
            waypoints: waypointWeatherData,
            route,
            startTime,
            totalForecasts: waypointWeatherData.length,
            missingDataPoints,
            warnings
        };
    }

    /**
     * Interpolate weather data between known points along a route
     */
    async interpolateWeatherAlongRoute(
        route: Route,
        knownWeatherPoints: Array<{
            waypoint: Waypoint;
            weather: WeatherInterpolationResult;
            travelTime: Date;
        }>,
        startTime: Date
    ): Promise<Array<{
        waypoint: Waypoint;
        weather: WeatherInterpolationResult;
        travelTime: Date;
    }>> {
        const interpolatedResults: Array<{
            waypoint: Waypoint;
            weather: WeatherInterpolationResult;
            travelTime: Date;
        }> = [...knownWeatherPoints];

        // Sort known points by distance
        knownWeatherPoints.sort((a, b) => a.waypoint.distanceFromStart - b.waypoint.distanceFromStart);

        // Interpolate weather for all route waypoints
        for (const waypoint of route.waypoints) {
            // Skip if we already have weather data for this point
            if (knownWeatherPoints.some(kp =>
                Math.abs(kp.waypoint.distanceFromStart - waypoint.distanceFromStart) < 0.1
            )) {
                continue;
            }

            const interpolatedWeather = this.interpolateWeatherAtPoint(
                waypoint,
                knownWeatherPoints,
                startTime
            );

            if (interpolatedWeather) {
                const travelTime = new Date(startTime.getTime() + waypoint.estimatedTimeFromStart * 1000);
                interpolatedResults.push({
                    waypoint,
                    weather: interpolatedWeather,
                    travelTime
                });
            }
        }

        return interpolatedResults;
    }

    /**
     * Interpolate weather data at a specific point based on surrounding known points
     */
    private interpolateWeatherAtPoint(
        targetWaypoint: Waypoint,
        knownPoints: Array<{
            waypoint: Waypoint;
            weather: WeatherInterpolationResult;
            travelTime: Date;
        }>,
        startTime: Date
    ): WeatherInterpolationResult | null {
        if (knownPoints.length < 2) {
            return null;
        }

        // Find the two closest points (one before, one after if possible)
        const targetDistance = targetWaypoint.distanceFromStart;
        const targetTime = targetWaypoint.estimatedTimeFromStart;

        let beforePoint: typeof knownPoints[0] | null = null;
        let afterPoint: typeof knownPoints[0] | null = null;

        for (const point of knownPoints) {
            if (point.waypoint.distanceFromStart <= targetDistance) {
                if (!beforePoint || point.waypoint.distanceFromStart > beforePoint.waypoint.distanceFromStart) {
                    beforePoint = point;
                }
            }
            if (point.waypoint.distanceFromStart >= targetDistance) {
                if (!afterPoint || point.waypoint.distanceFromStart < afterPoint.waypoint.distanceFromStart) {
                    afterPoint = point;
                }
            }
        }

        // If we don't have points on both sides, use the closest point
        if (!beforePoint && afterPoint) {
            beforePoint = afterPoint;
        } else if (beforePoint && !afterPoint) {
            afterPoint = beforePoint;
        }

        if (!beforePoint || !afterPoint) {
            return null;
        }

        // Calculate interpolation weights based on distance and time
        const distanceWeight = this.calculateInterpolationWeight(
            targetDistance,
            beforePoint.waypoint.distanceFromStart,
            afterPoint.waypoint.distanceFromStart
        );

        const timeWeight = this.calculateInterpolationWeight(
            targetTime,
            beforePoint.waypoint.estimatedTimeFromStart,
            afterPoint.waypoint.estimatedTimeFromStart
        );

        // Use average of distance and time weights
        const weight = (distanceWeight + timeWeight) / 2;

        // Interpolate weather data
        const interpolatedForecast = this.interpolateWeatherData(
            beforePoint.weather.forecast,
            afterPoint.weather.forecast,
            weight,
            targetWaypoint,
            new Date(startTime.getTime() + targetTime * 1000)
        );

        // Calculate confidence based on distance between interpolation points
        const interpolationDistance = Math.abs(afterPoint.waypoint.distanceFromStart - beforePoint.waypoint.distanceFromStart);
        const confidence = Math.max(0.3, 1.0 - (interpolationDistance / 200)); // Reduce confidence for long interpolations

        return {
            forecast: interpolatedForecast,
            confidence,
            interpolated: true,
            sourceForecasts: [beforePoint.weather.forecast, afterPoint.weather.forecast]
        };
    }

    /**
     * Calculate interpolation weight (0 = use first value, 1 = use second value)
     */
    private calculateInterpolationWeight(target: number, start: number, end: number): number {
        if (Math.abs(end - start) < 0.001) {
            return 0.5; // If points are very close, use equal weighting
        }
        return Math.max(0, Math.min(1, (target - start) / (end - start)));
    }

    /**
     * Interpolate between two weather forecasts
     */
    private interpolateWeatherData(
        forecast1: WeatherForecast,
        forecast2: WeatherForecast,
        weight: number,
        targetWaypoint: Waypoint,
        targetTime: Date
    ): WeatherForecast {
        // Linear interpolation for numerical values
        const interpolateNumber = (a: number, b: number) => a + (b - a) * weight;

        // For categorical values, choose based on weight threshold
        const interpolateCategory = <T>(a: T, b: T, threshold: number = 0.5): T => {
            return weight < threshold ? a : b;
        };

        // Create location for the interpolated point
        const location: Location = {
            name: `Interpolated point at ${targetWaypoint.coordinates.latitude.toFixed(4)}, ${targetWaypoint.coordinates.longitude.toFixed(4)}`,
            coordinates: targetWaypoint.coordinates
        };

        return {
            location,
            timestamp: targetTime,
            temperature: {
                current: Math.round(interpolateNumber(forecast1.temperature.current, forecast2.temperature.current)),
                feelsLike: Math.round(interpolateNumber(forecast1.temperature.feelsLike, forecast2.temperature.feelsLike)),
                min: Math.round(interpolateNumber(forecast1.temperature.min, forecast2.temperature.min)),
                max: Math.round(interpolateNumber(forecast1.temperature.max, forecast2.temperature.max))
            },
            conditions: {
                main: interpolateCategory(forecast1.conditions.main, forecast2.conditions.main),
                description: weight < 0.5 ? forecast1.conditions.description : forecast2.conditions.description,
                icon: weight < 0.5 ? forecast1.conditions.icon : forecast2.conditions.icon
            },
            precipitation: {
                type: interpolateCategory(forecast1.precipitation.type, forecast2.precipitation.type),
                probability: Math.round(interpolateNumber(forecast1.precipitation.probability, forecast2.precipitation.probability)),
                intensity: Math.round(interpolateNumber(forecast1.precipitation.intensity, forecast2.precipitation.intensity))
            },
            wind: {
                speed: Math.round(interpolateNumber(forecast1.wind.speed, forecast2.wind.speed) * 10) / 10,
                direction: this.interpolateWindDirection(forecast1.wind.direction, forecast2.wind.direction, weight)
            },
            humidity: Math.round(interpolateNumber(forecast1.humidity, forecast2.humidity)),
            visibility: Math.round(interpolateNumber(forecast1.visibility, forecast2.visibility))
        };
    }

    /**
     * Interpolate wind direction considering circular nature (0° = 360°)
     */
    private interpolateWindDirection(dir1: number, dir2: number, weight: number): number {
        // Handle circular interpolation for wind direction
        let diff = dir2 - dir1;

        // Choose the shorter path around the circle
        if (diff > 180) {
            diff -= 360;
        } else if (diff < -180) {
            diff += 360;
        }

        let result = dir1 + diff * weight;

        // Normalize to 0-360 range
        if (result < 0) {
            result += 360;
        } else if (result >= 360) {
            result -= 360;
        }

        return Math.round(result);
    }

    /**
     * Select optimal waypoints for weather sampling based on route characteristics
     */
    private selectWeatherSamplingPoints(route: Route, intervalKm?: number): Waypoint[] {
        const defaultInterval = intervalKm || this.getDefaultWeatherSamplingInterval(route);
        const samplingPoints: Waypoint[] = [];

        // Always include start and end points
        if (route.waypoints.length > 0) {
            samplingPoints.push(route.waypoints[0]);
        }

        // Add intermediate points based on interval
        let nextSamplingDistance = defaultInterval;
        for (const waypoint of route.waypoints) {
            if (waypoint.distanceFromStart >= nextSamplingDistance) {
                samplingPoints.push(waypoint);
                nextSamplingDistance += defaultInterval;
            }
        }

        // Always include destination
        if (route.waypoints.length > 1) {
            const lastWaypoint = route.waypoints[route.waypoints.length - 1];
            if (!samplingPoints.includes(lastWaypoint)) {
                samplingPoints.push(lastWaypoint);
            }
        }

        return samplingPoints;
    }

    /**
     * Get default weather sampling interval based on route characteristics
     */
    private getDefaultWeatherSamplingInterval(route: Route): number {
        // Adjust sampling interval based on route length and travel mode
        const baseInterval = route.totalDistance < 100 ? 25 : 50; // km

        // More frequent sampling for slower travel modes
        switch (route.travelMode) {
            case 'walking':
                return Math.min(baseInterval, 10);
            case 'cycling':
                return Math.min(baseInterval, 20);
            case 'driving':
                return baseInterval;
            case 'flying':
                return Math.max(baseInterval, 100);
            case 'sailing':
            case 'cruise':
                return Math.max(baseInterval, 75);
            default:
                return baseInterval;
        }
    }

    /**
     * Analyze weather patterns along route and add relevant warnings
     */
    private analyzeWeatherPatterns(
        waypointWeatherData: Array<{
            waypoint: Waypoint;
            weather: WeatherInterpolationResult;
            travelTime: Date;
        }>,
        warnings: string[]
    ): void {
        if (waypointWeatherData.length < 2) {
            return;
        }

        // Check for significant temperature changes
        const temperatures = waypointWeatherData.map(w => w.weather.forecast.temperature.current);
        const tempRange = Math.max(...temperatures) - Math.min(...temperatures);
        if (tempRange > 15) {
            warnings.push(`Significant temperature variation along route: ${tempRange}°C difference`);
        }

        // Check for precipitation changes
        const precipitationTypes = new Set(waypointWeatherData.map(w => w.weather.forecast.precipitation.type));
        if (precipitationTypes.size > 2) {
            warnings.push('Multiple precipitation types expected along route');
        }

        // Check for severe weather conditions
        const severeConditions = waypointWeatherData.filter(w =>
            w.weather.forecast.conditions.main === WeatherCondition.STORMY ||
            w.weather.forecast.precipitation.intensity >= 7 ||
            w.weather.forecast.wind.speed > 50
        );

        if (severeConditions.length > 0) {
            warnings.push(`Severe weather conditions detected at ${severeConditions.length} points along route`);
        }

        // Check for low visibility conditions
        const lowVisibility = waypointWeatherData.filter(w => w.weather.forecast.visibility < 5);
        if (lowVisibility.length > 0) {
            warnings.push(`Low visibility conditions (< 5km) expected at ${lowVisibility.length} points`);
        }

        // Check for interpolated data quality
        const interpolatedPoints = waypointWeatherData.filter(w => w.weather.interpolated);
        const lowConfidencePoints = interpolatedPoints.filter(w => w.weather.confidence < 0.6);
        if (lowConfidencePoints.length > 0) {
            warnings.push(`${lowConfidencePoints.length} weather predictions have low confidence due to sparse data`);
        }
    }

    /**
     * Get weather timeline for a route with specific time intervals
     */
    async getWeatherTimeline(
        route: Route,
        startTime: Date,
        timeIntervalMinutes: number = 60
    ): Promise<Array<{
        time: Date;
        location: Location;
        weather: WeatherForecast;
        distanceFromStart: number;
        estimatedProgress: number;
    }>> {
        const timeline: Array<{
            time: Date;
            location: Location;
            weather: WeatherForecast;
            distanceFromStart: number;
            estimatedProgress: number;
        }> = [];

        const totalDurationMinutes = route.estimatedDuration / 60;
        const timePoints = Math.ceil(totalDurationMinutes / timeIntervalMinutes);

        for (let i = 0; i <= timePoints; i++) {
            const timeOffset = i * timeIntervalMinutes * 60 * 1000; // Convert to milliseconds
            const currentTime = new Date(startTime.getTime() + timeOffset);
            const progress = Math.min(i * timeIntervalMinutes * 60, route.estimatedDuration) / route.estimatedDuration;

            // Find the corresponding waypoint for this time
            const targetTimeSeconds = i * timeIntervalMinutes * 60;
            const waypoint = this.findWaypointAtTime(route.waypoints, targetTimeSeconds);

            if (waypoint) {
                const location: Location = {
                    name: `Route position at ${currentTime.toISOString()}`,
                    coordinates: waypoint.coordinates
                };

                try {
                    const weather = await this.getWeatherForLocationAndTime(location, currentTime);
                    timeline.push({
                        time: currentTime,
                        location,
                        weather,
                        distanceFromStart: waypoint.distanceFromStart,
                        estimatedProgress: progress
                    });
                } catch (error) {
                    console.warn(`Failed to get weather for timeline point at ${currentTime.toISOString()}:`, error);
                }
            }
        }

        return timeline;
    }

    /**
     * Find waypoint at a specific time during the journey
     */
    private findWaypointAtTime(waypoints: Waypoint[], targetTimeSeconds: number): Waypoint | null {
        if (waypoints.length === 0) {
            return null;
        }

        // Find the waypoint closest to the target time
        let closestWaypoint = waypoints[0];
        let smallestTimeDiff = Math.abs(waypoints[0].estimatedTimeFromStart - targetTimeSeconds);

        for (const waypoint of waypoints) {
            const timeDiff = Math.abs(waypoint.estimatedTimeFromStart - targetTimeSeconds);
            if (timeDiff < smallestTimeDiff) {
                smallestTimeDiff = timeDiff;
                closestWaypoint = waypoint;
            }
        }

        // If target time is beyond the last waypoint, interpolate position
        if (targetTimeSeconds > waypoints[waypoints.length - 1].estimatedTimeFromStart) {
            return waypoints[waypoints.length - 1];
        }

        // If we need to interpolate between waypoints
        if (smallestTimeDiff > 300) { // More than 5 minutes difference
            return this.interpolateWaypointAtTime(waypoints, targetTimeSeconds);
        }

        return closestWaypoint;
    }

    /**
     * Interpolate waypoint position at a specific time
     */
    private interpolateWaypointAtTime(waypoints: Waypoint[], targetTimeSeconds: number): Waypoint {
        // Find the two waypoints that bracket the target time
        let beforeWaypoint: Waypoint | null = null;
        let afterWaypoint: Waypoint | null = null;

        for (let i = 0; i < waypoints.length - 1; i++) {
            if (waypoints[i].estimatedTimeFromStart <= targetTimeSeconds &&
                waypoints[i + 1].estimatedTimeFromStart >= targetTimeSeconds) {
                beforeWaypoint = waypoints[i];
                afterWaypoint = waypoints[i + 1];
                break;
            }
        }

        // If we can't find bracketing waypoints, return the closest one
        if (!beforeWaypoint || !afterWaypoint) {
            return waypoints.reduce((closest, waypoint) => {
                const currentDiff = Math.abs(waypoint.estimatedTimeFromStart - targetTimeSeconds);
                const closestDiff = Math.abs(closest.estimatedTimeFromStart - targetTimeSeconds);
                return currentDiff < closestDiff ? waypoint : closest;
            });
        }

        // Interpolate between the two waypoints
        const timeDiff = afterWaypoint.estimatedTimeFromStart - beforeWaypoint.estimatedTimeFromStart;
        const timeProgress = (targetTimeSeconds - beforeWaypoint.estimatedTimeFromStart) / timeDiff;

        return {
            coordinates: {
                latitude: beforeWaypoint.coordinates.latitude +
                    (afterWaypoint.coordinates.latitude - beforeWaypoint.coordinates.latitude) * timeProgress,
                longitude: beforeWaypoint.coordinates.longitude +
                    (afterWaypoint.coordinates.longitude - beforeWaypoint.coordinates.longitude) * timeProgress
            },
            distanceFromStart: beforeWaypoint.distanceFromStart +
                (afterWaypoint.distanceFromStart - beforeWaypoint.distanceFromStart) * timeProgress,
            estimatedTimeFromStart: targetTimeSeconds
        };
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
            console.log(`🧹 Cleared ${expiredKeys.length} expired weather cache entries`);
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

    private generateCacheKey(location: Location, type: string, timestamp?: Date): string {
        const coords = `${location.coordinates.latitude.toFixed(4)},${location.coordinates.longitude.toFixed(4)}`;
        const timeKey = timestamp ? timestamp.toISOString().slice(0, 13) : 'current'; // Hour precision
        return `${type}:${coords}:${timeKey}`;
    }

    private getCachedResult(cacheKey: string): WeatherForecast | null {
        const entry = this.cache.get(cacheKey);
        if (!entry) {
            return null;
        }

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(cacheKey);
            return null;
        }

        return entry.forecast;
    }

    private cacheResult(cacheKey: string, forecast: WeatherForecast): void {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(cacheKey, {
            forecast,
            timestamp: Date.now(),
            ttl: this.cacheTTL
        });
    }

    private async makeCurrentWeatherRequest(location: Location): Promise<WeatherForecast> {
        const url = new URL(`${this.baseUrl}/weather`);
        url.searchParams.set('lat', location.coordinates.latitude.toString());
        url.searchParams.set('lon', location.coordinates.longitude.toString());
        url.searchParams.set('appid', this.apiKey);
        url.searchParams.set('units', this.units);
        url.searchParams.set('lang', this.language);

        const response = await fetch(url.toString());

        if (!response) {
            throw this.createWeatherError(
                'API_REQUEST_FAILED',
                'Weather API request failed: No response received',
                ['Please try again later', 'Check your internet connection']
            );
        }

        if (!response.ok) {
            if (response.status === 401) {
                throw this.createWeatherError(
                    'INVALID_API_KEY',
                    'Invalid weather API key',
                    ['Check your API key configuration', 'Ensure the API key has proper permissions']
                );
            }
            if (response.status === 429) {
                throw this.createWeatherError(
                    'RATE_LIMIT_EXCEEDED',
                    'Weather API rate limit exceeded',
                    ['Wait a few minutes before trying again', 'Consider upgrading your API plan']
                );
            }
            throw this.createWeatherError(
                'API_REQUEST_FAILED',
                `Weather API request failed: ${response.status} ${response.statusText}`,
                ['Please try again later', 'Check your internet connection']
            );
        }

        const data: OpenWeatherMapResponse = await response.json();
        return this.normalizeCurrentWeatherData(data, location);
    }

    private async makeForecastWeatherRequest(location: Location, timestamp: Date): Promise<WeatherForecast> {
        const url = new URL(`${this.baseUrl}/forecast`);
        url.searchParams.set('lat', location.coordinates.latitude.toString());
        url.searchParams.set('lon', location.coordinates.longitude.toString());
        url.searchParams.set('appid', this.apiKey);
        url.searchParams.set('units', this.units);
        url.searchParams.set('lang', this.language);

        const response = await fetch(url.toString());

        if (!response) {
            throw this.createWeatherError(
                'API_REQUEST_FAILED',
                'Weather forecast API request failed: No response received',
                ['Please try again later']
            );
        }

        if (!response.ok) {
            if (response.status === 401) {
                throw this.createWeatherError(
                    'INVALID_API_KEY',
                    'Invalid weather API key',
                    ['Check your API key configuration']
                );
            }
            throw this.createWeatherError(
                'API_REQUEST_FAILED',
                `Weather forecast API request failed: ${response.status}`,
                ['Please try again later']
            );
        }

        const data: OpenWeatherMapForecastResponse = await response.json();
        return this.findClosestForecast(data, location, timestamp);
    }

    private normalizeCurrentWeatherData(data: OpenWeatherMapResponse, location: Location): WeatherForecast {
        const weather = data.weather[0];
        const precipitationType = this.determinePrecipitationType(weather.id, data.rain, data.snow);
        const precipitationIntensity = this.calculatePrecipitationIntensity(data.rain, data.snow);

        return {
            location,
            timestamp: new Date(data.dt * 1000),
            temperature: {
                current: Math.round(data.main.temp),
                feelsLike: Math.round(data.main.feels_like),
                min: Math.round(data.main.temp_min),
                max: Math.round(data.main.temp_max)
            },
            conditions: {
                main: this.mapWeatherCondition(weather.main, weather.id),
                description: weather.description,
                icon: weather.icon
            },
            precipitation: {
                type: precipitationType,
                probability: precipitationType !== PrecipitationType.NONE ? 100 : 0, // Current weather is 100% if present
                intensity: precipitationIntensity
            },
            wind: {
                speed: Math.round(data.wind.speed * 10) / 10, // Round to 1 decimal
                direction: data.wind.deg
            },
            humidity: data.main.humidity,
            visibility: Math.round(data.visibility / 1000) // Convert to km and round
        };
    }

    private findClosestForecast(data: OpenWeatherMapForecastResponse, location: Location, targetTimestamp: Date): WeatherForecast {
        if (!data.list || data.list.length === 0) {
            throw this.createWeatherError(
                'NO_FORECAST_DATA',
                'No forecast data available for the requested time',
                ['Try a different time period', 'Check if the location supports weather forecasts']
            );
        }

        const targetTime = targetTimestamp.getTime();
        let closestForecast = data.list[0];
        let smallestDiff = Math.abs(closestForecast.dt * 1000 - targetTime);

        // Find the forecast entry closest to the target timestamp
        for (const forecast of data.list) {
            const diff = Math.abs(forecast.dt * 1000 - targetTime);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                closestForecast = forecast;
            }
        }

        const weather = closestForecast.weather[0];
        const precipitationType = this.determinePrecipitationType(weather.id, closestForecast.rain, closestForecast.snow);
        const precipitationIntensity = this.calculatePrecipitationIntensity(closestForecast.rain, closestForecast.snow);

        return {
            location,
            timestamp: new Date(closestForecast.dt * 1000),
            temperature: {
                current: Math.round(closestForecast.main.temp),
                feelsLike: Math.round(closestForecast.main.feels_like),
                min: Math.round(closestForecast.main.temp_min),
                max: Math.round(closestForecast.main.temp_max)
            },
            conditions: {
                main: this.mapWeatherCondition(weather.main, weather.id),
                description: weather.description,
                icon: weather.icon
            },
            precipitation: {
                type: precipitationType,
                probability: Math.round(closestForecast.pop * 100), // Convert to percentage
                intensity: precipitationIntensity
            },
            wind: {
                speed: Math.round(closestForecast.wind.speed * 10) / 10,
                direction: closestForecast.wind.deg
            },
            humidity: closestForecast.main.humidity,
            visibility: Math.round(closestForecast.visibility / 1000)
        };
    }

    private mapWeatherCondition(main: string, id: number): WeatherCondition {
        // Map OpenWeatherMap conditions to our enum
        switch (main.toLowerCase()) {
            case 'clear':
                return WeatherCondition.SUNNY;
            case 'clouds':
                return id === 804 ? WeatherCondition.OVERCAST : WeatherCondition.CLOUDY;
            case 'rain':
            case 'drizzle':
                return WeatherCondition.RAINY;
            case 'thunderstorm':
                return WeatherCondition.STORMY;
            case 'snow':
                return WeatherCondition.SNOWY;
            case 'mist':
            case 'fog':
            case 'haze':
                return WeatherCondition.FOGGY;
            default:
                return WeatherCondition.CLOUDY;
        }
    }

    private determinePrecipitationType(weatherId: number, rain?: any, snow?: any): PrecipitationType {
        // Check for hail first (severe thunderstorms)
        if (weatherId >= 200 && weatherId <= 202) {
            return PrecipitationType.HAIL; // Severe thunderstorms might have hail
        }

        // Check for sleet based on specific weather IDs
        if (weatherId === 611 || weatherId === 612 || weatherId === 613) {
            return PrecipitationType.SLEET;
        }

        // Determine precipitation type based on actual precipitation data first
        if (snow && (snow['1h'] > 0 || snow['3h'] > 0)) {
            return PrecipitationType.SNOW;
        }

        if (rain && (rain['1h'] > 0 || rain['3h'] > 0)) {
            return PrecipitationType.RAIN;
        }

        // Use weather ID for more specific precipitation types
        if (weatherId >= 200 && weatherId < 300) {
            return PrecipitationType.RAIN; // Thunderstorm
        }
        if (weatherId >= 300 && weatherId < 400) {
            return PrecipitationType.RAIN; // Drizzle
        }
        if (weatherId >= 500 && weatherId < 600) {
            return PrecipitationType.RAIN; // Rain
        }
        if (weatherId >= 600 && weatherId < 700) {
            return PrecipitationType.SNOW;
        }

        return PrecipitationType.NONE;
    }

    private calculatePrecipitationIntensity(rain?: any, snow?: any): number {
        let intensity = 0;

        if (rain) {
            intensity += rain['1h'] || rain['3h'] || 0;
        }

        if (snow) {
            intensity += snow['1h'] || snow['3h'] || 0;
        }

        // Normalize intensity to a 0-10 scale
        if (intensity === 0) return 0;
        if (intensity < 0.5) return 1; // Light
        if (intensity < 2.5) return 3; // Light-moderate
        if (intensity < 7.5) return 5; // Moderate
        if (intensity < 15) return 7; // Moderate-heavy
        return 10; // Heavy
    }

    private getMockWeatherForecast(location: Location, timestamp?: Date): WeatherForecast {
        // Generate mock weather data for development
        const now = timestamp || new Date();
        const temp = 15 + Math.random() * 20; // Random temp between 15-35°C
        const conditions = [
            WeatherCondition.SUNNY,
            WeatherCondition.CLOUDY,
            WeatherCondition.RAINY,
            WeatherCondition.OVERCAST
        ];
        const precipTypes = [
            PrecipitationType.NONE,
            PrecipitationType.RAIN,
            PrecipitationType.NONE,
            PrecipitationType.NONE
        ];

        const conditionIndex = Math.floor(Math.random() * conditions.length);

        return {
            location,
            timestamp: now,
            temperature: {
                current: Math.round(temp),
                feelsLike: Math.round(temp + (Math.random() - 0.5) * 4),
                min: Math.round(temp - 5),
                max: Math.round(temp + 5)
            },
            conditions: {
                main: conditions[conditionIndex],
                description: `Mock ${conditions[conditionIndex]} weather`,
                icon: '01d'
            },
            precipitation: {
                type: precipTypes[conditionIndex],
                probability: precipTypes[conditionIndex] === PrecipitationType.NONE ? 0 : Math.round(Math.random() * 100),
                intensity: precipTypes[conditionIndex] === PrecipitationType.NONE ? 0 : Math.round(Math.random() * 5) + 1
            },
            wind: {
                speed: Math.round(Math.random() * 20 * 10) / 10,
                direction: Math.round(Math.random() * 360)
            },
            humidity: Math.round(30 + Math.random() * 60),
            visibility: Math.round(5 + Math.random() * 15)
        };
    }

    private createWeatherError(code: string, message: string, suggestions?: string[]): WeatherError {
        return new WeatherError(code, message, suggestions);
    }
}

// Export a singleton instance
export const weatherService = new WeatherService();