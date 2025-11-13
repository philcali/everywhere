import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  calculateBearing,
  calculateDestination,
  calculateMidpoint,
  generateWaypoints,
  isWithinBounds,
  normalizeLongitude,
  normalizeLatitude
} from '../coordinates.js';

describe('calculateDistance', () => {
  it('should calculate distance between New York and Los Angeles', () => {
    const nyc = { latitude: 40.7128, longitude: -74.0060 };
    const la = { latitude: 34.0522, longitude: -118.2437 };
    
    const distance = calculateDistance(nyc, la);
    // Expected distance is approximately 3936 km
    expect(distance).toBeCloseTo(3936, 0);
  });

  it('should return 0 for same coordinates', () => {
    const coord = { latitude: 40.7128, longitude: -74.0060 };
    const distance = calculateDistance(coord, coord);
    expect(distance).toBe(0);
  });

  it('should calculate distance between London and Paris', () => {
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    
    const distance = calculateDistance(london, paris);
    // Expected distance is approximately 344 km
    expect(distance).toBeCloseTo(344, 0);
  });
});

describe('calculateBearing', () => {
  it('should calculate bearing from New York to Los Angeles', () => {
    const nyc = { latitude: 40.7128, longitude: -74.0060 };
    const la = { latitude: 34.0522, longitude: -118.2437 };
    
    const bearing = calculateBearing(nyc, la);
    // Expected bearing is approximately 274 degrees (west-southwest)
    expect(bearing).toBeCloseTo(274, 0);
  });

  it('should calculate bearing due north', () => {
    const start = { latitude: 0, longitude: 0 };
    const end = { latitude: 1, longitude: 0 };
    
    const bearing = calculateBearing(start, end);
    expect(bearing).toBeCloseTo(0, 1);
  });

  it('should calculate bearing due east', () => {
    const start = { latitude: 0, longitude: 0 };
    const end = { latitude: 0, longitude: 1 };
    
    const bearing = calculateBearing(start, end);
    expect(bearing).toBeCloseTo(90, 1);
  });
});

describe('calculateDestination', () => {
  it('should calculate destination point', () => {
    const start = { latitude: 40.7128, longitude: -74.0060 };
    const distance = 100; // 100 km
    const bearing = 90; // Due east
    
    const destination = calculateDestination(start, distance, bearing);
    
    // Should be approximately 100km east of NYC
    expect(destination.latitude).toBeCloseTo(40.7128, 1);
    expect(destination.longitude).toBeGreaterThan(-74.0060);
  });

  it('should return same point for zero distance', () => {
    const start = { latitude: 40.7128, longitude: -74.0060 };
    const destination = calculateDestination(start, 0, 90);
    
    expect(destination.latitude).toBeCloseTo(start.latitude, 6);
    expect(destination.longitude).toBeCloseTo(start.longitude, 6);
  });
});

describe('calculateMidpoint', () => {
  it('should calculate midpoint between two coordinates', () => {
    const coord1 = { latitude: 40.7128, longitude: -74.0060 };
    const coord2 = { latitude: 34.0522, longitude: -118.2437 };
    
    const midpoint = calculateMidpoint(coord1, coord2);
    
    // Midpoint should be between the two coordinates
    expect(midpoint.latitude).toBeGreaterThan(34.0522);
    expect(midpoint.latitude).toBeLessThan(40.7128);
    expect(midpoint.longitude).toBeGreaterThan(-118.2437);
    expect(midpoint.longitude).toBeLessThan(-74.0060);
  });

  it('should return same point when coordinates are identical', () => {
    const coord = { latitude: 40.7128, longitude: -74.0060 };
    const midpoint = calculateMidpoint(coord, coord);
    
    expect(midpoint.latitude).toBeCloseTo(coord.latitude, 6);
    expect(midpoint.longitude).toBeCloseTo(coord.longitude, 6);
  });
});

describe('generateWaypoints', () => {
  it('should generate correct number of waypoints', () => {
    const start = { latitude: 40.7128, longitude: -74.0060 };
    const end = { latitude: 34.0522, longitude: -118.2437 };
    
    const waypoints = generateWaypoints(start, end, 5);
    
    expect(waypoints).toHaveLength(5);
    expect(waypoints[0]).toEqual(start);
    expect(waypoints[4]).toEqual(end);
  });

  it('should return start and end for less than 2 points', () => {
    const start = { latitude: 40.7128, longitude: -74.0060 };
    const end = { latitude: 34.0522, longitude: -118.2437 };
    
    const waypoints = generateWaypoints(start, end, 1);
    
    expect(waypoints).toHaveLength(2);
    expect(waypoints[0]).toEqual(start);
    expect(waypoints[1]).toEqual(end);
  });

  it('should generate waypoints in correct order', () => {
    const start = { latitude: 0, longitude: 0 };
    const end = { latitude: 10, longitude: 0 };
    
    const waypoints = generateWaypoints(start, end, 3);
    
    expect(waypoints[0].latitude).toBe(0);
    expect(waypoints[1].latitude).toBeCloseTo(5, 1);
    expect(waypoints[2].latitude).toBe(10);
  });
});

describe('isWithinBounds', () => {
  it('should return true for coordinate within bounds', () => {
    const coord = { latitude: 40.7128, longitude: -74.0060 };
    const bounds = { north: 50, south: 30, east: -70, west: -80 };
    
    const result = isWithinBounds(coord, bounds);
    expect(result).toBe(true);
  });

  it('should return false for coordinate outside bounds', () => {
    const coord = { latitude: 60, longitude: -74.0060 };
    const bounds = { north: 50, south: 30, east: -70, west: -80 };
    
    const result = isWithinBounds(coord, bounds);
    expect(result).toBe(false);
  });

  it('should return true for coordinate on boundary', () => {
    const coord = { latitude: 50, longitude: -70 };
    const bounds = { north: 50, south: 30, east: -70, west: -80 };
    
    const result = isWithinBounds(coord, bounds);
    expect(result).toBe(true);
  });
});

describe('normalizeLongitude', () => {
  it('should normalize longitude within -180 to 180', () => {
    expect(normalizeLongitude(190)).toBe(-170);
    expect(normalizeLongitude(-190)).toBe(170);
    expect(normalizeLongitude(370)).toBe(10);
    expect(normalizeLongitude(-370)).toBe(-10);
  });

  it('should not change longitude already in range', () => {
    expect(normalizeLongitude(0)).toBe(0);
    expect(normalizeLongitude(180)).toBe(180);
    expect(normalizeLongitude(-180)).toBe(-180);
    expect(normalizeLongitude(90)).toBe(90);
  });
});

describe('normalizeLatitude', () => {
  it('should clamp latitude to -90 to 90 range', () => {
    expect(normalizeLatitude(100)).toBe(90);
    expect(normalizeLatitude(-100)).toBe(-90);
    expect(normalizeLatitude(95)).toBe(90);
    expect(normalizeLatitude(-95)).toBe(-90);
  });

  it('should not change latitude already in range', () => {
    expect(normalizeLatitude(0)).toBe(0);
    expect(normalizeLatitude(90)).toBe(90);
    expect(normalizeLatitude(-90)).toBe(-90);
    expect(normalizeLatitude(45)).toBe(45);
  });
});