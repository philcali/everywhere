export interface Location {
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address?: string;
}

export interface Waypoint {
  coordinates: {
    latitude: number;
    longitude: number;
  };
  distanceFromStart: number;
  estimatedTimeFromStart: number;
}