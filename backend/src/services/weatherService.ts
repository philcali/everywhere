import { WeatherForecast, WeatherCondition, PrecipitationType } from '@shared/types/weather.js';
import { Location } from '@shared/types/location.js';

export interface WeatherQuery {
    location: Location;
    timestamp?: Date;
    includeHourly?: boolean;
    includeDailyForecast?: boolean;
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