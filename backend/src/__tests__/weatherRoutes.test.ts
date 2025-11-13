import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import weatherRoutes from '../routes/weather.js';

// Mock the weather service
vi.mock('../services/weatherService.js', () => ({
    weatherService: {
        getCurrentWeather: vi.fn(),
        getWeatherForLocationAndTime: vi.fn(),
        getRouteWeatherForecast: vi.fn(),
        getCacheStats: vi.fn()
    },
    WeatherError: class WeatherError extends Error {
        constructor(public code: string, message: string, public suggestions?: string[]) {
            super(message);
            this.name = 'WeatherError';
        }
    }
}));

// Mock the error formatting utility
vi.mock('@shared/utils/errorFormatting.js', () => ({
    formatErrorResponse: (code: string, message: string, suggestions?: string[]) => ({
        error: { code, message, suggestions, timestamp: expect.any(String) }
    })
}));

import { weatherService, WeatherError } from '../services/weatherService.js';
import { WeatherCondition, PrecipitationType } from '@shared/types/weather.js';

const app = express();
app.use(express.json());
app.use('/api/weather', weatherRoutes);

describe('Weather Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/weather/current', () => {
        const mockWeatherData = {
            location: {
                name: 'New York, NY',
                coordinates: { latitude: 40.7128, longitude: -74.0060 },
                address: 'New York, NY, USA'
            },
            timestamp: '2023-12-25T12:00:00.000Z',
            temperature: {
                current: 22,
                feelsLike: 24,
                min: 18,
                max: 26
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
                speed: 5.2,
                direction: 180
            },
            humidity: 65,
            visibility: 10
        };

        it('should return current weather for valid coordinates', async () => {
            vi.mocked(weatherService.getCurrentWeather).mockResolvedValueOnce(mockWeatherData);

            const response = await request(app)
                .get('/api/weather/current')
                .query({
                    lat: '40.7128',
                    lon: '-74.0060',
                    name: 'New York, NY'
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                data: mockWeatherData,
                timestamp: expect.any(String)
            });

            expect(weatherService.getCurrentWeather).toHaveBeenCalledWith({
                name: 'New York, NY',
                coordinates: { latitude: 40.7128, longitude: -74.0060 },
                address: undefined
            });
        });

        it('should return 400 for missing coordinates', async () => {
            const response = await request(app)
                .get('/api/weather/current')
                .query({ name: 'New York' });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('MISSING_COORDINATES');
        });

        it('should return 400 for invalid coordinates', async () => {
            const response = await request(app)
                .get('/api/weather/current')
                .query({
                    lat: 'invalid',
                    lon: '-74.0060'
                });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_COORDINATES');
        });

        it('should return 400 for coordinates out of range', async () => {
            const response = await request(app)
                .get('/api/weather/current')
                .query({
                    lat: '91',
                    lon: '-74.0060'
                });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('COORDINATES_OUT_OF_RANGE');
        });

        it('should handle weather service errors', async () => {
            const weatherError = new WeatherError('INVALID_API_KEY', 'Invalid API key', ['Check your configuration']);
            vi.mocked(weatherService.getCurrentWeather).mockRejectedValueOnce(weatherError);

            const response = await request(app)
                .get('/api/weather/current')
                .query({
                    lat: '40.7128',
                    lon: '-74.0060'
                });

            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('INVALID_API_KEY');
        });

        it('should handle unexpected errors', async () => {
            vi.mocked(weatherService.getCurrentWeather).mockRejectedValueOnce(new Error('Unexpected error'));

            const response = await request(app)
                .get('/api/weather/current')
                .query({
                    lat: '40.7128',
                    lon: '-74.0060'
                });

            expect(response.status).toBe(500);
            expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
        });
    });

    describe('GET /api/weather/forecast', () => {
        const mockForecastData = {
            location: {
                name: 'Boston, MA',
                coordinates: { latitude: 42.3601, longitude: -71.0589 }
            },
            timestamp: '2023-12-26T12:00:00.000Z',
            temperature: {
                current: 18,
                feelsLike: 16,
                min: 14,
                max: 22
            },
            conditions: {
                main: WeatherCondition.RAINY,
                description: 'light rain',
                icon: '10d'
            },
            precipitation: {
                type: PrecipitationType.RAIN,
                probability: 75,
                intensity: 3
            },
            wind: {
                speed: 8.1,
                direction: 220
            },
            humidity: 80,
            visibility: 8
        };

        it('should return weather forecast for valid coordinates and timestamp', async () => {
            vi.mocked(weatherService.getWeatherForLocationAndTime).mockResolvedValueOnce(mockForecastData);

            const response = await request(app)
                .get('/api/weather/forecast')
                .query({
                    lat: '42.3601',
                    lon: '-71.0589',
                    timestamp: '2023-12-26T12:00:00.000Z'
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                data: mockForecastData,
                timestamp: expect.any(String)
            });
        });

        it('should return 400 for invalid timestamp', async () => {
            const response = await request(app)
                .get('/api/weather/forecast')
                .query({
                    lat: '42.3601',
                    lon: '-71.0589',
                    timestamp: 'invalid-timestamp'
                });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_TIMESTAMP');
        });
    });

    describe('POST /api/weather/route', () => {
        const mockRouteWeatherData = [
            {
                location: {
                    name: 'Location 1',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 }
                },
                timestamp: '2023-12-25T12:00:00.000Z',
                temperature: { current: 22, feelsLike: 24, min: 18, max: 26 },
                conditions: { main: WeatherCondition.SUNNY, description: 'clear sky', icon: '01d' },
                precipitation: { type: PrecipitationType.NONE, probability: 0, intensity: 0 },
                wind: { speed: 5.2, direction: 180 },
                humidity: 65,
                visibility: 10
            }
        ];

        it('should return route weather data for valid locations', async () => {
            vi.mocked(weatherService.getRouteWeatherForecast).mockResolvedValueOnce(mockRouteWeatherData);

            const response = await request(app)
                .post('/api/weather/route')
                .send({
                    locations: [
                        {
                            name: 'Location 1',
                            coordinates: { latitude: 40.7128, longitude: -74.0060 }
                        }
                    ]
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                data: mockRouteWeatherData,
                timestamp: expect.any(String),
                meta: {
                    locationCount: 1,
                    hasTimestamps: false
                }
            });
        });

        it('should return 400 for missing locations', async () => {
            const response = await request(app)
                .post('/api/weather/route')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('MISSING_LOCATIONS');
        });

        it('should return 400 for invalid location format', async () => {
            const response = await request(app)
                .post('/api/weather/route')
                .send({
                    locations: [
                        { name: 'Invalid Location' } // Missing coordinates
                    ]
                });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_LOCATION_FORMAT');
        });

        it('should handle timestamps correctly', async () => {
            vi.mocked(weatherService.getRouteWeatherForecast).mockResolvedValueOnce(mockRouteWeatherData);

            const response = await request(app)
                .post('/api/weather/route')
                .send({
                    locations: [
                        {
                            name: 'Location 1',
                            coordinates: { latitude: 40.7128, longitude: -74.0060 }
                        }
                    ],
                    timestamps: ['2023-12-25T12:00:00.000Z']
                });

            expect(response.status).toBe(200);
            expect(response.body.meta.hasTimestamps).toBe(true);
        });

        it('should return 400 for timestamp-location mismatch', async () => {
            const response = await request(app)
                .post('/api/weather/route')
                .send({
                    locations: [
                        {
                            name: 'Location 1',
                            coordinates: { latitude: 40.7128, longitude: -74.0060 }
                        }
                    ],
                    timestamps: ['2023-12-25T12:00:00.000Z', '2023-12-26T12:00:00.000Z'] // Too many timestamps
                });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('TIMESTAMP_LOCATION_MISMATCH');
        });
    });

    describe('GET /api/weather/health', () => {
        it('should return health status', async () => {
            const mockCacheStats = { size: 10, maxSize: 500 };
            vi.mocked(weatherService.getCacheStats).mockReturnValueOnce(mockCacheStats);

            const response = await request(app)
                .get('/api/weather/health');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                service: 'weather',
                status: 'healthy',
                cache: mockCacheStats,
                timestamp: expect.any(String)
            });
        });

        it('should handle health check errors', async () => {
            vi.mocked(weatherService.getCacheStats).mockImplementationOnce(() => {
                throw new Error('Cache error');
            });

            const response = await request(app)
                .get('/api/weather/health');

            expect(response.status).toBe(500);
            expect(response.body).toMatchObject({
                success: false,
                service: 'weather',
                status: 'unhealthy'
            });
        });
    });
});