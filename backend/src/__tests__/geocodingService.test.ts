import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GeocodingService } from '../services/geocodingService.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GeocodingService', () => {
  let geocodingService: GeocodingService;

  beforeEach(() => {
    geocodingService = new GeocodingService('test-api-key');
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('geocodeLocation', () => {
    it('should successfully geocode a valid location', async () => {
      const mockResponse = {
        results: [{
          formatted_address: 'New York, NY, USA',
          geometry: {
            location: {
              lat: 40.7128,
              lng: -74.0060
            }
          },
          place_id: 'test-place-id',
          types: ['locality', 'political']
        }],
        status: 'OK'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await geocodingService.geocodeLocation('New York');

      expect(result.location).toEqual({
        name: 'New York, NY',
        coordinates: {
          latitude: 40.7128,
          longitude: -74.0060
        },
        address: 'New York, NY, USA'
      });
      expect(result.confidence).toBeGreaterThan(0.5);

      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle invalid location input', async () => {
      await expect(geocodingService.geocodeLocation('')).rejects.toMatchObject({
        code: 'INVALID_LOCATION_INPUT',
        message: expect.stringContaining('Invalid location input'),
        suggestions: expect.arrayContaining([
          expect.stringContaining('Please provide a valid location')
        ])
      });
    });

    it('should handle location not found', async () => {
      const mockResponse = {
        results: [],
        status: 'ZERO_RESULTS'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(geocodingService.geocodeLocation('NonexistentPlace123')).rejects.toMatchObject({
        code: 'LOCATION_NOT_FOUND',
        message: expect.stringContaining('not found'),
        suggestions: expect.arrayContaining([
          expect.stringContaining('Try a more specific address')
        ])
      });
    });

    it('should handle API rate limiting', async () => {
      const mockResponse = {
        results: [],
        status: 'OVER_QUERY_LIMIT'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(geocodingService.geocodeLocation('New York')).rejects.toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED',
        message: expect.stringContaining('Too many requests'),
        suggestions: expect.arrayContaining([
          expect.stringContaining('Wait a few minutes')
        ])
      });
    });

    it('should handle API request failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(geocodingService.geocodeLocation('New York')).rejects.toMatchObject({
        code: 'API_REQUEST_FAILED',
        message: expect.stringContaining('Geocoding API request failed'),
        suggestions: expect.arrayContaining([
          expect.stringContaining('Please try again later')
        ])
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(geocodingService.geocodeLocation('New York')).rejects.toMatchObject({
        code: 'GEOCODING_SERVICE_ERROR',
        message: expect.stringContaining('Failed to geocode location'),
        suggestions: expect.arrayContaining([
          expect.stringContaining('Please check your internet connection')
        ])
      });
    });

    it('should return mock data when no API key is provided', async () => {
      const serviceWithoutKey = new GeocodingService();
      
      const result = await serviceWithoutKey.geocodeLocation('new york');

      expect(result).toEqual({
        location: {
          name: 'New York, NY',
          coordinates: {
            latitude: 40.7128,
            longitude: -74.0060
          },
          address: 'New York, NY, USA'
        },
        confidence: 0.9,
        suggestions: expect.any(Array)
      });

      // Should not make any API calls
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should provide suggestions for low confidence results', async () => {
      const mockResponse = {
        results: [
          {
            formatted_address: 'Springfield, IL, USA',
            geometry: {
              location: { lat: 39.7817, lng: -89.6501 }
            },
            place_id: 'test-place-id-1',
            types: ['locality']
          },
          {
            formatted_address: 'Springfield, MA, USA',
            geometry: {
              location: { lat: 42.1015, lng: -72.5898 }
            },
            place_id: 'test-place-id-2',
            types: ['locality']
          }
        ],
        status: 'OK'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await geocodingService.geocodeLocation('Springfield');

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toContain('Springfield, MA, USA');
    });
  });

  describe('validateLocations', () => {
    it('should validate multiple locations in batch', async () => {
      const mockResponse1 = {
        results: [{
          formatted_address: 'New York, NY, USA',
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          place_id: 'test-1',
          types: ['locality']
        }],
        status: 'OK'
      };

      const mockResponse2 = {
        results: [{
          formatted_address: 'Los Angeles, CA, USA',
          geometry: { location: { lat: 34.0522, lng: -118.2437 } },
          place_id: 'test-2',
          types: ['locality']
        }],
        status: 'OK'
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse1)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse2)
        });

      const results = await geocodingService.validateLocations(['New York', 'Los Angeles']);

      expect(results).toHaveProperty('New York');
      expect(results).toHaveProperty('Los Angeles');
      expect(results['New York']).toHaveProperty('location');
      expect(results['Los Angeles']).toHaveProperty('location');
    });

    it('should handle mixed success and failure results', async () => {
      const mockSuccessResponse = {
        results: [{
          formatted_address: 'New York, NY, USA',
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          place_id: 'test-1',
          types: ['locality']
        }],
        status: 'OK'
      };

      const mockFailureResponse = {
        results: [],
        status: 'ZERO_RESULTS'
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFailureResponse)
        });

      const results = await geocodingService.validateLocations(['New York', 'InvalidLocation']);

      expect(results['New York']).toHaveProperty('location');
      expect(results['InvalidLocation']).toHaveProperty('code', 'LOCATION_NOT_FOUND');
    });
  });

  describe('caching', () => {
    it('should cache successful geocoding results', async () => {
      const mockResponse = {
        results: [{
          formatted_address: 'New York, NY, USA',
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          place_id: 'test-1',
          types: ['locality']
        }],
        status: 'OK'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      // First call should make API request
      const result1 = await geocodingService.geocodeLocation('New York');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await geocodingService.geocodeLocation('New York');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call

      expect(result1).toEqual(result2);
    });

    it('should handle case-insensitive caching', async () => {
      const mockResponse = {
        results: [{
          formatted_address: 'New York, NY, USA',
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          place_id: 'test-1',
          types: ['locality']
        }],
        status: 'OK'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await geocodingService.geocodeLocation('New York');
      await geocodingService.geocodeLocation('new york');
      await geocodingService.geocodeLocation('NEW YORK');

      // Should only make one API call due to case-insensitive caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should provide cache statistics', () => {
      const stats = geocodingService.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
    });

    it('should clear expired cache entries', async () => {
      // This test would require mocking Date.now() to simulate time passage
      // For now, we'll just test that the method exists and doesn't throw
      expect(() => geocodingService.clearExpiredCache()).not.toThrow();
    });
  });

  describe('input validation and sanitization', () => {
    it('should handle whitespace in location input', async () => {
      const mockResponse = {
        results: [{
          formatted_address: 'New York, NY, USA',
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          place_id: 'test-1',
          types: ['locality']
        }],
        status: 'OK'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await geocodingService.geocodeLocation('  New York  ');
      
      expect(result.location.name).toBe('New York, NY');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('address=New+York')
      );
    });

    it('should reject null or undefined input', async () => {
      await expect(geocodingService.geocodeLocation(null as any)).rejects.toMatchObject({
        code: 'INVALID_LOCATION_INPUT'
      });

      await expect(geocodingService.geocodeLocation(undefined as any)).rejects.toMatchObject({
        code: 'INVALID_LOCATION_INPUT'
      });
    });

    it('should reject extremely long input', async () => {
      const longInput = 'a'.repeat(1000);
      
      await expect(geocodingService.geocodeLocation(longInput)).rejects.toMatchObject({
        code: 'INVALID_LOCATION_INPUT'
      });
    });
  });

  describe('confidence calculation', () => {
    it('should assign higher confidence to exact matches', async () => {
      const mockResponse = {
        results: [{
          formatted_address: 'New York, NY, USA',
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          place_id: 'test-1',
          types: ['locality', 'political']
        }],
        status: 'OK'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await geocodingService.geocodeLocation('New York');
      
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should assign higher confidence to street addresses', async () => {
      const mockResponse = {
        results: [{
          formatted_address: '123 Main St, New York, NY, USA',
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          place_id: 'test-1',
          types: ['street_address']
        }],
        status: 'OK'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await geocodingService.geocodeLocation('123 Main St, New York');
      
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });
});