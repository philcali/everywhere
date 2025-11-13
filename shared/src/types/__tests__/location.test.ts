import { describe, it, expect } from 'vitest'
import type { Location, Waypoint } from '../location.js'

describe('Location Types', () => {
  it('should create a valid Location object', () => {
    const location: Location = {
      name: 'New York City',
      coordinates: {
        latitude: 40.7128,
        longitude: -74.0060
      },
      address: '123 Main St, New York, NY'
    }

    expect(location.name).toBe('New York City')
    expect(location.coordinates.latitude).toBe(40.7128)
    expect(location.coordinates.longitude).toBe(-74.0060)
    expect(location.address).toBe('123 Main St, New York, NY')
  })

  it('should create a valid Waypoint object', () => {
    const waypoint: Waypoint = {
      coordinates: {
        latitude: 40.7128,
        longitude: -74.0060
      },
      distanceFromStart: 100.5,
      estimatedTimeFromStart: 3600
    }

    expect(waypoint.coordinates.latitude).toBe(40.7128)
    expect(waypoint.coordinates.longitude).toBe(-74.0060)
    expect(waypoint.distanceFromStart).toBe(100.5)
    expect(waypoint.estimatedTimeFromStart).toBe(3600)
  })
})