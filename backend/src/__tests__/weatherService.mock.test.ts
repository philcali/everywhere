import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WeatherService } from '../services/weatherService.js';
import { WeatherCondition, PrecipitationType } from '@shared/types/weather.js';
import { Location } from '@shared/types/location.js';

// Mock fetch to ensure no network calls are made
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('WeatherService - Mock Data Tests', () => {
    let weatherService: WeatherService;
    
    const testLocation: Location = {
        name: 'Test City',
        coordinates: {
            latitude: 40.7128,
            longitude: -74.0060
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockClear();
        // Create service without API key to force mock data usage
        weatherService = new WeatherService();
    });

    describe('Mock data generation', () => {
        it('should generate realistic mock weather data without making network calls', async () => {
            const result = await weatherService.getCurrentWeather(testLocation);

            // Verify no network calls were made
            expect(mockFetch).not.toHaveBeenCalled();

            // Verify the structure and realistic values
            expect(result).toMatchObject({
                location: testLocation,
                timestamp: expect.any(Date),
                temperature: {
                    current: expect.any(Number),
                    feelsLike: expect.any(Number),
                    min: expect.any(Number),
                    max: expect.any(Number)
                },
                conditions: {
                    main: expect.any(String),
                    description: expect.any(String),
                    icon: expect.any(String)
                },
                precipitation: {
                    type: expect.any(String),
                    probability: expect.any(Number),
                    intensity: expect.any(Number)
                },
                wind: {
                    speed: expect.any(Number),
                    direction: expect.any(Number)
                },
                humidity: expect.any(Number),
                visibility: expect.any(Number)
            });

            // Verify realistic ranges
            expect(result.temperature.current).toBeGreaterThanOrEqual(-50);
            expect(result.temperature.current).toBeLessThanOrEqual(60);
            expect(result.humidity).toBeGreaterThanOrEqual(0);
            expect(result.humidity).toBeLessThanOrEqual(100);
            expect(result.wind.direction).toBeGreaterThanOrEqual(0);
            expect(result.wind.direction).toBeLessThan(360);
            expect(result.precipitation.probability).toBeGreaterThanOrEqual(0);
            expect(result.precipitation.probability).toBeLessThanOrEqual(100);

            // Verify valid enum values
            expect(Object.values(WeatherCondition)).toContain(result.conditions.main);
            expect(Object.values(PrecipitationType)).toContain(result.precipitation.type);
        });

        it('should generate different mock data for different locations', async () => {
            const location1: Location = {
                name: 'Location 1',
                coordinates: { latitude: 40.7128, longitude: -74.0060 }
            };

            const location2: Location = {
                name: 'Location 2',
                coordinates: { latitude: 51.5074, longitude: -0.1278 }
            };

            const result1 = await weatherService.getCurrentWeather(location1);
            const result2 = await weatherService.getCurrentWeather(location2);

            // Verify no network calls
            expect(mockFetch).not.toHaveBeenCalled();

            // Results should be different (at least some properties)
            const isDifferent = 
                result1.temperature.current !== result2.temperature.current ||
                result1.conditions.main !== result2.conditions.main ||
                result1.wind.speed !== result2.wind.speed;

            expect(isDifferent).toBe(true);
        });

        it('should handle forecast requests with mock data', async () => {
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const result = await weatherService.getForecastWeather(testLocation, futureDate);

            // Verify no network calls
            expect(mockFetch).not.toHaveBeenCalled();

            // Verify structure
            expect(result.location).toEqual(testLocation);
            expect(result.timestamp).toEqual(futureDate);
            expect(Object.values(WeatherCondition)).toContain(result.conditions.main);
        });

        it('should handle route weather forecasts with mock data', async () => {
            const locations: Location[] = [
                { name: 'Start', coordinates: { latitude: 40.7128, longitude: -74.0060 } },
                { name: 'Middle', coordinates: { latitude: 41.0, longitude: -73.0 } },
                { name: 'End', coordinates: { latitude: 42.3601, longitude: -71.0589 } }
            ];

            const results = await weatherService.getRouteWeatherForecast(locations);

            // Verify no network calls
            expect(mockFetch).not.toHaveBeenCalled();

            // Verify results
            expect(results).toHaveLength(3);
            results.forEach((result, index) => {
                expect(result.location).toEqual(locations[index]);
                expect(Object.values(WeatherCondition)).toContain(result.conditions.main);
            });
        });

        it('should handle weather for location and time with mock data', async () => {
            const currentTime = new Date();
            const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
            const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000);

            const currentResult = await weatherService.getWeatherForLocationAndTime(testLocation, currentTime);
            const futureResult = await weatherService.getWeatherForLocationAndTime(testLocation, futureTime);
            const pastResult = await weatherService.getWeatherForLocationAndTime(testLocation, pastTime);

            // Verify no network calls
            expect(mockFetch).not.toHaveBeenCalled();

            // All should return valid weather data
            [currentResult, futureResult, pastResult].forEach(result => {
                expect(result.location).toEqual(testLocation);
                expect(Object.values(WeatherCondition)).toContain(result.conditions.main);
            });
        });
    });

    describe('Error handling without network', () => {
        it('should handle empty locations array without network calls', async () => {
            await expect(weatherService.getRouteWeatherForecast([]))
                .rejects.toThrow('No locations provided for weather forecast');

            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should provide cache statistics without network calls', () => {
            const stats = weatherService.getCacheStats();
            
            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(typeof stats.size).toBe('number');
            expect(typeof stats.maxSize).toBe('number');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should clear cache without network calls', () => {
            weatherService.clearExpiredCache();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('Consistency checks', () => {
        it('should return consistent data for the same location within cache period', async () => {
            const result1 = await weatherService.getCurrentWeather(testLocation);
            const result2 = await weatherService.getCurrentWeather(testLocation);

            // Should be identical due to caching
            expect(result1).toEqual(result2);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should generate seasonal appropriate mock data', async () => {
            // Test with different timestamps to see if seasonal variation exists
            const winterDate = new Date('2024-01-15T12:00:00Z');
            const summerDate = new Date('2024-07-15T12:00:00Z');

            const winterResult = await weatherService.getForecastWeather(testLocation, winterDate);
            const summerResult = await weatherService.getForecastWeather(testLocation, summerDate);

            expect(mockFetch).not.toHaveBeenCalled();

            // Both should be valid weather data
            expect(Object.values(WeatherCondition)).toContain(winterResult.conditions.main);
            expect(Object.values(WeatherCondition)).toContain(summerResult.conditions.main);
        });
    });
});