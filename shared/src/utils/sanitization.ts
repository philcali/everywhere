/**
 * Sanitization utilities for user inputs
 */

/**
 * Sanitizes a location string by removing potentially harmful content
 * and normalizing the input
 */
export function sanitizeLocationString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove leading/trailing whitespace
  let sanitized = input.trim();

  // Remove HTML tags and their content
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove script-related content
  sanitized = sanitized.replace(/javascript:[^;\s]*/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*"[^"]*"/gi, '');

  // Remove null bytes and other control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Normalize multiple spaces to single space
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Limit length to prevent extremely long inputs
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }

  return sanitized;
}

/**
 * Sanitizes coordinate values by ensuring they are valid numbers
 * and within acceptable ranges
 */
export function sanitizeCoordinates(latitude: any, longitude: any): { latitude: number; longitude: number } | null {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  // Check if parsing resulted in valid numbers
  if (isNaN(lat) || isNaN(lon)) {
    return null;
  }

  // Clamp values to valid ranges
  const sanitizedLat = Math.max(-90, Math.min(90, lat));
  const sanitizedLon = ((lon + 180) % 360) - 180; // Normalize to -180 to 180

  return {
    latitude: sanitizedLat,
    longitude: sanitizedLon
  };
}

/**
 * Sanitizes travel duration input
 */
export function sanitizeDuration(duration: any): number | null {
  const parsed = parseFloat(duration);
  
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }

  // Limit to reasonable maximum (30 days)
  return Math.min(parsed, 720);
}

/**
 * Sanitizes travel speed input
 */
export function sanitizeSpeed(speed: any): number | null {
  const parsed = parseFloat(speed);
  
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }

  // Limit to reasonable maximum (1000 km/h for aircraft)
  return Math.min(parsed, 1000);
}

/**
 * Sanitizes general string input by removing potentially harmful content
 */
export function sanitizeString(input: string, maxLength: number = 100): string {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Remove HTML tags and their content
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove script-related content
  sanitized = sanitized.replace(/javascript:[^;\s]*/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*"[^"]*"/gi, '');

  // Remove null bytes and other control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitizes object properties recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T, maxStringLength: number = 100): T {
  const sanitized = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeString(value, maxStringLength) as T[keyof T];
    } else if (typeof value === 'number') {
      // Ensure number is finite
      sanitized[key as keyof T] = (isFinite(value) ? value : 0) as T[keyof T];
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key as keyof T] = sanitizeObject(value, maxStringLength) as T[keyof T];
    } else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item, maxStringLength) :
        typeof item === 'object' && item !== null ? sanitizeObject(item, maxStringLength) :
        item
      ) as T[keyof T];
    } else {
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}