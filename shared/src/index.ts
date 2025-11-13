// Location types
export type { Location, Waypoint } from './types/location.js';

// Travel types
export { TravelMode } from './types/travel.js';
export type { TravelConfig } from './types/travel.js';

// Route types
export type { Route, RouteSegment } from './types/route.js';

// Weather types
export { WeatherCondition, PrecipitationType } from './types/weather.js';
export type { WeatherForecast } from './types/weather.js';

// API types
export type { ErrorResponse, ApiResponse } from './types/api.js';

// Validation utilities
export type { ValidationResult } from './utils/validation.js';
export {
  validateLocation,
  validateCoordinates,
  validateTravelConfig,
  validateLocationString
} from './utils/validation.js';

// Coordinate utilities
export type { Coordinates } from './utils/coordinates.js';
export {
  calculateDistance,
  calculateBearing,
  calculateDestination,
  calculateMidpoint,
  generateWaypoints,
  isWithinBounds,
  normalizeLongitude,
  normalizeLatitude
} from './utils/coordinates.js';

// Sanitization utilities
export {
  sanitizeLocationString,
  sanitizeCoordinates,
  sanitizeDuration,
  sanitizeSpeed,
  sanitizeString,
  sanitizeObject
} from './utils/sanitization.js';

// Error formatting utilities
export { ErrorCode } from './utils/errorFormatting.js';
export {
  createErrorResponse,
  createValidationErrorResponse,
  createLocationErrorResponse,
  createCoordinateErrorResponse,
  createTravelConfigErrorResponse,
  createExternalServiceErrorResponse,
  createNetworkErrorResponse,
  createRateLimitErrorResponse,
  formatValidationErrors,
  isRetryableError,
  getRetryDelay
} from './utils/errorFormatting.js';

// Enhanced validation utilities
export type { EnhancedValidationResult } from './utils/enhancedValidation.js';
export {
  validateAndSanitizeLocationString,
  validateAndSanitizeCoordinates,
  validateAndSanitizeDuration,
  validateAndSanitizeSpeed,
  validateTravelMode,
  validateCompleteLocation
} from './utils/enhancedValidation.js';