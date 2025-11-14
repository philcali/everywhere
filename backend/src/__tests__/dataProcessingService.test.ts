import { describe, it, expect, beforeEach } from 'vitest';
import { DataProcessingService, DataProcessingError } from '../services/dataProcessingService.js';
import { Route } from '@shared/types/route.js';
import { WeatherForecast, WeatherCondition, PrecipitationType } from '@shared/types/weather.js';
import { TravelMode } from '@shared/types/travel.js';
import { Location, Waypoint } from '@shared/types/location.js';

describe('DataProcessingService', () => {
  let service: DataProcessingService;
  let mockRoute: Route;
  let mockWeatherData: WeatherForecast[];
  let startTime: Date;

  beforeEach(() => {
    service = new DataProcessingService();
    startTime = new Date('2024-01-15T10:00:00Z');

    // Create mock route
    mockRoute = {
      id: 'test-route-1',
      source: {
        name: 'New York',
        coordinates: { latitude: 40.7128, longitude: -74.0060 }
      },
      destination: {
        name: 'Boston',
        coordinates: { latitude: 42.3601, longitude: -71.0589 }
      },
      travelMode: TravelMode.DRIVING,
      totalDistance: 300,
      estimatedDuration: 14400, // 4 hours
      waypoints: [
        {
          coordinates: { latitude: 40.7128, longitude: -74.0060 },
          distanceFromStart: 0,
          estimatedTimeFromStart: 0
        },
        {
          coordinates: { latitude: 41.5, longitude: -72.5 },
          distanceFromStart: 150,
          estimatedTimeFromStart: 7200 // 2 hours
        },
        {
          coordinates: { latitude: 42.3601, longitude: -71.0589 },
          distanceFromStart: 300,
          estimatedTimeFromStart: 14400 // 4 hours
        }
      ],
      segments: [
        {
          startPoint: {
            coordinates: { latitude: 40.7128, longitude: -74.0060 },
            distanceFromStart: 0,
            estimatedTimeFromStart: 0
          },
          endPoint: {
            coordinates: { latitude: 41.5, longitude: -72.5 },
            distanceFromStart: 150,
            estimatedTimeFromStart: 7200
          },
          distance: 150,
          estimatedDuration: 7200,
          travelMode: TravelMode.DRIVING
        },
        {
          startPoint: {
            coordinates: { latitude: 41.5, longitude: -72.5 },
            distanceFromStart: 150,
            estimatedTimeFromStart: 7200
          },
          endPoint: {
            coordinates: { latitude: 42.3601, longitude: -71.0589 },
            distanceFromStart: 300,
            estimatedTimeFromStart: 14400
          },
          distance: 150,
          estimatedDuration: 7200,
          travelMode: TravelMode.DRIVING
        }
      ]
    };

    // Create mock weather data
    mockWeatherData = [
      {
        location: {
          name: 'New York',
          coordinates: { latitude: 40.7128, longitude: -74.0060 }
        },
        timestamp: new Date('2024-01-15T10:00:00Z'),
        temperature: {
          current: 15,
          feelsLike: 12,
          min: 10,
          max: 18
        },
        conditions: {
          main: WeatherCondition.SUNNY,
          description: 'Clear sky',
          icon: '01d'
        },
        precipitation: {
          type: PrecipitationType.NONE,
          probability: 0,
          intensity: 0
        },
        wind: {
          speed: 10,
          direction: 180
        },
        humidity: 60,
        visibility: 15
      },
      {
        location: {
          name: 'Midpoint',
          coordinates: { latitude: 41.5, longitude: -72.5 }
        },
        timestamp: new Date('2024-01-15T12:00:00Z'),
        temperature: {
          current: 12,
          feelsLike: 10,
          min: 8,
          max: 15
        },
        conditions: {
          main: WeatherCondition.CLOUDY,
          description: 'Partly cloudy',
          icon: '02d'
        },
        precipitation: {
          type: PrecipitationType.NONE,
          probability: 20,
          intensity: 0
        },
        wind: {
          speed: 15,
          direction: 200
        },
        humidity: 70,
        visibility: 12
      },
      {
        location: {
          name: 'Boston',
          coordinates: { latitude: 42.3601, longitude: -71.0589 }
        },
        timestamp: new Date('2024-01-15T14:00:00Z'),
        temperature: {
          current: 8,
          feelsLike: 5,
          min: 5,
          max: 12
        },
        conditions: {
          main: WeatherCondition.RAINY,
          description: 'Light rain',
          icon: '10d'
        },
        precipitation: {
          type: PrecipitationType.RAIN,
          probability: 80,
          intensity: 3
        },
        wind: {
          speed: 20,
          direction: 220
        },
        humidity: 85,
        visibility: 8
      }
    ];
  });

  describe('integrateRouteWithWeather', () => {
    it('should successfully integrate route with weather data', async () => {
      const result = await service.integrateRouteWithWeather(
        mockRoute,
        mockWeatherData,
        startTime
      );

      expect(result).toBeDefined();
      expect(result.route).toEqual(mockRoute);
      expect(result.weatherData).toEqual(mockWeatherData);
      expect(result.timeline).toHaveLength(mockRoute.waypoints.length);
      expect(result.startTime).toEqual(startTime);
      expect(result.endTime).toEqual(new Date(startTime.getTime() + mockRoute.estimatedDuration * 1000));
      expect(result.totalDuration).toBe(mockRoute.estimatedDuration);
      expect(result.dataQuality).toBeDefined();
      expect(result.dataQuality.completeness).toBeGreaterThan(0);
      expect(result.dataQuality.confidence).toBeGreaterThan(0);
    });

    it('should throw error for invalid route data', async () => {
      const invalidRoute = { ...mockRoute, waypoints: [] };

      await expect(
        service.integrateRouteWithWeather(invalidRoute, mockWeatherData, startTime)
      ).rejects.toThrow(DataProcessingError);
    });

    it('should throw error for empty weather data', async () => {
      await expect(
        service.integrateRouteWithWeather(mockRoute, [], startTime)
      ).rejects.toThrow(DataProcessingError);
    });

    it('should handle missing weather data with interpolation', async () => {
      const limitedWeatherData = [mockWeatherData[0], mockWeatherData[2]]; // Skip middle point

      const result = await service.integrateRouteWithWeather(
        mockRoute,
        limitedWeatherData,
        startTime
      );

      expect(result.timeline).toHaveLength(mockRoute.waypoints.length);
      expect(result.dataQuality.interpolatedPoints).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('createTimelineSynchronization', () => {
    it('should create timeline with correct timing', async () => {
      const timeline = await service.createTimelineSynchronization(
        mockRoute,
        mockWeatherData,
        startTime
      );

      expect(timeline).toHaveLength(mockRoute.waypoints.length);
      
      // Check first waypoint timing
      expect(timeline[0].travelTime).toEqual(startTime);
      expect(timeline[0].timeFromStart).toBe(0);
      
      // Check last waypoint timing
      const lastPoint = timeline[timeline.length - 1];
      expect(lastPoint.timeFromStart).toBe(mockRoute.estimatedDuration);
      expect(lastPoint.travelTime).toEqual(
        new Date(startTime.getTime() + mockRoute.estimatedDuration * 1000)
      );
    });

    it('should assign weather data to closest waypoints', async () => {
      const timeline = await service.createTimelineSynchronization(
        mockRoute,
        mockWeatherData,
        startTime
      );

      // First waypoint should get first weather data
      expect(timeline[0].weather.location.name).toBe('New York');
      
      // Last waypoint should get last weather data
      const lastPoint = timeline[timeline.length - 1];
      expect(lastPoint.weather.location.name).toBe('Boston');
    });

    it('should calculate confidence scores correctly', async () => {
      const timeline = await service.createTimelineSynchronization(
        mockRoute,
        mockWeatherData,
        startTime
      );

      timeline.forEach(point => {
        expect(point.confidence).toBeGreaterThan(0);
        expect(point.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('alignWeatherWithRouteSegments', () => {
    it('should align weather data with route segments', () => {
      const alignedSegments = service.alignWeatherWithRouteSegments(
        mockRoute,
        mockWeatherData,
        startTime
      );

      expect(alignedSegments).toHaveLength(mockRoute.segments.length);
      
      alignedSegments.forEach((aligned, index) => {
        expect(aligned.segment).toEqual(mockRoute.segments[index]);
        expect(aligned.segmentStartTime).toBeDefined();
        expect(aligned.segmentEndTime).toBeDefined();
        expect(aligned.averageWeather).toBeDefined();
      });
    });

    it('should calculate segment timing correctly', () => {
      const alignedSegments = service.alignWeatherWithRouteSegments(
        mockRoute,
        mockWeatherData,
        startTime
      );

      // First segment should start at route start time
      expect(alignedSegments[0].segmentStartTime).toEqual(startTime);
      
      // Second segment should start when first segment ends
      const firstSegmentDuration = mockRoute.segments[0].estimatedDuration;
      const expectedSecondStart = new Date(startTime.getTime() + firstSegmentDuration * 1000);
      expect(alignedSegments[1].segmentStartTime).toEqual(expectedSecondStart);
    });

    it('should handle segments with no direct weather matches', () => {
      // Create weather data that doesn't align perfectly with segments
      const misalignedWeatherData = [
        {
          ...mockWeatherData[0],
          timestamp: new Date('2024-01-15T09:30:00Z') // Before route start
        },
        {
          ...mockWeatherData[2],
          timestamp: new Date('2024-01-15T15:00:00Z') // After route end
        }
      ];

      const alignedSegments = service.alignWeatherWithRouteSegments(
        mockRoute,
        misalignedWeatherData,
        startTime
      );

      expect(alignedSegments).toHaveLength(mockRoute.segments.length);
      alignedSegments.forEach(aligned => {
        expect(aligned.averageWeather).toBeDefined();
      });
    });
  });

  describe('validateDataConsistency', () => {
    it('should validate consistent data successfully', () => {
      const validation = service.validateDataConsistency(
        mockRoute,
        mockWeatherData,
        startTime
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.dataConsistencyScore).toBeGreaterThan(0.5);
    });

    it('should detect route validation errors', () => {
      const invalidRoute = { ...mockRoute, waypoints: [] };
      
      const validation = service.validateDataConsistency(
        invalidRoute,
        mockWeatherData,
        startTime
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Route must contain waypoints for weather integration'
      );
    });

    it('should detect weather data validation errors', () => {
      const validation = service.validateDataConsistency(
        mockRoute,
        [],
        startTime
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Weather data is required for route integration'
      );
    });

    it('should detect time alignment issues', () => {
      const futureWeatherData = mockWeatherData.map(weather => ({
        ...weather,
        timestamp: new Date(weather.timestamp.getTime() + 24 * 60 * 60 * 1000) // 1 day later
      }));

      const validation = service.validateDataConsistency(
        mockRoute,
        futureWeatherData,
        startTime
      );

      expect(validation.warnings).toContain(
        'Weather data starts after route start time'
      );
    });

    it('should calculate missing data points', () => {
      const limitedWeatherData = [mockWeatherData[0]]; // Only one data point
      
      const validation = service.validateDataConsistency(
        mockRoute,
        limitedWeatherData,
        startTime
      );

      expect(validation.missingDataPoints).toBeGreaterThan(0);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it('should validate geographic alignment', () => {
      const distantWeatherData = mockWeatherData.map(weather => ({
        ...weather,
        location: {
          ...weather.location,
          coordinates: {
            latitude: weather.location.coordinates.latitude + 10, // Far from route
            longitude: weather.location.coordinates.longitude + 10
          }
        }
      }));

      const validation = service.validateDataConsistency(
        mockRoute,
        distantWeatherData,
        startTime
      );

      expect(validation.warnings).toContain(
        'Weather data geographic coverage may not fully align with route'
      );
    });
  });

  describe('error handling', () => {
    it('should handle null route data', async () => {
      await expect(
        service.integrateRouteWithWeather(null as any, mockWeatherData, startTime)
      ).rejects.toThrow(DataProcessingError);
    });

    it('should handle invalid weather timestamps', async () => {
      const invalidWeatherData = [
        {
          ...mockWeatherData[0],
          timestamp: new Date('invalid-date')
        }
      ];

      await expect(
        service.integrateRouteWithWeather(mockRoute, invalidWeatherData, startTime)
      ).rejects.toThrow(DataProcessingError);
    });

    it('should handle invalid weather coordinates', async () => {
      const invalidWeatherData = [
        {
          ...mockWeatherData[0],
          location: {
            ...mockWeatherData[0].location,
            coordinates: { latitude: 200, longitude: 200 } // Invalid coordinates
          }
        }
      ];

      await expect(
        service.integrateRouteWithWeather(mockRoute, invalidWeatherData, startTime)
      ).rejects.toThrow(DataProcessingError);
    });

    it('should provide helpful error suggestions', async () => {
      try {
        await service.integrateRouteWithWeather(
          { ...mockRoute, waypoints: [] },
          mockWeatherData,
          startTime
        );
      } catch (error) {
        expect(error).toBeInstanceOf(DataProcessingError);
        expect((error as DataProcessingError).suggestions).toBeDefined();
        expect((error as DataProcessingError).suggestions!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('weather interpolation', () => {
    it('should interpolate weather data between points', async () => {
      const sparseWeatherData = [mockWeatherData[0], mockWeatherData[2]]; // Skip middle
      
      const result = await service.integrateRouteWithWeather(
        mockRoute,
        sparseWeatherData,
        startTime
      );

      const interpolatedPoints = result.timeline.filter(point => point.isInterpolated);
      expect(interpolatedPoints.length).toBeGreaterThan(0);
      
      interpolatedPoints.forEach(point => {
        expect(point.confidence).toBeLessThan(1.0); // Interpolated points have lower confidence
        expect(point.weather.temperature.current).toBeGreaterThan(0);
      });
    });

    it('should handle wind direction interpolation correctly', async () => {
      const weatherWithWinds = [
        { ...mockWeatherData[0], wind: { speed: 10, direction: 350 } }, // Near 0°
        { ...mockWeatherData[2], wind: { speed: 15, direction: 10 } }   // Near 0°
      ];

      const result = await service.integrateRouteWithWeather(
        mockRoute,
        weatherWithWinds,
        startTime
      );

      const interpolatedPoints = result.timeline.filter(point => point.isInterpolated);
      interpolatedPoints.forEach(point => {
        expect(point.weather.wind.direction).toBeGreaterThanOrEqual(0);
        expect(point.weather.wind.direction).toBeLessThan(360);
      });
    });
  });

  describe('data quality analysis', () => {
    it('should calculate completeness correctly', async () => {
      const result = await service.integrateRouteWithWeather(
        mockRoute,
        mockWeatherData,
        startTime
      );

      expect(result.dataQuality.completeness).toBeGreaterThan(0);
      expect(result.dataQuality.completeness).toBeLessThanOrEqual(1);
    });

    it('should track interpolated points', async () => {
      const sparseWeatherData = [mockWeatherData[0]]; // Very limited data
      
      const result = await service.integrateRouteWithWeather(
        mockRoute,
        sparseWeatherData,
        startTime
      );

      expect(result.dataQuality.interpolatedPoints).toBeGreaterThan(0);
    });

    it('should calculate average confidence', async () => {
      const result = await service.integrateRouteWithWeather(
        mockRoute,
        mockWeatherData,
        startTime
      );

      expect(result.dataQuality.confidence).toBeGreaterThan(0);
      expect(result.dataQuality.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('warning generation', () => {
    it('should warn about excessive interpolation', async () => {
      const minimalWeatherData = [mockWeatherData[0]]; // Only one point
      
      const result = await service.integrateRouteWithWeather(
        mockRoute,
        minimalWeatherData,
        startTime
      );

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about extreme weather conditions', async () => {
      const extremeWeatherData = [
        {
          ...mockWeatherData[0],
          temperature: { current: -20, feelsLike: -25, min: -25, max: -15 },
          wind: { speed: 60, direction: 180 }
        }
      ];

      const result = await service.integrateRouteWithWeather(
        mockRoute,
        extremeWeatherData,
        startTime
      );

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about low confidence predictions', async () => {
      // Create weather data that will result in low confidence
      const distantWeatherData = mockWeatherData.map(weather => ({
        ...weather,
        location: {
          ...weather.location,
          coordinates: {
            latitude: weather.location.coordinates.latitude + 1, // 1 degree away
            longitude: weather.location.coordinates.longitude + 1
          }
        },
        timestamp: new Date(weather.timestamp.getTime() + 4 * 60 * 60 * 1000) // 4 hours off
      }));

      const result = await service.integrateRouteWithWeather(
        mockRoute,
        distantWeatherData,
        startTime
      );

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});