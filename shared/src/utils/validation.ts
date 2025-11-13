import { Location, Waypoint } from '../types/location.js';
import { TravelMode, TravelConfig } from '../types/travel.js';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates location input
 */
export function validateLocation(location: Partial<Location>): ValidationResult {
  const errors: string[] = [];

  if (!location.name || typeof location.name !== 'string' || location.name.trim().length === 0) {
    errors.push('Location name is required and must be a non-empty string');
  }

  if (!location.coordinates) {
    errors.push('Location coordinates are required');
  } else {
    const coordValidation = validateCoordinates(location.coordinates.latitude, location.coordinates.longitude);
    if (!coordValidation.isValid) {
      errors.push(...coordValidation.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates coordinate values
 */
export function validateCoordinates(latitude: number, longitude: number): ValidationResult {
  const errors: string[] = [];

  if (typeof latitude !== 'number' || isNaN(latitude)) {
    errors.push('Latitude must be a valid number');
  } else if (latitude < -90 || latitude > 90) {
    errors.push('Latitude must be between -90 and 90 degrees');
  }

  if (typeof longitude !== 'number' || isNaN(longitude)) {
    errors.push('Longitude must be a valid number');
  } else if (longitude < -180 || longitude > 180) {
    errors.push('Longitude must be between -180 and 180 degrees');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates travel parameters
 */
export function validateTravelConfig(config: Partial<TravelConfig>): ValidationResult {
  const errors: string[] = [];

  if (!config.mode || !Object.values(TravelMode).includes(config.mode)) {
    errors.push('Valid travel mode is required');
  }

  if (config.customDuration !== undefined) {
    if (typeof config.customDuration !== 'number' || config.customDuration <= 0) {
      errors.push('Custom duration must be a positive number (in hours)');
    }
  }

  if (config.customSpeed !== undefined) {
    if (typeof config.customSpeed !== 'number' || config.customSpeed <= 0) {
      errors.push('Custom speed must be a positive number');
    }
  }

  if (config.preferences) {
    if (config.preferences.weatherUpdateInterval !== undefined) {
      if (typeof config.preferences.weatherUpdateInterval !== 'number' || config.preferences.weatherUpdateInterval <= 0) {
        errors.push('Weather update interval must be a positive number (in minutes)');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates location string input (for user input)
 */
export function validateLocationString(locationString: string): ValidationResult {
  const errors: string[] = [];

  if (!locationString || typeof locationString !== 'string') {
    errors.push('Location must be a non-empty string');
    return { isValid: false, errors };
  }

  const trimmed = locationString.trim();
  if (trimmed.length === 0) {
    errors.push('Location cannot be empty');
  } else if (trimmed.length < 2) {
    errors.push('Location must be at least 2 characters long');
  } else if (trimmed.length > 200) {
    errors.push('Location must be less than 200 characters');
  }

  // Check for potentially malicious input
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      errors.push('Location contains invalid characters');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}