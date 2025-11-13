import { Location, Waypoint } from './location.js';
import { TravelMode } from './travel.js';

export interface RouteSegment {
  startPoint: Waypoint;
  endPoint: Waypoint;
  distance: number;
  estimatedDuration: number;
  travelMode: TravelMode;
}

export interface Route {
  id: string;
  source: Location;
  destination: Location;
  travelMode: TravelMode;
  waypoints: Waypoint[];
  totalDistance: number;
  estimatedDuration: number;
  segments: RouteSegment[];
}