import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WeatherService, WeatherError } from '../services/weatherService.js';
import { WeatherCondition, PrecipitationType } from '@shared/types/weather.js';
import { Location } from '@shared/types/location.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WeatherService', () => {
    let weatherService: WeatherService;
    const mockLocation: Location = {
        name: 'New York, NY',
        coordinates: {
            latitude: 40.7128,
            longitude: -74.0060
        },
        address: 'New York, NY, USA'
    };

    const mockCurrentWeatherResponse = {
        coord: { lon: -74.0060, lat: 40.7128 },
        weather: [{
            id: 800,
            main: 'Clear',
            description: 'clear sky',
            icon: '01d'
        }],
        main: {
            temp: 22.5,
            feels_like: 24.1,
            temp_min: 20.0,
            temp_max: 25.0,
            pressure: 1013,
            humidity: 65
        },
        visibility: 10000,
        wind: {
            speed: 3.5,
            deg: 180
        },
        dt: 1640995200,
        sys: {
            country: 'US',
            sunrise: 1640952000,
            sunset: 1640988000
        },
        name: 'New York'
    };

    const mockForecastResponse = {
        list: [{
            dt: 1640995200,
            main: {
                temp: 18.5,
                feels_like: 19.2,
                temp_min: 16.0,
                temp_max: 20.0,
                pressure: 1015,
                humidity: 70
            },
            weather: [{
                id: 500,
                main: 'Rain',
                description: 'light rain',
                icon: '10d'
            }],
            wind: {
                speed: 4.2,
                deg: 220
            },
            visibility: 8000,
            pop: 0.65,
            rain: {
                '3h': 1.2
            }
        }],
        city: {
            id: 5128581,
            name: 'New York',
            coord: { lat: 40.7128, lon: -74.0060 },
            country: 'US'
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        weatherService = new WeatherService({ apiKey: 'test-api-key' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getCurrentWeather', () => {
        it('should return current weather data successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockCurrentWeatherResponse
            });

            const result = await weatherService.getCurrentWeather(mockLocation);

            expect(result).toMatchObject({
                location: mockLocation,
                temperature: {
                    current: 23,
                    feelsLike: 24,
                    min: 20,
                    max: 25
                },
                conditions: {
                    main: WeatherCondition.SUNNY,
                    description: 'clear sky',
                    icon: '01d'
                },
                precipitation: {
                    type: PrecipitationType.NONE,
                    probability: 0,
                    intensity: 0
                },
                wind: {
                    speed: 3.5,
                    direction: 180
                },
                humidity: 65,
                visibility: 10
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('api.openweathermap.org/data/2.5/weather')
            );
        });

        it('should handle rainy weather conditions correctly', async () => {
            const rainyResponse = {
                ...mockCurrentWeatherResponse,
                weather: [{
                    id: 500,
                    main: 'Rain',
                    description: 'light rain',
                    icon: '10d'
                }],
                rain: {
                    '1h': 2.5
                }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => rainyResponse
            });

            const result = await weatherService.getCurrentWeather(mockLocation);

            expect(result.conditions.main).toBe(WeatherCondition.RAINY);
            expect(result.precipitation.type).toBe(PrecipitationType.RAIN);
            expect(result.precipitation.probability).toBe(100);
            expect(result.precipitation.intensity).toBeGreaterThan(0);
        });

        it('should handle snowy weather conditions correctly', async () => {
            const snowyResponse = {
                ...mockCurrentWeatherResponse,
                weather: [{
                    id: 600,
                    main: 'Snow',
                    description: 'light snow',
                    icon: '13d'
                }],
                snow: {
                    '1h': 1.8
                }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => snowyResponse
            });

            const result = await weatherService.getCurrentWeather(mockLocation);

            expect(result.conditions.main).toBe(WeatherCondition.SNOWY);
            expect(result.precipitation.type).toBe(PrecipitationType.SNOW);
            expect(result.precipitation.probability).toBe(100);
            expect(result.precipitation.intensity).toBeGreaterThan(0);
        });

        it('should handle stormy weather conditions correctly', async () => {
            const stormyResponse = {
                ...mockCurrentWeatherResponse,
                weather: [{
                    id: 200,
                    main: 'Thunderstorm',
                    description: 'thunderstorm with light rain',
                    icon: '11d'
                }],
                rain: {
                    '1h': 3.2
                }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => stormyResponse
            });

            const result = await weatherService.getCurrentWeather(mockLocation);

            expect(result.conditions.main).toBe(WeatherCondition.STORMY);
            expect(result.precipitation.type).toBe(PrecipitationType.HAIL); // Severe thunderstorms might have hail
        });

        it('should handle cloudy and overcast conditions correctly', async () => {
            const cloudyResponse = {
                ...mockCurrentWeatherResponse,
                weather: [{
                    id: 801,
                    main: 'Clouds',
                    description: 'few clouds',
                    icon: '02d'
                }]
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => cloudyResponse
            });

            const result = await weatherService.getCurrentWeather(mockLocation);
            expect(result.conditions.main).toBe(WeatherCondition.CLOUDY);

            // Test overcast with a different location to avoid cache
            const overcastLocation: Location = {
                name: 'Boston, MA',
                coordinates: { latitude: 42.3601, longitude: -71.0589 },
                address: 'Boston, MA, USA'
            };

            const overcastResponse = {
                ...mockCurrentWeatherResponse,
                weather: [{
                    id: 804,
                    main: 'Clouds',
                    description: 'overcast clouds',
                    icon: '04d'
                }]
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => overcastResponse
            });

            const overcastResult = await weatherService.getCurrentWeather(overcastLocation);
            expect(overcastResult.conditions.main).toBe(WeatherCondition.OVERCAST);
        });

        it('should handle foggy conditions correctly', async () => {
            const foggyResponse = {
                ...mockCurrentWeatherResponse,
                weather: [{
                    id: 741,
                    main: 'Fog',
                    description: 'fog',
                    icon: '50d'
                }]
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => foggyResponse
            });

            const result = await weatherService.getCurrentWeather(mockLocation);
            expect(result.conditions.main).toBe(WeatherCondition.FOGGY);
        });

        it('should handle sleet conditions correctly', async () => {
            const sleetResponse = {
                ...mockCurrentWeatherResponse,
                weather: [{
                    id: 611,
                    main: 'Snow',
                    description: 'sleet',
                    icon: '13d'
                }],
                snow: {
                    '1h': 0.8
                }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => sleetResponse
            });

            const result = await weatherService.getCurrentWeather(mockLocation);
            expect(result.precipitation.type).toBe(PrecipitationType.SLEET);
        });

        it('should use cached results when available', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockCurrentWeatherResponse
            });

            // First call
            await weatherService.getCurrentWeather(mockLocation);
            
            // Second call should use cache
            const result = await weatherService.getCurrentWeather(mockLocation);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result.location).toEqual(mockLocation);
        });

        it('should handle API errors gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: async () => ({})
            });

            try {
                await weatherService.getCurrentWeather(mockLocation);
            } catch (error) {
                expect(error).toBeInstanceOf(WeatherError);
                expect((error as WeatherError).code).toBe('INVALID_API_KEY');
            }
        });

        it('should handle rate limiting errors', async () => {
            const rateLimitLocation: Location = {
                name: 'Chicago, IL',
                coordinates: { latitude: 41.8781, longitude: -87.6298 },
                address: 'Chicago, IL, USA'
            };

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                json: async () => ({})
            });

            try {
                await weatherService.getCurrentWeather(rateLimitLocation);
            } catch (error) {
                expect(error).toBeInstanceOf(WeatherError);
                expect((error as WeatherError).code).toBe('RATE_LIMIT_EXCEEDED');
            }
        });

        it('should handle network errors', async () => {
            const networkErrorLocation: Location = {
                name: 'Miami, FL',
                coordinates: { latitude: 25.7617, longitude: -80.1918 },
                address: 'Miami, FL, USA'
            };

            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            try {
                await weatherService.getCurrentWeather(networkErrorLocation);
            } catch (error) {
                expect(error).toBeInstanceOf(WeatherError);
                expect((error as WeatherError).code).toBe('WEATHER_SERVICE_ERROR');
            }
        });

        it('should return mock data when no API key is provided', async () => {
            const serviceWithoutKey = new WeatherService();
            
            const result = await serviceWithoutKey.getCurrentWeather(mockLocation);

            expect(result.location).toEqual(mockLocation);
            expect(result.temperature.current).toBeGreaterThan(0);
            expect(Object.values(WeatherCondition)).toContain(result.conditions.main);
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('getForecastWeather', () => {
        it('should return forecast weather data successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockForecastResponse
            });

            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
            const result = await weatherService.getForecastWeather(mockLocation, futureDate);

            expect(result).toMatchObject({
                location: mockLocation,
                temperature: {
                    current: 19,
                    feelsLike: 19,
                    min: 16,
                    max: 20
                },
                conditions: {
                    main: WeatherCondition.RAINY,
                    description: 'light rain'
                },
                precipitation: {
                    type: PrecipitationType.RAIN,
                    probability: 65,
                    intensity: expect.any(Number)
                }
            });
        });

        it('should handle forecast API errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: async () => ({})
            });

            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            
            await expect(weatherService.getForecastWeather(mockLocation, futureDate))
                .rejects.toThrow(WeatherError);
        });
    });

    describe('getRouteWeatherForecast', () => {
        it('should return weather forecasts for multiple locations', async () => {
            const locations: Location[] = [
                mockLocation,
                {
                    name: 'Boston, MA',
                    coordinates: { latitude: 42.3601, longitude: -71.0589 },
                    address: 'Boston, MA, USA'
                }
            ];

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCurrentWeatherResponse
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        ...mockCurrentWeatherResponse,
                        coord: { lon: -71.0589, lat: 42.3601 },
                        name: 'Boston'
                    })
                });

            const results = await weatherService.getRouteWeatherForecast(locations);

            expect(results).toHaveLength(2);
            expect(results[0].location).toEqual(locations[0]);
            expect(results[1].location).toEqual(locations[1]);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should handle empty locations array', async () => {
            await expect(weatherService.getRouteWeatherForecast([]))
                .rejects.toThrow(WeatherError);

            try {
                await weatherService.getRouteWeatherForecast([]);
            } catch (error) {
                expect(error).toBeInstanceOf(WeatherError);
                expect((error as WeatherError).code).toBe('INVALID_INPUT');
            }
        });

        it('should process locations in batches to respect rate limits', async () => {
            const locations: Location[] = Array.from({ length: 12 }, (_, i) => ({
                name: `Location ${i}`,
                coordinates: { latitude: 40 + i, longitude: -74 - i },
                address: `Location ${i}, USA`
            }));

            // Mock responses for all locations
            for (let i = 0; i < locations.length; i++) {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        ...mockCurrentWeatherResponse,
                        coord: { lon: -74 - i, lat: 40 + i },
                        name: `Location ${i}`
                    })
                });
            }

            const results = await weatherService.getRouteWeatherForecast(locations);

            expect(results).toHaveLength(12);
            expect(mockFetch).toHaveBeenCalledTimes(12);
        });
    });

    describe('getWeatherForLocationAndTime', () => {
        it('should return current weather for recent timestamps', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockCurrentWeatherResponse
            });

            const recentTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
            const result = await weatherService.getWeatherForLocationAndTime(mockLocation, recentTime);

            expect(result.location).toEqual(mockLocation);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/weather')
            );
        });

        it('should return forecast weather for future timestamps', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockForecastResponse
            });

            const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
            const result = await weatherService.getWeatherForLocationAndTime(mockLocation, futureTime);

            expect(result.location).toEqual(mockLocation);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/forecast')
            );
        });

        it('should handle historical timestamps by returning current weather', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockCurrentWeatherResponse
            });

            const pastTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
            const result = await weatherService.getWeatherForLocationAndTime(mockLocation, pastTime);

            expect(result.location).toEqual(mockLocation);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/weather')
            );
        });
    });

    describe('cache management', () => {
        it('should clear expired cache entries', () => {
            // This is a unit test for the cache clearing functionality
            weatherService.clearExpiredCache();
            
            const stats = weatherService.getCacheStats();
            expect(stats.size).toBe(0);
            expect(stats.maxSize).toBeGreaterThan(0);
        });

        it('should provide cache statistics', () => {
            const stats = weatherService.getCacheStats();
            
            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(typeof stats.size).toBe('number');
            expect(typeof stats.maxSize).toBe('number');
        });
    });

    describe('precipitation intensity calculation', () => {
        it('should calculate light precipitation intensity correctly', async () => {
            const lightRainResponse = {
                ...mockCurrentWeatherResponse,
                weather: [{
                    id: 500,
                    main: 'Rain',
                    description: 'light rain',
                    icon: '10d'
                }],
                rain: {
                    '1h': 0.3
                }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => lightRainResponse
            });

            const result = await weatherService.getCurrentWeather(mockLocation);
            expect(result.precipitation.intensity).toBe(1); // Light intensity
        });

        it('should calculate moderate precipitation intensity correctly', async () => {
            const moderateRainResponse = {
                ...mockCurrentWeatherResponse,
                weather: [{
                    id: 501,
                    main: 'Rain',
                    description: 'moderate rain',
                    icon: '10d'
                }],
                rain: {
                    '1h': 5.0
                }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => moderateRainResponse
            });

            const result = await weatherService.getCurrentWeather(mockLocation);
            expect(result.precipitation.intensity).toBe(5); // Moderate intensity
        });

        it('should calculate heavy precipitation intensity correctly', async () => {
            const heavyRainResponse = {
                ...mockCurrentWeatherResponse,
                weather: [{
                    id: 502,
                    main: 'Rain',
                    description: 'heavy intensity rain',
                    icon: '10d'
                }],
                rain: {
                    '1h': 20.0
                }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => heavyRainResponse
            });

            const result = await weatherService.getCurrentWeather(mockLocation);
            expect(result.precipitation.intensity).toBe(10); // Heavy intensity
        });
    });
});