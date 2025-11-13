import { ValidationResult } from './validation.js';
import { sanitizeLocationString, sanitizeCoordinates, sanitizeDuration, sanitizeSpeed } from './sanitization.js';
import { 
  createLocationErrorResponse, 
  createCoordinateErrorResponse, 
  createTravelConfigErrorResponse,
  createValidationErrorResponse 
} from './errorFormatting.js';
import { ErrorResponse } from '../types/api.js';
import { TravelMode } from '../types/travel.js';

/**
 * Enhanced validation result that includes sanitized data and formatted errors
 */
export interface EnhancedValidationResult<T = any> {
  isValid: boolean;
  sanitizedData?: T;
  errors: string[];
  errorResponse?: ErrorResponse;
}

/**
 * Validates and sanitizes location string input
 */
export function validateAndSanitizeLocationString(input: any): EnhancedValidationResult<string> {
  const errors: string[] = [];

  // Type check
  if (typeof input !== 'string') {
    errors.push('Location must be a string');
    return {
      isValid: false,
      errors,
      errorResponse: createLocationErrorResponse(String(input), errors)
    };
  }

  // Sanitize the input
  const sanitized = sanitizeLocationString(input);

  // Validate sanitized input
  if (sanitized.length === 0) {
    errors.push('Location cannot be empty after sanitization');
  } else if (sanitized.length < 2) {
    errors.push('Location must be at least 2 characters long');
  }

  // Check for common invalid patterns
  if (sanitized.match(/^\d+$/)) {
    errors.push('Location cannot be just numbers');
  }

  if (sanitized.match(/^[^a-zA-Z]*$/)) {
    errors.push('Location must contain at least one letter');
  }

  const result: EnhancedValidationResult<string> = {
    isValid: errors.length === 0,
    sanitizedData: sanitized,
    errors
  };

  if (!result.isValid) {
    result.errorResponse = createLocationErrorResponse(input, errors);
  }

  return result;
}

/**
 * Validates and sanitizes coordinate inputs
 */
export function validateAndSanitizeCoordinates(
  latitude: any, 
  longitude: any
): EnhancedValidationResult<{ latitude: number; longitude: number }> {
  const errors: string[] = [];

  // Sanitize coordinates
  const sanitized = sanitizeCoordinates(latitude, longitude);

  if (!sanitized) {
    errors.push('Invalid coordinate format - must be valid numbers');
    return {
      isValid: false,
      errors,
      errorResponse: createCoordinateErrorResponse(latitude, longitude, errors)
    };
  }

  // Additional validation - check original values before sanitization
  const originalLat = parseFloat(latitude);
  const originalLon = parseFloat(longitude);
  
  if (!isNaN(originalLat) && (originalLat < -90 || originalLat > 90)) {
    errors.push('Latitude must be between -90 and 90 degrees');
  }

  if (!isNaN(originalLon) && (originalLon < -180 || originalLon > 180)) {
    errors.push('Longitude must be between -180 and 180 degrees');
  }

  const result: EnhancedValidationResult<{ latitude: number; longitude: number }> = {
    isValid: errors.length === 0,
    sanitizedData: sanitized,
    errors
  };

  if (!result.isValid) {
    result.errorResponse = createCoordinateErrorResponse(latitude, longitude, errors);
  }

  return result;
}

/**
 * Validates and sanitizes travel duration
 */
export function validateAndSanitizeDuration(input: any): EnhancedValidationResult<number> {
  const errors: string[] = [];

  const sanitized = sanitizeDuration(input);

  if (sanitized === null) {
    errors.push('Duration must be a positive number');
    return {
      isValid: false,
      errors,
      errorResponse: createValidationErrorResponse('duration', errors)
    };
  }

  // Additional validation on original input
  const originalValue = parseFloat(input);
  if (!isNaN(originalValue)) {
    if (originalValue < 0.1) {
      errors.push('Duration must be at least 0.1 hours (6 minutes)');
    }

    if (originalValue > 720) {
      errors.push('Duration cannot exceed 720 hours (30 days)');
    }
  }

  const result: EnhancedValidationResult<number> = {
    isValid: errors.length === 0,
    sanitizedData: sanitized,
    errors
  };

  if (!result.isValid) {
    result.errorResponse = createValidationErrorResponse('duration', errors);
  }

  return result;
}

/**
 * Validates and sanitizes travel speed
 */
export function validateAndSanitizeSpeed(input: any, travelMode?: TravelMode): EnhancedValidationResult<number> {
  const errors: string[] = [];

  const sanitized = sanitizeSpeed(input);

  if (sanitized === null) {
    errors.push('Speed must be a positive number');
    return {
      isValid: false,
      errors,
      errorResponse: createValidationErrorResponse('speed', errors)
    };
  }

  // Mode-specific validation
  if (travelMode) {
    const speedLimits = getSpeedLimits(travelMode);
    if (sanitized < speedLimits.min) {
      errors.push(`Speed for ${travelMode} must be at least ${speedLimits.min} km/h`);
    }
    if (sanitized > speedLimits.max) {
      errors.push(`Speed for ${travelMode} cannot exceed ${speedLimits.max} km/h`);
    }
  }

  const result: EnhancedValidationResult<number> = {
    isValid: errors.length === 0,
    sanitizedData: sanitized,
    errors
  };

  if (!result.isValid) {
    result.errorResponse = createValidationErrorResponse('speed', errors);
  }

  return result;
}

/**
 * Validates travel mode
 */
export function validateTravelMode(input: any): EnhancedValidationResult<TravelMode> {
  const errors: string[] = [];

  if (typeof input !== 'string') {
    errors.push('Travel mode must be a string');
    return {
      isValid: false,
      errors,
      errorResponse: createValidationErrorResponse('travelMode', errors)
    };
  }

  const normalizedMode = input.toLowerCase().trim();
  const validModes = Object.values(TravelMode).map(mode => mode.toLowerCase());

  if (!validModes.includes(normalizedMode)) {
    errors.push(`Invalid travel mode. Valid options are: ${Object.values(TravelMode).join(', ')}`);
    return {
      isValid: false,
      errors,
      errorResponse: createValidationErrorResponse('travelMode', errors)
    };
  }

  // Find the correct enum value
  const travelMode = Object.values(TravelMode).find(mode => mode.toLowerCase() === normalizedMode);

  return {
    isValid: true,
    sanitizedData: travelMode!,
    errors: []
  };
}

/**
 * Validates a complete location object with coordinates
 */
export function validateCompleteLocation(input: any): EnhancedValidationResult<{
  name: string;
  coordinates: { latitude: number; longitude: number };
  address?: string;
}> {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    errors.push('Location must be an object');
    return {
      isValid: false,
      errors,
      errorResponse: createValidationErrorResponse('location', errors)
    };
  }

  // Validate name
  const nameValidation = validateAndSanitizeLocationString(input.name);
  if (!nameValidation.isValid) {
    errors.push(...nameValidation.errors);
  }

  // Validate coordinates
  let coordinatesValidation: EnhancedValidationResult<{ latitude: number; longitude: number }>;
  if (input.coordinates) {
    coordinatesValidation = validateAndSanitizeCoordinates(
      input.coordinates.latitude,
      input.coordinates.longitude
    );
    if (!coordinatesValidation.isValid) {
      errors.push(...coordinatesValidation.errors);
    }
  } else {
    errors.push('Coordinates are required');
    coordinatesValidation = { isValid: false, errors: ['Missing coordinates'] };
  }

  const result: EnhancedValidationResult<{
    name: string;
    coordinates: { latitude: number; longitude: number };
    address?: string;
  }> = {
    isValid: errors.length === 0,
    errors
  };

  if (result.isValid && nameValidation.sanitizedData && coordinatesValidation.sanitizedData) {
    result.sanitizedData = {
      name: nameValidation.sanitizedData,
      coordinates: coordinatesValidation.sanitizedData,
      address: input.address ? sanitizeLocationString(input.address) : undefined
    };
  }

  if (!result.isValid) {
    result.errorResponse = createValidationErrorResponse('location', errors);
  }

  return result;
}

/**
 * Gets speed limits for different travel modes
 */
function getSpeedLimits(mode: TravelMode): { min: number; max: number } {
  switch (mode) {
    case TravelMode.WALKING:
      return { min: 1, max: 10 }; // 1-10 km/h
    case TravelMode.CYCLING:
      return { min: 5, max: 50 }; // 5-50 km/h
    case TravelMode.DRIVING:
      return { min: 10, max: 200 }; // 10-200 km/h
    case TravelMode.FLYING:
      return { min: 200, max: 1000 }; // 200-1000 km/h
    case TravelMode.SAILING:
      return { min: 5, max: 100 }; // 5-100 km/h
    case TravelMode.CRUISE:
      return { min: 10, max: 60 }; // 10-60 km/h
    default:
      return { min: 1, max: 1000 };
  }
}