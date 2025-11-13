import { Location } from '@shared/types/location.js';
import { validateLocationString } from '@shared/utils/validation.js';
import { sanitizeLocationString } from '@shared/utils/sanitization.js';

export interface GeocodingResult {
    location: Location;
    confidence: number;
    suggestions?: string[];
}

export class GeocodingError extends Error {
    public code: string;
    public suggestions?: string[];

    constructor(code: string, message: string, suggestions?: string[]) {
        super(message);
        this.name = 'GeocodingError';
        this.code = code;
        this.suggestions = suggestions;
    }
}

interface CacheEntry {
    result: GeocodingResult;
    timestamp: number;
    ttl: number;
}

interface ExternalGeocodingResponse {
    results: Array<{
        formatted_address: string;
        geometry: {
            location: {
                lat: number;
                lng: number;
            };
        };
        place_id: string;
        types: string[];
    }>;
    status: string;
}

export class GeocodingService {
    private cache = new Map<string, CacheEntry>();
    private readonly apiKey: string;
    private readonly baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    private readonly cacheTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    private readonly maxCacheSize = 1000;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.GEOCODING_API_KEY || '';
        if (!this.apiKey) {
            console.warn('⚠️  Geocoding API key not provided. Service will use mock data.');
        }
    }

    /**
     * Geocode a location string to coordinates
     */
    async geocodeLocation(locationString: string): Promise<GeocodingResult> {
        // Input validation and sanitization
        const validationResult = validateLocationString(locationString);
        if (!validationResult.isValid) {
            throw this.createGeocodingError('INVALID_LOCATION_INPUT', 'Invalid location input', [
                'Please provide a valid location name, address, or coordinates',
                'Examples: "New York, NY", "123 Main St, Boston", "40.7128,-74.0060"'
            ]);
        }

        const sanitizedLocation = sanitizeLocationString(locationString);
        const cacheKey = sanitizedLocation.toLowerCase().trim();

        // Check cache first
        const cachedResult = this.getCachedResult(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        try {
            // If no API key, return mock data for development
            if (!this.apiKey) {
                return this.getMockGeocodingResult(sanitizedLocation);
            }

            // Make API request
            const result = await this.makeGeocodingRequest(sanitizedLocation);

            // Cache the result
            this.cacheResult(cacheKey, result);

            return result;
        } catch (error) {
            if (error instanceof GeocodingError) {
                throw error; // Re-throw our custom errors
            }

            // Handle unexpected errors
            console.error('Geocoding service error:', error);
            throw this.createGeocodingError(
                'GEOCODING_SERVICE_ERROR',
                'Failed to geocode location',
                [
                    'Please check your internet connection',
                    'Try a more specific location (e.g., include city and state)',
                    'Verify the location exists and is spelled correctly'
                ]
            );
        }
    }

    /**
     * Validate multiple locations in batch
     */
    async validateLocations(locations: string[]): Promise<{ [key: string]: GeocodingResult | GeocodingError }> {
        const results: { [key: string]: GeocodingResult | GeocodingError } = {};

        // Process locations concurrently but with rate limiting
        const batchSize = 5;
        for (let i = 0; i < locations.length; i += batchSize) {
            const batch = locations.slice(i, i + batchSize);
            const batchPromises = batch.map(async (location) => {
                try {
                    const result = await this.geocodeLocation(location);
                    return { location, result };
                } catch (error) {
                    return { location, result: error as GeocodingError };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(({ location, result }) => {
                results[location] = result;
            });

            // Small delay between batches to respect rate limits
            if (i + batchSize < locations.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return results;
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
            console.log(`🧹 Cleared ${expiredKeys.length} expired geocoding cache entries`);
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize
        };
    }

    private getCachedResult(cacheKey: string): GeocodingResult | null {
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

    private cacheResult(cacheKey: string, result: GeocodingResult): void {
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

    private async makeGeocodingRequest(location: string): Promise<GeocodingResult> {
        const url = new URL(this.baseUrl);
        url.searchParams.set('address', location);
        url.searchParams.set('key', this.apiKey);

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw this.createGeocodingError(
                'API_REQUEST_FAILED',
                `Geocoding API request failed: ${response.status} ${response.statusText}`,
                ['Please try again later', 'Check your internet connection']
            );
        }

        const data: ExternalGeocodingResponse = await response.json();

        return this.processGeocodingResponse(data, location);
    }

    private processGeocodingResponse(data: ExternalGeocodingResponse, originalInput: string): GeocodingResult {
        if (data.status === 'ZERO_RESULTS') {
            throw this.createGeocodingError(
                'LOCATION_NOT_FOUND',
                `Location "${originalInput}" not found`,
                [
                    'Try a more specific address (include city, state, or country)',
                    'Check spelling and try common abbreviations',
                    'Use landmarks or well-known places nearby'
                ]
            );
        }

        if (data.status === 'OVER_QUERY_LIMIT') {
            throw this.createGeocodingError(
                'RATE_LIMIT_EXCEEDED',
                'Too many requests. Please try again later.',
                ['Wait a few minutes before trying again']
            );
        }

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            throw this.createGeocodingError(
                'GEOCODING_FAILED',
                `Geocoding failed: ${data.status}`,
                ['Please try a different location format']
            );
        }

        const result = data.results[0];
        const location: Location = {
            name: this.extractLocationName(result.formatted_address),
            coordinates: {
                latitude: result.geometry.location.lat,
                longitude: result.geometry.location.lng
            },
            address: result.formatted_address
        };

        // Calculate confidence based on result quality
        const confidence = this.calculateConfidence(result, originalInput);

        // Generate suggestions if confidence is low or if there are multiple results
        const suggestions = (confidence < 0.8 || data.results.length > 1) ? this.generateSuggestions(data.results, originalInput) : undefined;

        return {
            location,
            confidence,
            suggestions
        };
    }

    private extractLocationName(formattedAddress: string): string {
        // Extract a clean location name from the formatted address
        const parts = formattedAddress.split(',');
        if (parts.length >= 2) {
            return `${parts[0].trim()}, ${parts[1].trim()}`;
        }
        return parts[0].trim();
    }

    private calculateConfidence(result: any, originalInput: string): number {
        let confidence = 0.5; // Base confidence

        // Boost confidence for exact matches
        const formattedLower = result.formatted_address.toLowerCase();
        const inputLower = originalInput.toLowerCase();

        if (formattedLower.includes(inputLower)) {
            confidence += 0.3;
        }

        // Boost confidence for specific location types
        const types = result.types || [];
        if (types.includes('street_address')) confidence += 0.4; // Higher boost for street addresses
        if (types.includes('locality')) confidence += 0.15;
        if (types.includes('administrative_area_level_1')) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }

    private generateSuggestions(results: any[], originalInput: string): string[] {
        const suggestions: string[] = [];

        // Add alternative results as suggestions
        results.slice(1, 4).forEach(result => {
            if (result.formatted_address) {
                suggestions.push(result.formatted_address);
            }
        });

        // Add generic suggestions
        suggestions.push(
            `Try "${originalInput}" with more specific details`,
            'Include city, state, or country in your search',
            'Use a nearby landmark or major intersection'
        );

        return suggestions.slice(0, 5); // Limit to 5 suggestions
    }

    private getMockGeocodingResult(location: string): GeocodingResult {
        // Mock data for development when no API key is provided
        const mockLocations: { [key: string]: Location } = {
            'new york': {
                name: 'New York, NY',
                coordinates: { latitude: 40.7128, longitude: -74.0060 },
                address: 'New York, NY, USA'
            },
            'los angeles': {
                name: 'Los Angeles, CA',
                coordinates: { latitude: 34.0522, longitude: -118.2437 },
                address: 'Los Angeles, CA, USA'
            },
            'chicago': {
                name: 'Chicago, IL',
                coordinates: { latitude: 41.8781, longitude: -87.6298 },
                address: 'Chicago, IL, USA'
            }
        };

        const normalizedInput = location.toLowerCase().trim();
        const mockLocation = mockLocations[normalizedInput] || mockLocations['new york'];

        return {
            location: mockLocation,
            confidence: 0.9,
            suggestions: Object.keys(mockLocations).map(key => mockLocations[key].address).filter((addr): addr is string => Boolean(addr))
        };
    }

    private createGeocodingError(code: string, message: string, suggestions?: string[]): GeocodingError {
        return new GeocodingError(code, message, suggestions);
    }
}

// Export a singleton instance
export const geocodingService = new GeocodingService();