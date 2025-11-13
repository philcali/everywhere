import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import routingRoutes from '../routes/routing.js';
import { TravelMode } from '@shared/types/travel.js';

// Mock the services with proper error classes
vi.mock('../services/routingService.js', async () => {
    const actual = await vi.importActual('../services/routingService.js');
    return {
        ...actual,
        routingService: {
            calculateLandRoute: vi.fn(),
            getCacheStats: vi.fn(() => ({ size: 5, maxSize: 500 })),
            clearExpiredCache: vi.fn()
        }
    };
});

vi.mock('../services/geocodingService.js', async () => {
    const actual = await vi.importActual('../services/geocodingService.js');
    return {
        ...actual,
        geocodingService: {
            geocodeLocation: vi.fn(),
            getCacheStats: vi.fn(() => ({ size: 10, maxSize: 1000 })),
            clearExpiredCache: vi.fn()
        }
    };
});

import { routingService, RoutingError } from '../services/routingService.js';
import { geocodingService, GeocodingError } from '../services/geocodingService.js';

describe('Routing Routes', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/route', routingRoutes);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/route/calculate', () => {
        const validRequest = {
            source: 'New York, NY',
            destination: 'Boston, MA',
            travelMode: TravelMode.DRIVING
        };

        const mockGeocodingResult = {
            location: {
                name: 'New York, NY',
                coordinates: { latitude: 40.7128, longitude: -74.0060 },
                address: 'New York, NY, USA'
            },
            confidence: 0.9
        };

        const mockRoutingResult = {
            route: {
                id: 'test-route-id',
                source: mockGeocodingResult.location,
                destination: {
                    name: 'Boston, MA',
                    coordinates: { latitude: 42.3601, longitude: -71.0589 },
                    address: 'Boston, MA, USA'
                },
                travelMode: TravelMode.DRIVING,
                waypoints: [
                    {
                        coordinates: { latitude: 40.7128, longitude: -74.0060 },
                        distanceFromStart: 0,
                        estimatedTimeFromStart: 0
                    },
                    {
                        coordinates: { latitude: 42.3601, longitude: -71.0589 },
                        distanceFromStart: 300,
                        estimatedTimeFromStart: 18000
                    }
                ],
                totalDistance: 300,
                estimatedDuration: 18000,
                segments: []
            },
            confidence: 0.8,
            warnings: []
        };

        it('should calculate route successfully', async () => {
            vi.mocked(geocodingService.geocodeLocation)
                .mockResolvedValueOnce(mockGeocodingResult)
                .mockResolvedValueOnce({
                    location: {
                        name: 'Boston, MA',
                        coordinates: { latitude: 42.3601, longitude: -71.0589 },
                        address: 'Boston, MA, USA'
                    },
                    confidence: 0.9
                });

            vi.mocked(routingService.calculateLandRoute)
                .mockResolvedValueOnce(mockRoutingResult);

            const response = await request(app)
                .post('/api/route/calculate')
                .send(validRequest)
                .expect(200);

            expect(response.body.route).toBeDefined();
            expect(response.body.route.id).toBe('test-route-id');
            expect(response.body.route.travelMode).toBe(TravelMode.DRIVING);
            expect(response.body.confidence).toBe(0.8);
        });

        it('should reject missing required fields', async () => {
            const response = await request(app)
                .post('/api/route/calculate')
                .send({ source: 'New York, NY' }) // Missing destination
                .expect(400);

            expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELD');
        });

        it('should reject invalid travel modes', async () => {
            const response = await request(app)
                .post('/api/route/calculate')
                .send({
                    ...validRequest,
                    travelMode: TravelMode.FLYING // Not supported for land routes
                })
                .expect(400);

            expect(response.body.error.code).toBe('INVALID_TRAVEL_CONFIG');
        });

        it('should reject invalid location strings', async () => {
            const response = await request(app)
                .post('/api/route/calculate')
                .send({
                    source: '<script>alert("xss")</script>', // Contains malicious content
                    destination: 'Boston, MA',
                    travelMode: TravelMode.DRIVING
                })
                .expect(400);

            expect(response.body.error.code).toBe('INVALID_LOCATION');
        });

        it('should reject invalid custom duration', async () => {
            const response = await request(app)
                .post('/api/route/calculate')
                .send({
                    ...validRequest,
                    customDuration: -100 // Negative duration
                })
                .expect(400);

            expect(response.body.error.code).toBe('OUT_OF_RANGE');
        });

        it('should reject invalid custom speed', async () => {
            const response = await request(app)
                .post('/api/route/calculate')
                .send({
                    ...validRequest,
                    customSpeed: 1500 // Too fast
                })
                .expect(400);

            expect(response.body.error.code).toBe('OUT_OF_RANGE');
        });

        it('should handle low confidence geocoding results', async () => {
            vi.mocked(geocodingService.geocodeLocation)
                .mockResolvedValueOnce({
                    location: mockGeocodingResult.location,
                    confidence: 0.3 // Low confidence
                })
                .mockResolvedValueOnce({
                    location: {
                        name: 'Boston, MA',
                        coordinates: { latitude: 42.3601, longitude: -71.0589 },
                        address: 'Boston, MA, USA'
                    },
                    confidence: 0.9
                });

            const response = await request(app)
                .post('/api/route/calculate')
                .send(validRequest)
                .expect(400);

            expect(response.body.error.code).toBe('INVALID_LOCATION');
        });

        it('should handle geocoding errors', async () => {
            const geocodingError = new GeocodingError('LOCATION_NOT_FOUND', 'Location not found', ['Try a more specific location']);

            vi.mocked(geocodingService.geocodeLocation)
                .mockRejectedValueOnce(geocodingError);

            const response = await request(app)
                .post('/api/route/calculate')
                .send(validRequest)
                .expect(400);

            expect(response.body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
        });

        it('should handle routing errors', async () => {
            vi.mocked(geocodingService.geocodeLocation)
                .mockResolvedValueOnce(mockGeocodingResult)
                .mockResolvedValueOnce({
                    location: {
                        name: 'Boston, MA',
                        coordinates: { latitude: 42.3601, longitude: -71.0589 },
                        address: 'Boston, MA, USA'
                    },
                    confidence: 0.9
                });

            const routingError = new RoutingError('NO_ROUTE_FOUND', 'No route found', ['Try a different travel mode']);

            vi.mocked(routingService.calculateLandRoute)
                .mockRejectedValueOnce(routingError);

            const response = await request(app)
                .post('/api/route/calculate')
                .send(validRequest)
                .expect(400);

            expect(response.body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
        });

        it('should handle custom speed configuration', async () => {
            vi.mocked(geocodingService.geocodeLocation)
                .mockResolvedValueOnce(mockGeocodingResult)
                .mockResolvedValueOnce({
                    location: {
                        name: 'Boston, MA',
                        coordinates: { latitude: 42.3601, longitude: -71.0589 },
                        address: 'Boston, MA, USA'
                    },
                    confidence: 0.9
                });

            vi.mocked(routingService.calculateLandRoute)
                .mockResolvedValueOnce(mockRoutingResult);

            const response = await request(app)
                .post('/api/route/calculate')
                .send({
                    ...validRequest,
                    customSpeed: 80,
                    routeOptimization: false
                })
                .expect(200);

            expect(vi.mocked(routingService.calculateLandRoute)).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(Object),
                expect.objectContaining({
                    customSpeed: 80,
                    preferences: expect.objectContaining({
                        routeOptimization: false
                    })
                })
            );
        });
    });

    describe('GET /api/route/health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/api/route/health')
                .expect(200);

            expect(response.body.status).toBe('healthy');
            expect(response.body.services.routing.status).toBe('operational');
            expect(response.body.services.geocoding.status).toBe('operational');
            expect(response.body.services.routing.cache).toEqual({ size: 5, maxSize: 500 });
            expect(response.body.services.geocoding.cache).toEqual({ size: 10, maxSize: 1000 });
        });

        it('should handle health check errors', async () => {
            vi.mocked(routingService.getCacheStats).mockImplementationOnce(() => {
                throw new Error('Cache error');
            });

            const response = await request(app)
                .get('/api/route/health')
                .expect(500);

            expect(response.body.status).toBe('unhealthy');
        });
    });

    describe('POST /api/route/clear-cache', () => {
        it('should clear cache successfully', async () => {
            const response = await request(app)
                .post('/api/route/clear-cache')
                .expect(200);

            expect(response.body.message).toBe('Cache cleared successfully');
            expect(vi.mocked(routingService.clearExpiredCache)).toHaveBeenCalled();
            expect(vi.mocked(geocodingService.clearExpiredCache)).toHaveBeenCalled();
        });

        it('should handle cache clear errors', async () => {
            vi.mocked(routingService.clearExpiredCache).mockImplementationOnce(() => {
                throw new Error('Cache clear error');
            });

            const response = await request(app)
                .post('/api/route/clear-cache')
                .expect(500);

            expect(response.body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
        });
    });
});