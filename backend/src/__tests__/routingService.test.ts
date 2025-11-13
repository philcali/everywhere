import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RoutingService, RoutingError } from '../services/routingService.js';
import { TravelMode } from '@shared/types/travel.js';
import { Location } from '@shared/types/location.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('RoutingService', () => {
    let routingService: RoutingService;
    let mockFetch: any;

    const mockSource: Location = {
        name: 'New York, NY',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        address: 'New York, NY, USA'
    };

    const mockDestination: Location = {
        name: 'Boston, MA',
        coordinates: { latitude: 42.3601, longitude: -71.0589 },
        address: 'Boston, MA, USA'
    };

    const mockTravelConfig = {
        mode: TravelMode.DRIVING,
        preferences: {
            weatherUpdateInterval: 3600,
            routeOptimization: true
        }
    };

    beforeEach(() => {
        routingService = new RoutingService('test-api-key');
        mockFetch = vi.mocked(fetch);
        mockFetch.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('calculateLandRoute', () => {
        it('should calculate route for driving mode', async () => {
            const mockApiResponse = {
                routes: [{
                    legs: [{
                        distance: { value: 300000, text: '300 km' },
                        duration: { value: 14400, text: '4 hours' },
                        steps: [
                            {
                                distance: { value: 150000 },
                                duration: { value: 7200 },
                                start_location: { lat: 40.7128, lng: -74.0060 },
                                end_location: { lat: 41.5, lng: -72.5 },
                                polyline: { points: 'encoded_polyline_1' }
                            },
                            {
                                distance: { value: 150000 },
                                duration: { value: 7200 },
                                start_location: { lat: 41.5, lng: -72.5 },
                                end_location: { lat: 42.3601, lng: -71.0589 },
                                polyline: { points: 'encoded_polyline_2' }
                            }
                        ]
                    }],
                    overview_polyline: { points: 'encoded_overview_polyline' },
                    summary: 'I-95 N',
                    warnings: []
                }],
                status: 'OK'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            const result = await routingService.calculateLandRoute(mockSource, mockDestination, mockTravelConfig);

            expect(result.route.source).toEqual(mockSource);
            expect(result.route.destination).toEqual(mockDestination);
            expect(result.route.travelMode).toBe(TravelMode.DRIVING);
            expect(result.route.totalDistance).toBe(300);
            expect(result.route.estimatedDuration).toBe(14400);
            expect(result.route.segments).toHaveLength(2);
            expect(result.route.waypoints.length).toBeGreaterThan(0);
            expect(result.confidence).toBeGreaterThan(0);
        });

        it('should calculate route for walking mode', async () => {
            const walkingConfig = { ...mockTravelConfig, mode: TravelMode.WALKING };
            
            const mockApiResponse = {
                routes: [{
                    legs: [{
                        distance: { value: 50000, text: '50 km' },
                        duration: { value: 36000, text: '10 hours' },
                        steps: [{
                            distance: { value: 50000 },
                            duration: { value: 36000 },
                            start_location: { lat: 40.7128, lng: -74.0060 },
                            end_location: { lat: 42.3601, lng: -71.0589 },
                            polyline: { points: 'walking_polyline' }
                        }]
                    }],
                    overview_polyline: { points: 'walking_overview' },
                    summary: 'Walking route',
                    warnings: ['Long walking distance']
                }],
                status: 'OK'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            const result = await routingService.calculateLandRoute(mockSource, mockDestination, walkingConfig);

            expect(result.route.travelMode).toBe(TravelMode.WALKING);
            expect(result.route.totalDistance).toBe(50);
            expect(result.warnings).toContain('Long walking distance');
        });

        it('should calculate route for cycling mode', async () => {
            const cyclingConfig = { ...mockTravelConfig, mode: TravelMode.CYCLING };
            
            const mockApiResponse = {
                routes: [{
                    legs: [{
                        distance: { value: 280000, text: '280 km' },
                        duration: { value: 50400, text: '14 hours' },
                        steps: [{
                            distance: { value: 280000 },
                            duration: { value: 50400 },
                            start_location: { lat: 40.7128, lng: -74.0060 },
                            end_location: { lat: 42.3601, lng: -71.0589 },
                            polyline: { points: 'cycling_polyline' }
                        }]
                    }],
                    overview_polyline: { points: 'cycling_overview' },
                    summary: 'Bike-friendly route',
                    warnings: []
                }],
                status: 'OK'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            const result = await routingService.calculateLandRoute(mockSource, mockDestination, cyclingConfig);

            expect(result.route.travelMode).toBe(TravelMode.CYCLING);
            expect(result.route.totalDistance).toBe(280);
        });

        it('should reject non-land travel modes', async () => {
            const flyingConfig = { ...mockTravelConfig, mode: TravelMode.FLYING };

            await expect(
                routingService.calculateLandRoute(mockSource, mockDestination, flyingConfig)
            ).rejects.toThrow(RoutingError);
        });

        it('should handle invalid coordinates', async () => {
            const invalidSource = {
                ...mockSource,
                coordinates: { latitude: 91, longitude: -74.0060 } // Invalid latitude
            };

            await expect(
                routingService.calculateLandRoute(invalidSource, mockDestination, mockTravelConfig)
            ).rejects.toThrow(RoutingError);
        });

        it('should handle API errors gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            await expect(
                routingService.calculateLandRoute(mockSource, mockDestination, mockTravelConfig)
            ).rejects.toThrow(RoutingError);
        });

        it('should handle no route found', async () => {
            const mockApiResponse = {
                routes: [],
                status: 'ZERO_RESULTS'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            await expect(
                routingService.calculateLandRoute(mockSource, mockDestination, mockTravelConfig)
            ).rejects.toThrow(RoutingError);
        });

        it('should apply custom speed configuration', async () => {
            const customSpeedConfig = {
                ...mockTravelConfig,
                customSpeed: 80 // 80 km/h instead of default 60 km/h
            };

            const mockApiResponse = {
                routes: [{
                    legs: [{
                        distance: { value: 300000, text: '300 km' },
                        duration: { value: 18000, text: '5 hours' }, // Original duration at 60 km/h
                        steps: [{
                            distance: { value: 300000 },
                            duration: { value: 18000 },
                            start_location: { lat: 40.7128, lng: -74.0060 },
                            end_location: { lat: 42.3601, lng: -71.0589 },
                            polyline: { points: 'test_polyline' }
                        }]
                    }],
                    overview_polyline: { points: 'test_overview' },
                    summary: 'Test route',
                    warnings: []
                }],
                status: 'OK'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            const result = await routingService.calculateLandRoute(mockSource, mockDestination, customSpeedConfig);

            // Duration should be recalculated: 300 km / 80 km/h = 3.75 hours = 13500 seconds
            expect(result.route.estimatedDuration).toBe(13500);
        });

        it('should use mock data when no API key is provided', async () => {
            const serviceWithoutKey = new RoutingService();

            const result = await serviceWithoutKey.calculateLandRoute(mockSource, mockDestination, mockTravelConfig);

            expect(result.route.source).toEqual(mockSource);
            expect(result.route.destination).toEqual(mockDestination);
            expect(result.route.travelMode).toBe(TravelMode.DRIVING);
            expect(result.route.totalDistance).toBeGreaterThan(0);
            expect(result.route.estimatedDuration).toBeGreaterThan(0);
            expect(result.confidence).toBe(0.7); // Mock data confidence
        });
    });

    describe('generateWaypoints', () => {
        it('should generate waypoints at appropriate intervals', () => {
            const mockRoute = {
                id: 'test-route',
                source: mockSource,
                destination: mockDestination,
                travelMode: TravelMode.DRIVING,
                waypoints: [],
                totalDistance: 300,
                estimatedDuration: 18000,
                segments: [
                    {
                        startPoint: {
                            coordinates: mockSource.coordinates,
                            distanceFromStart: 0,
                            estimatedTimeFromStart: 0
                        },
                        endPoint: {
                            coordinates: mockDestination.coordinates,
                            distanceFromStart: 300,
                            estimatedTimeFromStart: 18000
                        },
                        distance: 300,
                        estimatedDuration: 18000,
                        travelMode: TravelMode.DRIVING
                    }
                ]
            };

            const waypoints = routingService.generateWaypoints(mockRoute);

            expect(waypoints.length).toBeGreaterThan(2); // At least start and end
            expect(waypoints[0].distanceFromStart).toBe(0);
            expect(waypoints[waypoints.length - 1].distanceFromStart).toBe(300);
            
            // Check that waypoints are properly spaced
            for (let i = 1; i < waypoints.length; i++) {
                expect(waypoints[i].distanceFromStart).toBeGreaterThan(waypoints[i - 1].distanceFromStart);
                expect(waypoints[i].estimatedTimeFromStart).toBeGreaterThan(waypoints[i - 1].estimatedTimeFromStart);
            }
        });

        it('should generate different waypoint intervals for different travel modes', () => {
            const drivingRoute = {
                id: 'driving-route',
                source: mockSource,
                destination: mockDestination,
                travelMode: TravelMode.DRIVING,
                waypoints: [],
                totalDistance: 300,
                estimatedDuration: 18000,
                segments: [{
                    startPoint: {
                        coordinates: mockSource.coordinates,
                        distanceFromStart: 0,
                        estimatedTimeFromStart: 0
                    },
                    endPoint: {
                        coordinates: mockDestination.coordinates,
                        distanceFromStart: 300,
                        estimatedTimeFromStart: 18000
                    },
                    distance: 300,
                    estimatedDuration: 18000,
                    travelMode: TravelMode.DRIVING
                }]
            };

            const walkingRoute = { ...drivingRoute, travelMode: TravelMode.WALKING };

            const drivingWaypoints = routingService.generateWaypoints(drivingRoute);
            const walkingWaypoints = routingService.generateWaypoints(walkingRoute);

            // Walking should have more waypoints due to smaller interval
            expect(walkingWaypoints.length).toBeGreaterThan(drivingWaypoints.length);
        });

        it('should handle custom waypoint intervals', () => {
            const mockRoute = {
                id: 'test-route',
                source: mockSource,
                destination: mockDestination,
                travelMode: TravelMode.DRIVING,
                waypoints: [],
                totalDistance: 100,
                estimatedDuration: 6000,
                segments: [{
                    startPoint: {
                        coordinates: mockSource.coordinates,
                        distanceFromStart: 0,
                        estimatedTimeFromStart: 0
                    },
                    endPoint: {
                        coordinates: mockDestination.coordinates,
                        distanceFromStart: 100,
                        estimatedTimeFromStart: 6000
                    },
                    distance: 100,
                    estimatedDuration: 6000,
                    travelMode: TravelMode.DRIVING
                }]
            };

            const customInterval = 10; // 10 km intervals
            const waypoints = routingService.generateWaypoints(mockRoute, customInterval);

            // Should have waypoints approximately every 10 km
            expect(waypoints.length).toBeGreaterThanOrEqual(11); // 0, 10, 20, ..., 100
        });
    });

    describe('caching', () => {
        it('should cache routing results', async () => {
            const mockApiResponse = {
                routes: [{
                    legs: [{
                        distance: { value: 300000, text: '300 km' },
                        duration: { value: 14400, text: '4 hours' },
                        steps: [{
                            distance: { value: 300000 },
                            duration: { value: 14400 },
                            start_location: { lat: 40.7128, lng: -74.0060 },
                            end_location: { lat: 42.3601, lng: -71.0589 },
                            polyline: { points: 'test_polyline' }
                        }]
                    }],
                    overview_polyline: { points: 'test_overview' },
                    summary: 'Test route',
                    warnings: []
                }],
                status: 'OK'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            // First call should make API request
            const result1 = await routingService.calculateLandRoute(mockSource, mockDestination, mockTravelConfig);
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Second call should use cache
            const result2 = await routingService.calculateLandRoute(mockSource, mockDestination, mockTravelConfig);
            expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call

            expect(result1.route.id).toBe(result2.route.id);
        });

        it('should provide cache statistics', () => {
            const stats = routingService.getCacheStats();
            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(typeof stats.size).toBe('number');
            expect(typeof stats.maxSize).toBe('number');
        });
    });
});