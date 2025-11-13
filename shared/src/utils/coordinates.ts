/**
 * Earth's radius in kilometers
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Coordinate interface for calculations
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculates the distance between two coordinates using the Haversine formula
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Distance in kilometers
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLatRad = toRadians(coord2.latitude - coord1.latitude);
  const deltaLonRad = toRadians(coord2.longitude - coord1.longitude);

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates the bearing (direction) from one coordinate to another
 * @param coord1 Starting coordinate
 * @param coord2 Ending coordinate
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(coord1: Coordinates, coord2: Coordinates): number {
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLonRad = toRadians(coord2.longitude - coord1.longitude);

  const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);

  const bearingRad = Math.atan2(y, x);
  const bearingDeg = toDegrees(bearingRad);

  return (bearingDeg + 360) % 360;
}

/**
 * Calculates a coordinate at a given distance and bearing from a starting point
 * @param startCoord Starting coordinate
 * @param distance Distance in kilometers
 * @param bearing Bearing in degrees
 * @returns New coordinate
 */
export function calculateDestination(startCoord: Coordinates, distance: number, bearing: number): Coordinates {
  const lat1Rad = toRadians(startCoord.latitude);
  const lon1Rad = toRadians(startCoord.longitude);
  const bearingRad = toRadians(bearing);
  const angularDistance = distance / EARTH_RADIUS_KM;

  const lat2Rad = Math.asin(
    Math.sin(lat1Rad) * Math.cos(angularDistance) +
    Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const lon2Rad = lon1Rad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
    Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
  );

  return {
    latitude: toDegrees(lat2Rad),
    longitude: toDegrees(lon2Rad)
  };
}

/**
 * Calculates the midpoint between two coordinates
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Midpoint coordinate
 */
export function calculateMidpoint(coord1: Coordinates, coord2: Coordinates): Coordinates {
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLonRad = toRadians(coord2.longitude - coord1.longitude);

  const bx = Math.cos(lat2Rad) * Math.cos(deltaLonRad);
  const by = Math.cos(lat2Rad) * Math.sin(deltaLonRad);

  const lat3Rad = Math.atan2(
    Math.sin(lat1Rad) + Math.sin(lat2Rad),
    Math.sqrt((Math.cos(lat1Rad) + bx) * (Math.cos(lat1Rad) + bx) + by * by)
  );

  const lon3Rad = toRadians(coord1.longitude) + Math.atan2(by, Math.cos(lat1Rad) + bx);

  return {
    latitude: toDegrees(lat3Rad),
    longitude: toDegrees(lon3Rad)
  };
}

/**
 * Generates intermediate waypoints along a great circle path
 * @param startCoord Starting coordinate
 * @param endCoord Ending coordinate
 * @param numberOfPoints Number of intermediate points to generate
 * @returns Array of coordinates including start and end points
 */
export function generateWaypoints(startCoord: Coordinates, endCoord: Coordinates, numberOfPoints: number): Coordinates[] {
  if (numberOfPoints < 2) {
    return [startCoord, endCoord];
  }

  const waypoints: Coordinates[] = [startCoord];
  const totalDistance = calculateDistance(startCoord, endCoord);
  const bearing = calculateBearing(startCoord, endCoord);

  for (let i = 1; i < numberOfPoints - 1; i++) {
    const distance = (totalDistance * i) / (numberOfPoints - 1);
    const waypoint = calculateDestination(startCoord, distance, bearing);
    waypoints.push(waypoint);
  }

  waypoints.push(endCoord);
  return waypoints;
}

/**
 * Checks if a coordinate is within a bounding box
 * @param coord Coordinate to check
 * @param bounds Bounding box with north, south, east, west boundaries
 * @returns True if coordinate is within bounds
 */
export function isWithinBounds(
  coord: Coordinates,
  bounds: { north: number; south: number; east: number; west: number }
): boolean {
  return (
    coord.latitude >= bounds.south &&
    coord.latitude <= bounds.north &&
    coord.longitude >= bounds.west &&
    coord.longitude <= bounds.east
  );
}

/**
 * Normalizes longitude to be within -180 to 180 range
 * @param longitude Longitude value
 * @returns Normalized longitude
 */
export function normalizeLongitude(longitude: number): number {
  while (longitude > 180) longitude -= 360;
  while (longitude < -180) longitude += 360;
  return longitude;
}

/**
 * Normalizes latitude to be within -90 to 90 range
 * @param latitude Latitude value
 * @returns Normalized latitude
 */
export function normalizeLatitude(latitude: number): number {
  return Math.max(-90, Math.min(90, latitude));
}