import { describe, it, expect } from 'vitest';
import {
  validateAndSanitizeLocationString,
  validateAndSanitizeCoordinates,
  validateAndSanitizeDuration,
  validateAndSanitizeSpeed,
  validateTravelMode,
  validateCompleteLocation
} from '../enhancedValidation.js';
import { TravelMode } from '../../types/travel.js';

describe('validateAndSanitizeLocationString', () => {
  it('should validate and sanitize correct location string', () => {
    const result = validateAndSanitizeLocationString('  New York, NY  ');
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData).toBe('New York, NY');
    expect(result.errors).toHaveLength(0);
    expect(result.errorResponse).toBeUndefined();
  });

  it('should reject non-string input', () => {
    const result = validateAndSanitizeLocationString(123);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location must be a string');
    expect(result.errorResponse).toBeDefined();
  });

  it('should reject empty string after sanitization', () => {
    const result = validateAndSanitizeLocationString('<script></script>');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location cannot be empty after sanitization');
  });

  it('should reject strings with only numbers', () => {
    const result = validateAndSanitizeLocationString('12345');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location cannot be just numbers');
  });

  it('should reject strings without letters', () => {
    const result = validateAndSanitizeLocationString('123-456');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location must contain at least one letter');
  });
});

describe('validateAndSanitizeCoordinates', () => {
  it('should validate and sanitize correct coordinates', () => {
    const result = validateAndSanitizeCoordinates('40.7128', '-74.0060');
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData).toEqual({ latitude: 40.7128, longitude: -74.0060 });
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid coordinate format', () => {
    const result = validateAndSanitizeCoordinates('invalid', 'coordinates');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid coordinate format - must be valid numbers');
    expect(result.errorResponse).toBeDefined();
  });

  it('should validate coordinate ranges', () => {
    const result = validateAndSanitizeCoordinates('100', '-200');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Latitude must be between -90 and 90 degrees');
    expect(result.errors).toContain('Longitude must be between -180 and 180 degrees');
  });
});

describe('validateAndSanitizeDuration', () => {
  it('should validate and sanitize correct duration', () => {
    const result = validateAndSanitizeDuration('5.5');
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData).toBe(5.5);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid duration format', () => {
    const result = validateAndSanitizeDuration('invalid');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Duration must be a positive number');
  });

  it('should reject very short duration', () => {
    const result = validateAndSanitizeDuration('0.05');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Duration must be at least 0.1 hours (6 minutes)');
  });

  it('should reject very long duration', () => {
    const result = validateAndSanitizeDuration('1000');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Duration cannot exceed 720 hours (30 days)');
  });
});

describe('validateAndSanitizeSpeed', () => {
  it('should validate and sanitize correct speed', () => {
    const result = validateAndSanitizeSpeed('60');
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData).toBe(60);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid speed format', () => {
    const result = validateAndSanitizeSpeed('invalid');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Speed must be a positive number');
  });

  it('should validate speed for walking mode', () => {
    const result = validateAndSanitizeSpeed('0.5', TravelMode.WALKING);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Speed for walking must be at least 1 km/h');
  });

  it('should validate speed for flying mode', () => {
    const result = validateAndSanitizeSpeed('50', TravelMode.FLYING);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Speed for flying must be at least 200 km/h');
  });

  it('should validate maximum speed for cycling', () => {
    const result = validateAndSanitizeSpeed('100', TravelMode.CYCLING);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Speed for cycling cannot exceed 50 km/h');
  });
});

describe('validateTravelMode', () => {
  it('should validate correct travel mode', () => {
    const result = validateTravelMode('driving');
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData).toBe(TravelMode.DRIVING);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle case insensitive input', () => {
    const result = validateTravelMode('FLYING');
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData).toBe(TravelMode.FLYING);
  });

  it('should reject non-string input', () => {
    const result = validateTravelMode(123);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Travel mode must be a string');
  });

  it('should reject invalid travel mode', () => {
    const result = validateTravelMode('teleporting');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid travel mode. Valid options are: driving, walking, cycling, flying, sailing, cruise');
  });
});

describe('validateCompleteLocation', () => {
  it('should validate complete location object', () => {
    const location = {
      name: 'New York',
      coordinates: { latitude: 40.7128, longitude: -74.0060 },
      address: '123 Main St'
    };
    
    const result = validateCompleteLocation(location);
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData).toEqual({
      name: 'New York',
      coordinates: { latitude: 40.7128, longitude: -74.0060 },
      address: '123 Main St'
    });
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-object input', () => {
    const result = validateCompleteLocation('not an object');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location must be an object');
  });

  it('should reject location without coordinates', () => {
    const location = { name: 'New York' };
    
    const result = validateCompleteLocation(location);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Coordinates are required');
  });

  it('should validate and sanitize all fields', () => {
    const location = {
      name: '  New York  ',
      coordinates: { latitude: '40.7128', longitude: '-74.0060' },
      address: '  123 Main St  '
    };
    
    const result = validateCompleteLocation(location);
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData?.name).toBe('New York');
    expect(result.sanitizedData?.coordinates).toEqual({ latitude: 40.7128, longitude: -74.0060 });
    expect(result.sanitizedData?.address).toBe('123 Main St');
  });

  it('should accumulate errors from all validations', () => {
    const location = {
      name: '123',
      coordinates: { latitude: 100, longitude: -200 }
    };
    
    const result = validateCompleteLocation(location);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors).toContain('Location cannot be just numbers');
    expect(result.errors).toContain('Latitude must be between -90 and 90 degrees');
    expect(result.errors).toContain('Longitude must be between -180 and 180 degrees');
  });
});