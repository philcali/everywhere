import { ErrorResponse } from '../types/api.js';

/**
 * Error codes for different types of validation errors
 */
export enum ErrorCode {
  INVALID_LOCATION = 'INVALID_LOCATION',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  INVALID_TRAVEL_CONFIG = 'INVALID_TRAVEL_CONFIG',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  MALFORMED_DATA = 'MALFORMED_DATA',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any,
  suggestions?: string[]
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
      suggestions
    },
    timestamp: new Date(),
    requestId: generateRequestId()
  };
}

/**
 * Creates an error response for validation failures
 */
export function createValidationErrorResponse(
  field: string,
  errors: string[],
  suggestions?: string[]
): ErrorResponse {
  return createErrorResponse(
    ErrorCode.INVALID_INPUT,
    `Validation failed for field: ${field}`,
    { field, validationErrors: errors },
    suggestions || getDefaultSuggestions(field, errors)
  );
}

/**
 * Creates an error response for location validation failures
 */
export function createLocationErrorResponse(
  locationInput: string,
  errors: string[]
): ErrorResponse {
  const suggestions = [
    'Try using a more specific location (e.g., "New York, NY" instead of "NY")',
    'Include city and state/country for better results',
    'Check spelling and try common location formats',
    'Use landmarks or well-known addresses if the location is not recognized'
  ];

  return createErrorResponse(
    ErrorCode.INVALID_LOCATION,
    'Location validation failed',
    { input: locationInput, validationErrors: errors },
    suggestions
  );
}

/**
 * Creates an error response for coordinate validation failures
 */
export function createCoordinateErrorResponse(
  latitude: any,
  longitude: any,
  errors: string[]
): ErrorResponse {
  const suggestions = [
    'Latitude must be between -90 and 90 degrees',
    'Longitude must be between -180 and 180 degrees',
    'Use decimal degrees format (e.g., 40.7128, -74.0060)',
    'Ensure coordinates are valid numbers'
  ];

  return createErrorResponse(
    ErrorCode.INVALID_COORDINATES,
    'Coordinate validation failed',
    { latitude, longitude, validationErrors: errors },
    suggestions
  );
}

/**
 * Creates an error response for travel configuration validation failures
 */
export function createTravelConfigErrorResponse(
  config: any,
  errors: string[]
): ErrorResponse {
  const suggestions = [
    'Select a valid travel mode (driving, walking, cycling, flying, sailing, cruise)',
    'Duration should be a positive number in hours',
    'Speed should be a positive number in km/h or mph',
    'Weather update interval should be a positive number in minutes'
  ];

  return createErrorResponse(
    ErrorCode.INVALID_TRAVEL_CONFIG,
    'Travel configuration validation failed',
    { config, validationErrors: errors },
    suggestions
  );
}

/**
 * Creates an error response for external service failures
 */
export function createExternalServiceErrorResponse(
  service: string,
  originalError?: any
): ErrorResponse {
  const suggestions = [
    'Please try again in a few moments',
    'Check your internet connection',
    'If the problem persists, try using different input parameters'
  ];

  return createErrorResponse(
    ErrorCode.EXTERNAL_SERVICE_ERROR,
    `External service error: ${service}`,
    { service, originalError: originalError?.message || originalError },
    suggestions
  );
}

/**
 * Creates an error response for network failures
 */
export function createNetworkErrorResponse(originalError?: any): ErrorResponse {
  const suggestions = [
    'Check your internet connection',
    'Try refreshing the page',
    'If using a VPN, try disconnecting and reconnecting'
  ];

  return createErrorResponse(
    ErrorCode.NETWORK_ERROR,
    'Network connection error',
    { originalError: originalError?.message || originalError },
    suggestions
  );
}

/**
 * Creates an error response for rate limiting
 */
export function createRateLimitErrorResponse(retryAfter?: number): ErrorResponse {
  const suggestions = [
    'Please wait before making another request',
    'Consider reducing the frequency of your requests',
    retryAfter ? `Try again after ${retryAfter} seconds` : 'Try again in a few minutes'
  ];

  return createErrorResponse(
    ErrorCode.RATE_LIMIT_EXCEEDED,
    'Rate limit exceeded',
    { retryAfter },
    suggestions
  );
}

/**
 * Generates a unique request ID for error tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Provides default suggestions based on field and error types
 */
function getDefaultSuggestions(field: string, errors: string[]): string[] {
  const suggestions: string[] = [];

  if (field.toLowerCase().includes('location')) {
    suggestions.push('Use a specific location format like "City, State" or "City, Country"');
  }

  if (field.toLowerCase().includes('coordinate')) {
    suggestions.push('Ensure coordinates are in decimal degrees format');
  }

  if (field.toLowerCase().includes('duration')) {
    suggestions.push('Duration should be a positive number in hours');
  }

  if (field.toLowerCase().includes('speed')) {
    suggestions.push('Speed should be a positive number');
  }

  if (errors.some(error => error.includes('required'))) {
    suggestions.push('This field is required and cannot be empty');
  }

  if (errors.some(error => error.includes('range') || error.includes('between'))) {
    suggestions.push('Please ensure the value is within the acceptable range');
  }

  return suggestions.length > 0 ? suggestions : ['Please check your input and try again'];
}

/**
 * Formats multiple validation errors into a user-friendly message
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) {
    return 'Validation passed';
  }

  if (errors.length === 1) {
    return errors[0];
  }

  return `Multiple validation errors: ${errors.join('; ')}`;
}

/**
 * Checks if an error response indicates a retryable error
 */
export function isRetryableError(errorResponse: ErrorResponse): boolean {
  const retryableCodes = [
    ErrorCode.EXTERNAL_SERVICE_ERROR,
    ErrorCode.NETWORK_ERROR,
    ErrorCode.RATE_LIMIT_EXCEEDED
  ];

  return retryableCodes.includes(errorResponse.error.code as ErrorCode);
}

/**
 * Gets retry delay in milliseconds for retryable errors
 */
export function getRetryDelay(errorResponse: ErrorResponse, attempt: number = 1): number {
  if (errorResponse.error.code === ErrorCode.RATE_LIMIT_EXCEEDED) {
    const retryAfter = errorResponse.error.details?.retryAfter;
    return retryAfter ? retryAfter * 1000 : 60000; // Default to 1 minute
  }

  // Exponential backoff for other retryable errors
  return Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
}