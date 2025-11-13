import { describe, it, expect } from 'vitest';
import {
  validateLocation,
  validateCoordinates,
  validateTravelConfig,
  validateLocationString
} from '../validation.js';
import { TravelMode } from '../../types/travel.js';

describe('validateLocation', () => {
  it('should validate a correct location', () => {
    const location = {
      name: 'New York',
      coordinates: { latitude: 40.7128, longitude: -74.0060 },
      address: '123 Main St'
    };

    const result = validateLocation(location);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject location without name', () => {
    const location = {
      coordinates: { latitude: 40.7128, longitude: -74.0060 }
    };

    const result = validateLocation(location);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location name is required and must be a non-empty string');
  });

  it('should reject location with empty name', () => {
    const location = {
      name: '   ',
      coordinates: { latitude: 40.7128, longitude: -74.0060 }
    };

    const result = validateLocation(location);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location name is required and must be a non-empty string');
  });

  it('should reject location without coordinates', () => {
    const location = {
      name: 'New York'
    };

    const result = validateLocation(location);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location coordinates are required');
  });

  it('should reject location with invalid coordinates', () => {
    const location = {
      name: 'Invalid Location',
      coordinates: { latitude: 100, longitude: -200 }
    };

    const result = validateLocation(location);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Latitude must be between -90 and 90 degrees');
    expect(result.errors).toContain('Longitude must be between -180 and 180 degrees');
  });
});

describe('validateCoordinates', () => {
  it('should validate correct coordinates', () => {
    const result = validateCoordinates(40.7128, -74.0060);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid latitude', () => {
    const result = validateCoordinates(100, -74.0060);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Latitude must be between -90 and 90 degrees');
  });

  it('should reject invalid longitude', () => {
    const result = validateCoordinates(40.7128, -200);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Longitude must be between -180 and 180 degrees');
  });

  it('should reject non-numeric coordinates', () => {
    const result = validateCoordinates(NaN, -74.0060);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Latitude must be a valid number');
  });
});

describe('validateTravelConfig', () => {
  it('should validate correct travel config', () => {
    const config = {
      mode: TravelMode.DRIVING,
      customDuration: 5,
      customSpeed: 60,
      preferences: {
        weatherUpdateInterval: 30,
        routeOptimization: true
      }
    };

    const result = validateTravelConfig(config);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid travel mode', () => {
    const config = {
      mode: 'invalid' as any,
      preferences: {
        weatherUpdateInterval: 30,
        routeOptimization: true
      }
    };

    const result = validateTravelConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Valid travel mode is required');
  });

  it('should reject negative custom duration', () => {
    const config = {
      mode: TravelMode.DRIVING,
      customDuration: -5,
      preferences: {
        weatherUpdateInterval: 30,
        routeOptimization: true
      }
    };

    const result = validateTravelConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Custom duration must be a positive number (in hours)');
  });

  it('should reject negative custom speed', () => {
    const config = {
      mode: TravelMode.DRIVING,
      customSpeed: -60,
      preferences: {
        weatherUpdateInterval: 30,
        routeOptimization: true
      }
    };

    const result = validateTravelConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Custom speed must be a positive number');
  });

  it('should reject negative weather update interval', () => {
    const config = {
      mode: TravelMode.DRIVING,
      preferences: {
        weatherUpdateInterval: -30,
        routeOptimization: true
      }
    };

    const result = validateTravelConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Weather update interval must be a positive number (in minutes)');
  });
});

describe('validateLocationString', () => {
  it('should validate correct location string', () => {
    const result = validateLocationString('New York, NY');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty string', () => {
    const result = validateLocationString('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location must be a non-empty string');
  });

  it('should reject string with only whitespace', () => {
    const result = validateLocationString('   ');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location cannot be empty');
  });

  it('should reject very short string', () => {
    const result = validateLocationString('A');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location must be at least 2 characters long');
  });

  it('should reject very long string', () => {
    const longString = 'A'.repeat(201);
    const result = validateLocationString(longString);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location must be less than 200 characters');
  });

  it('should reject potentially malicious input', () => {
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<iframe src="evil.com"></iframe>',
      'onclick="alert(1)"'
    ];

    maliciousInputs.forEach(input => {
      const result = validateLocationString(input);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Location contains invalid characters');
    });
  });

  it('should accept normal location strings with special characters', () => {
    const validInputs = [
      'São Paulo, Brazil',
      'München, Germany',
      'New York, NY 10001',
      '123 Main St, Anytown USA'
    ];

    validInputs.forEach(input => {
      const result = validateLocationString(input);
      expect(result.isValid).toBe(true);
    });
  });
});