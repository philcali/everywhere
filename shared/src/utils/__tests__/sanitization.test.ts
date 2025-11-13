import { describe, it, expect } from 'vitest';
import {
  sanitizeLocationString,
  sanitizeCoordinates,
  sanitizeDuration,
  sanitizeSpeed,
  sanitizeString,
  sanitizeObject
} from '../sanitization.js';

describe('sanitizeLocationString', () => {
  it('should sanitize normal location string', () => {
    const result = sanitizeLocationString('  New York, NY  ');
    expect(result).toBe('New York, NY');
  });

  it('should remove HTML tags', () => {
    const result = sanitizeLocationString('<script>alert("xss")</script>New York');
    expect(result).toBe('New York');
  });

  it('should remove JavaScript content', () => {
    const result = sanitizeLocationString('javascript:alert("xss") New York');
    expect(result).toBe(' New York');
  });

  it('should remove event handlers', () => {
    const result = sanitizeLocationString('onclick="alert(1)" New York');
    expect(result).toBe(' New York');
  });

  it('should normalize multiple spaces', () => {
    const result = sanitizeLocationString('New    York     City');
    expect(result).toBe('New York City');
  });

  it('should truncate long strings', () => {
    const longString = 'A'.repeat(250);
    const result = sanitizeLocationString(longString);
    expect(result).toHaveLength(200);
  });

  it('should handle non-string input', () => {
    const result = sanitizeLocationString(123 as any);
    expect(result).toBe('');
  });
});

describe('sanitizeCoordinates', () => {
  it('should sanitize valid coordinates', () => {
    const result = sanitizeCoordinates('40.7128', '-74.0060');
    expect(result).toEqual({ latitude: 40.7128, longitude: -74.0060 });
  });

  it('should clamp latitude to valid range', () => {
    const result = sanitizeCoordinates('100', '0');
    expect(result).toEqual({ latitude: 90, longitude: 0 });
  });

  it('should normalize longitude', () => {
    const result = sanitizeCoordinates('0', '190');
    expect(result).toEqual({ latitude: 0, longitude: -170 });
  });

  it('should return null for invalid input', () => {
    const result = sanitizeCoordinates('invalid', 'coordinates');
    expect(result).toBeNull();
  });

  it('should handle numeric input', () => {
    const result = sanitizeCoordinates(40.7128, -74.0060);
    expect(result).toEqual({ latitude: 40.7128, longitude: -74.0060 });
  });
});

describe('sanitizeDuration', () => {
  it('should sanitize valid duration', () => {
    const result = sanitizeDuration('5.5');
    expect(result).toBe(5.5);
  });

  it('should limit maximum duration', () => {
    const result = sanitizeDuration('1000');
    expect(result).toBe(720);
  });

  it('should return null for invalid input', () => {
    const result = sanitizeDuration('invalid');
    expect(result).toBeNull();
  });

  it('should return null for negative values', () => {
    const result = sanitizeDuration('-5');
    expect(result).toBeNull();
  });

  it('should handle numeric input', () => {
    const result = sanitizeDuration(10);
    expect(result).toBe(10);
  });
});

describe('sanitizeSpeed', () => {
  it('should sanitize valid speed', () => {
    const result = sanitizeSpeed('60');
    expect(result).toBe(60);
  });

  it('should limit maximum speed', () => {
    const result = sanitizeSpeed('2000');
    expect(result).toBe(1000);
  });

  it('should return null for invalid input', () => {
    const result = sanitizeSpeed('invalid');
    expect(result).toBeNull();
  });

  it('should return null for negative values', () => {
    const result = sanitizeSpeed('-60');
    expect(result).toBeNull();
  });

  it('should handle numeric input', () => {
    const result = sanitizeSpeed(80);
    expect(result).toBe(80);
  });
});

describe('sanitizeString', () => {
  it('should sanitize normal string', () => {
    const result = sanitizeString('  Hello World  ');
    expect(result).toBe('Hello World');
  });

  it('should remove HTML tags', () => {
    const result = sanitizeString('<div>Hello</div>');
    expect(result).toBe('Hello');
  });

  it('should limit length', () => {
    const longString = 'A'.repeat(150);
    const result = sanitizeString(longString, 50);
    expect(result).toHaveLength(50);
  });

  it('should handle non-string input', () => {
    const result = sanitizeString(123 as any);
    expect(result).toBe('');
  });
});

describe('sanitizeObject', () => {
  it('should sanitize object properties', () => {
    const input = {
      name: '  John  ',
      age: 25,
      location: {
        city: '  New York  ',
        coordinates: { lat: 40.7128, lon: -74.0060 }
      },
      tags: ['  tag1  ', '  tag2  ']
    };

    const result = sanitizeObject(input);

    expect(result.name).toBe('John');
    expect(result.age).toBe(25);
    expect(result.location.city).toBe('New York');
    expect(result.location.coordinates.lat).toBe(40.7128);
    expect(result.tags).toEqual(['tag1', 'tag2']);
  });

  it('should handle infinite numbers', () => {
    const input = { value: Infinity };
    const result = sanitizeObject(input);
    expect(result.value).toBe(0);
  });

  it('should handle nested objects', () => {
    const input = {
      level1: {
        level2: {
          value: '  test  '
        }
      }
    };

    const result = sanitizeObject(input);
    expect(result.level1.level2.value).toBe('test');
  });
});