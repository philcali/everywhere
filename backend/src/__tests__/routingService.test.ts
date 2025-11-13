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

    describe('calculateRoute', () => {
        it('should delegate to appropriate routing method based on travel mode', async () => {
            const drivingConfig = { ...mockTravelConfig, mode: TravelMode.DRIVING };
            const flyingConfig = { ...mockTravelConfig, mode: TravelMode.FLYING };
            const sailingConfig = { ...mockTravelConfig, mode: TravelMode.SAILING };

            // Mock API response for driving
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

            // Test driving (should use land route)
            const drivingResult = await routingService.calculateRoute(mockSource, mockDestination, drivingConfig);
            expect(drivingResult.route.travelMode).toBe(TravelMode.DRIVING);

            // Test flying (should use air route)
            const flyingResult = await routingService.calculateRoute(mockSource, mockDestination, flyingConfig);
            expect(flyingResult.route.travelMode).toBe(TravelMode.FLYING);

            // Test sailing (should use sea route)
            const sailingResult = await routingService.calculateRoute(mockSource, mockDestination, sailingConfig);
            expect(sailingResult.route.travelMode).toBe(TravelMode.SAILING);
        });

        it('should throw error for unsupported travel modes', async () => {
            const invalidConfig = { ...mockTravelConfig, mode: 'invalid' as TravelMode };

            await expect(
                routingService.calculateRoute(mockSource, mockDestination, invalidConfig)
            ).rejects.toThrow(RoutingError);
        });
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

    describe('calculateAirRoute', () => {
        it('should calculate direct flight path', async () => {
            const flyingConfig = { ...mockTravelConfig, mode: TravelMode.FLYING };

            const result = await routingService.calculateAirRoute(mockSource, mockDestination, flyingConfig);

            expect(result.route.source).toEqual(mockSource);
            expect(result.route.destination).toEqual(mockDestination);
            expect(result.route.travelMode).toBe(TravelMode.FLYING);
            expect(result.route.totalDistance).toBeGreaterThan(0);
            expect(result.route.estimatedDuration).toBeGreaterThan(0);
            expect(result.route.segments.length).toBeGreaterThan(0);
            expect(result.route.waypoints.length).toBeGreaterThan(0);
            expect(result.confidence).toBe(0.9); // High confidence for direct flights
        });

        it('should apply custom speed for flights', async () => {
            const customSpeedConfig = {
                ...mockTravelConfig,
                mode: TravelMode.FLYING,
                customSpeed: 900 // 900 km/h instead of default 800 km/h
            };

            const result = await routingService.calculateAirRoute(mockSource, mockDestination, customSpeedConfig);

            // Duration should be calculated with custom speed
            const expectedDuration = (result.route.totalDistance / 900) * 3600;
            expect(result.route.estimatedDuration).toBeCloseTo(expectedDuration, 0);
        });

        it('should add warnings for long-haul flights', async () => {
            const longDistanceSource: Location = {
                name: 'New York, NY',
                coordinates: { latitude: 40.7128, longitude: -74.0060 }
            };
            const longDistanceDestination: Location = {
                name: 'Tokyo, Japan',
                coordinates: { latitude: 35.6762, longitude: 139.6503 }
            };

            const flyingConfig = { ...mockTravelConfig, mode: TravelMode.FLYING };

            const result = await routingService.calculateAirRoute(longDistanceSource, longDistanceDestination, flyingConfig);

            expect(result.warnings).toContain('Long-haul flight - consider fuel stops and crew rest requirements');
        });

        it('should add warnings for climate zone crossings', async () => {
            const tropicalSource: Location = {
                name: 'Miami, FL',
                coordinates: { latitude: 25.7617, longitude: -80.1918 }
            };
            const arcticDestination: Location = {
                name: 'Reykjavik, Iceland',
                coordinates: { latitude: 64.1466, longitude: -21.9426 }
            };

            const flyingConfig = { ...mockTravelConfig, mode: TravelMode.FLYING };

            const result = await routingService.calculateAirRoute(tropicalSource, arcticDestination, flyingConfig);

            expect(result.warnings).toContain('Flight crosses multiple climate zones - expect significant weather variations');
        });

        it('should reject non-flying travel modes', async () => {
            const drivingConfig = { ...mockTravelConfig, mode: TravelMode.DRIVING };

            await expect(
                routingService.calculateAirRoute(mockSource, mockDestination, drivingConfig)
            ).rejects.toThrow(RoutingError);
        });
    });

    describe('calculateSeaRoute', () => {
        it('should calculate maritime route for sailing', async () => {
            const sailingConfig = { ...mockTravelConfig, mode: TravelMode.SAILING };

            const result = await routingService.calculateSeaRoute(mockSource, mockDestination, sailingConfig);

            expect(result.route.source).toEqual(mockSource);
            expect(result.route.destination).toEqual(mockDestination);
            expect(result.route.travelMode).toBe(TravelMode.SAILING);
            expect(result.route.totalDistance).toBeGreaterThan(0);
            expect(result.route.estimatedDuration).toBeGreaterThan(0);
            expect(result.route.segments.length).toBeGreaterThan(0);
            expect(result.route.waypoints.length).toBeGreaterThan(0);
            expect(result.confidence).toBe(0.8); // Good confidence for maritime routes
        });

        it('should calculate maritime route for cruise', async () => {
            const cruiseConfig = { ...mockTravelConfig, mode: TravelMode.CRUISE };

            const result = await routingService.calculateSeaRoute(mockSource, mockDestination, cruiseConfig);

            expect(result.route.travelMode).toBe(TravelMode.CRUISE);
            expect(result.route.totalDistance).toBeGreaterThan(0);
        });

        it('should account for maritime distance multipliers', async () => {
            const coastalSource: Location = {
                name: 'Portsmouth, UK',
                coordinates: { latitude: 50.8198, longitude: -1.0880 }
            };
            const coastalDestination: Location = {
                name: 'Le Havre, France',
                coordinates: { latitude: 49.4944, longitude: 0.1079 }
            };

            const sailingConfig = { ...mockTravelConfig, mode: TravelMode.SAILING };

            const result = await routingService.calculateSeaRoute(coastalSource, coastalDestination, sailingConfig);

            // Maritime distance should be longer than direct distance due to navigation constraints
            const directDistance = routingService['calculateHaversineDistance'](
                coastalSource.coordinates.latitude,
                coastalSource.coordinates.longitude,
                coastalDestination.coordinates.latitude,
                coastalDestination.coordinates.longitude
            );

            expect(result.route.totalDistance).toBeGreaterThan(directDistance);
        });

        it('should add warnings for long ocean voyages', async () => {
            const atlanticSource: Location = {
                name: 'New York Harbor',
                coordinates: { latitude: 40.6892, longitude: -74.0445 }
            };
            const atlanticDestination: Location = {
                name: 'Southampton, UK',
                coordinates: { latitude: 50.9097, longitude: -1.4044 }
            };

            const cruiseConfig = { ...mockTravelConfig, mode: TravelMode.CRUISE };

            const result = await routingService.calculateSeaRoute(atlanticSource, atlanticDestination, cruiseConfig);

            expect(result.warnings).toContain('Long ocean voyage - plan for weather routing and fuel/supply stops');
        });

        it('should add warnings for equator crossings', async () => {
            const northernSource: Location = {
                name: 'Miami, FL',
                coordinates: { latitude: 25.7617, longitude: -80.1918 }
            };
            const southernDestination: Location = {
                name: 'Rio de Janeiro, Brazil',
                coordinates: { latitude: -22.9068, longitude: -43.1729 }
            };

            const sailingConfig = { ...mockTravelConfig, mode: TravelMode.SAILING };

            const result = await routingService.calculateSeaRoute(northernSource, southernDestination, sailingConfig);

            expect(result.warnings).toContain('Route crosses equator - expect tropical weather systems and seasonal variations');
        });

        it('should add warnings for high-latitude routes', async () => {
            const arcticSource: Location = {
                name: 'Murmansk, Russia',
                coordinates: { latitude: 68.9585, longitude: 33.0827 }
            };
            const arcticDestination: Location = {
                name: 'Tromsø, Norway',
                coordinates: { latitude: 69.6492, longitude: 18.9553 }
            };

            const sailingConfig = { ...mockTravelConfig, mode: TravelMode.SAILING };

            const result = await routingService.calculateSeaRoute(arcticSource, arcticDestination, sailingConfig);

            expect(result.warnings).toContain('High-latitude route - expect challenging weather conditions and ice hazards');
        });

        it('should reject non-sea travel modes', async () => {
            const drivingConfig = { ...mockTravelConfig, mode: TravelMode.DRIVING };

            await expect(
                routingService.calculateSeaRoute(mockSource, mockDestination, drivingConfig)
            ).rejects.toThrow(RoutingError);
        });
    });

    describe('calculateTravelSpeed', () => {
        it('should return custom speed when provided', () => {
            const customSpeed = 100;
            const speed = routingService.calculateTravelSpeed(TravelMode.DRIVING, 500, customSpeed);
            expect(speed).toBe(customSpeed);
        });

        it('should return default speed for each travel mode', () => {
            expect(routingService.calculateTravelSpeed(TravelMode.DRIVING, 100)).toBe(60);
            expect(routingService.calculateTravelSpeed(TravelMode.WALKING, 10)).toBe(5);
            expect(routingService.calculateTravelSpeed(TravelMode.CYCLING, 50)).toBe(20);
            expect(routingService.calculateTravelSpeed(TravelMode.FLYING, 1000)).toBe(800);
            expect(routingService.calculateTravelSpeed(TravelMode.SAILING, 200)).toBe(15);
            expect(routingService.calculateTravelSpeed(TravelMode.CRUISE, 300)).toBe(25);
        });

        it('should adjust speed based on conditions', () => {
            // Test driving with heavy traffic
            const heavyTrafficSpeed = routingService.calculateTravelSpeed(
                TravelMode.DRIVING, 
                100, 
                undefined, 
                { traffic: 'heavy' }
            );
            expect(heavyTrafficSpeed).toBe(42); // 60 * 0.7

            // Test sailing with favorable wind
            const favorableWindSpeed = routingService.calculateTravelSpeed(
                TravelMode.SAILING, 
                200, 
                undefined, 
                { weather: 'favorable' }
            );
            expect(favorableWindSpeed).toBe(19.5); // 15 * 1.3

            // Test flying with headwind
            const headwindSpeed = routingService.calculateTravelSpeed(
                TravelMode.FLYING, 
                1000, 
                undefined, 
                { weather: 'headwind' }
            );
            expect(headwindSpeed).toBe(720); // 800 * 0.9
        });

        it('should ensure minimum speed of 1 km/h', () => {
            const speed = routingService.calculateTravelSpeed(
                TravelMode.SAILING, 
                100, 
                0.5, // Very low custom speed
                { weather: 'storm' } // Storm conditions reduce speed further
            );
            expect(speed).toBeGreaterThanOrEqual(1);
        });
    });

    describe('analyzeCrossModeRoute', () => {
        it('should recommend appropriate modes for short distances', () => {
            const nearbyDestination: Location = {
                name: 'Brooklyn Bridge, NY',
                coordinates: { latitude: 40.7061, longitude: -73.9969 }
            };

            const analysis = routingService.analyzeCrossModeRoute(mockSource, nearbyDestination, TravelMode.DRIVING);

            expect(analysis.recommendations).toContain('Short distance - walking or cycling recommended');
            expect(analysis.alternativeModes).toContain(TravelMode.WALKING);
            expect(analysis.alternativeModes).toContain(TravelMode.CYCLING);
        });

        it('should recommend flying for very long distances', () => {
            const farDestination: Location = {
                name: 'Tokyo, Japan',
                coordinates: { latitude: 35.6762, longitude: 139.6503 }
            };

            const analysis = routingService.analyzeCrossModeRoute(mockSource, farDestination, TravelMode.DRIVING);

            expect(analysis.recommendations).toContain('Very long distance - flying recommended for speed');
            expect(analysis.alternativeModes).toContain(TravelMode.FLYING);
        });

        it('should identify ocean crossings for land modes', () => {
            const europeanDestination: Location = {
                name: 'London, UK',
                coordinates: { latitude: 51.5074, longitude: -0.1278 }
            };

            const analysis = routingService.analyzeCrossModeRoute(mockSource, europeanDestination, TravelMode.DRIVING);

            expect(analysis.considerations).toContain('Ocean crossing required - ferry or shipping needed for vehicle');
        });

        it('should warn about multi-day journeys for walking/cycling', () => {
            const distantDestination: Location = {
                name: 'Los Angeles, CA',
                coordinates: { latitude: 34.0522, longitude: -118.2437 }
            };

            const analysis = routingService.analyzeCrossModeRoute(mockSource, distantDestination, TravelMode.WALKING);

            expect(analysis.considerations).toContain('Very long journey - plan for multiple days and accommodation');
        });

        it('should identify climate zone crossings', () => {
            const tropicalDestination: Location = {
                name: 'Key West, FL',
                coordinates: { latitude: 24.5551, longitude: -81.7800 }
            };

            const analysis = routingService.analyzeCrossModeRoute(mockSource, tropicalDestination, TravelMode.FLYING);

            expect(analysis.considerations).toContain('Route crosses climate zones - pack for varying weather conditions');
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