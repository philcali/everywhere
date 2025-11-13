import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
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
} from '../errorFormatting.js';

describe('createErrorResponse', () => {
  it('should create a basic error response', () => {
    const response = createErrorResponse(
      ErrorCode.INVALID_INPUT,
      'Test error message'
    );

    expect(response.error.code).toBe(ErrorCode.INVALID_INPUT);
    expect(response.error.message).toBe('Test error message');
    expect(response.timestamp).toBeInstanceOf(Date);
    expect(response.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
  });

  it('should include details and suggestions', () => {
    const details = { field: 'test' };
    const suggestions = ['Try this', 'Or that'];

    const response = createErrorResponse(
      ErrorCode.INVALID_INPUT,
      'Test error',
      details,
      suggestions
    );

    expect(response.error.details).toEqual(details);
    expect(response.error.suggestions).toEqual(suggestions);
  });
});

describe('createValidationErrorResponse', () => {
  it('should create validation error response', () => {
    const errors = ['Field is required', 'Field must be valid'];
    const response = createValidationErrorResponse('testField', errors);

    expect(response.error.code).toBe(ErrorCode.INVALID_INPUT);
    expect(response.error.message).toBe('Validation failed for field: testField');
    expect(response.error.details.field).toBe('testField');
    expect(response.error.details.validationErrors).toEqual(errors);
    expect(response.error.suggestions).toBeDefined();
  });
});

describe('createLocationErrorResponse', () => {
  it('should create location error response', () => {
    const errors = ['Invalid location format'];
    const response = createLocationErrorResponse('invalid location', errors);

    expect(response.error.code).toBe(ErrorCode.INVALID_LOCATION);
    expect(response.error.message).toBe('Location validation failed');
    expect(response.error.details.input).toBe('invalid location');
    expect(response.error.details.validationErrors).toEqual(errors);
    expect(response.error.suggestions).toContain('Try using a more specific location (e.g., "New York, NY" instead of "NY")');
  });
});

describe('createCoordinateErrorResponse', () => {
  it('should create coordinate error response', () => {
    const errors = ['Invalid latitude'];
    const response = createCoordinateErrorResponse(100, -200, errors);

    expect(response.error.code).toBe(ErrorCode.INVALID_COORDINATES);
    expect(response.error.message).toBe('Coordinate validation failed');
    expect(response.error.details.latitude).toBe(100);
    expect(response.error.details.longitude).toBe(-200);
    expect(response.error.suggestions).toContain('Latitude must be between -90 and 90 degrees');
  });
});

describe('createTravelConfigErrorResponse', () => {
  it('should create travel config error response', () => {
    const config = { mode: 'invalid' };
    const errors = ['Invalid travel mode'];
    const response = createTravelConfigErrorResponse(config, errors);

    expect(response.error.code).toBe(ErrorCode.INVALID_TRAVEL_CONFIG);
    expect(response.error.message).toBe('Travel configuration validation failed');
    expect(response.error.details.config).toEqual(config);
    expect(response.error.suggestions).toContain('Select a valid travel mode (driving, walking, cycling, flying, sailing, cruise)');
  });
});

describe('createExternalServiceErrorResponse', () => {
  it('should create external service error response', () => {
    const response = createExternalServiceErrorResponse('geocoding');

    expect(response.error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
    expect(response.error.message).toBe('External service error: geocoding');
    expect(response.error.details.service).toBe('geocoding');
    expect(response.error.suggestions).toContain('Please try again in a few moments');
  });
});

describe('createNetworkErrorResponse', () => {
  it('should create network error response', () => {
    const response = createNetworkErrorResponse();

    expect(response.error.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(response.error.message).toBe('Network connection error');
    expect(response.error.suggestions).toContain('Check your internet connection');
  });
});

describe('createRateLimitErrorResponse', () => {
  it('should create rate limit error response', () => {
    const response = createRateLimitErrorResponse(60);

    expect(response.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(response.error.message).toBe('Rate limit exceeded');
    expect(response.error.details.retryAfter).toBe(60);
    expect(response.error.suggestions).toContain('Try again after 60 seconds');
  });

  it('should create rate limit error response without retry time', () => {
    const response = createRateLimitErrorResponse();

    expect(response.error.suggestions).toContain('Try again in a few minutes');
  });
});

describe('formatValidationErrors', () => {
  it('should format single error', () => {
    const result = formatValidationErrors(['Single error']);
    expect(result).toBe('Single error');
  });

  it('should format multiple errors', () => {
    const errors = ['Error 1', 'Error 2', 'Error 3'];
    const result = formatValidationErrors(errors);
    expect(result).toBe('Multiple validation errors: Error 1; Error 2; Error 3');
  });

  it('should handle empty errors array', () => {
    const result = formatValidationErrors([]);
    expect(result).toBe('Validation passed');
  });
});

describe('isRetryableError', () => {
  it('should identify retryable errors', () => {
    const retryableErrors = [
      createExternalServiceErrorResponse('test'),
      createNetworkErrorResponse(),
      createRateLimitErrorResponse()
    ];

    retryableErrors.forEach(error => {
      expect(isRetryableError(error)).toBe(true);
    });
  });

  it('should identify non-retryable errors', () => {
    const nonRetryableErrors = [
      createValidationErrorResponse('test', ['error']),
      createLocationErrorResponse('test', ['error'])
    ];

    nonRetryableErrors.forEach(error => {
      expect(isRetryableError(error)).toBe(false);
    });
  });
});

describe('getRetryDelay', () => {
  it('should return specific delay for rate limit errors', () => {
    const error = createRateLimitErrorResponse(30);
    const delay = getRetryDelay(error);
    expect(delay).toBe(30000); // 30 seconds in milliseconds
  });

  it('should return exponential backoff for other errors', () => {
    const error = createNetworkErrorResponse();
    
    expect(getRetryDelay(error, 1)).toBe(1000); // 1 second
    expect(getRetryDelay(error, 2)).toBe(2000); // 2 seconds
    expect(getRetryDelay(error, 3)).toBe(4000); // 4 seconds
  });

  it('should cap retry delay at maximum', () => {
    const error = createNetworkErrorResponse();
    const delay = getRetryDelay(error, 10);
    expect(delay).toBe(30000); // Capped at 30 seconds
  });
});