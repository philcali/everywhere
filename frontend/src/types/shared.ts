// Shared types for the travel weather plotter application

export enum TravelMode {
  DRIVING = 'driving',
  WALKING = 'walking',
  CYCLING = 'cycling',
  FLYING = 'flying',
  SAILING = 'sailing',
  CRUISE = 'cruise'
}

export interface TravelConfig {
  mode: TravelMode;
  customDuration?: number;
  customSpeed?: number;
  preferences: {
    weatherUpdateInterval: number;
    routeOptimization: boolean;
  };
}

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

export enum WeatherCondition {
  SUNNY = 'sunny',
  CLOUDY = 'cloudy',
  OVERCAST = 'overcast',
  RAINY = 'rainy',
  STORMY = 'stormy',
  FOGGY = 'foggy',
  SNOWY = 'snowy'
}

export enum PrecipitationType {
  NONE = 'none',
  RAIN = 'rain',
  SLEET = 'sleet',
  SNOW = 'snow',
  HAIL = 'hail'
}

export interface WeatherForecast {
  location: Location;
  timestamp: Date;
  temperature: {
    current: number;
    feelsLike: number;
    min: number;
    max: number;
  };
  conditions: {
    main: WeatherCondition;
    description: string;
    icon: string;
  };
  precipitation: {
    type: PrecipitationType;
    probability: number;
    intensity: number;
  };
  wind: {
    speed: number;
    direction: number;
  };
  humidity: number;
  visibility: number;
}

export interface SavedJourney {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: Date;
  route: Route;
  weatherData: WeatherForecast[];
  travelConfig: TravelConfig;
  metadata: {
    actualTravelDate?: Date;
    tags: string[];
    rating?: number;
    notes?: string;
  };
}

export interface JourneyQuery {
  userId: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  travelMode?: TravelMode;
  tags?: string[];
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface JourneyListResponse {
  journeys: SavedJourney[];
  total: number;
  hasMore: boolean;
}

export interface SaveJourneyRequest {
  name: string;
  description?: string;
  route: Route;
  weatherData: WeatherForecast[];
  travelConfig: TravelConfig;
  metadata: {
    actualTravelDate?: Date;
    tags: string[];
    rating?: number;
    notes?: string;
  };
}

export interface JourneyComparison {
  journeys: SavedJourney[];
  comparison: {
    routes: {
      totalDistances: number[];
      estimatedDurations: number[];
    };
    weather: {
      averageTemperatures: number[];
      precipitationDays: number[];
      weatherConditions: string[][];
    };
  };
}

export interface JourneyExportData {
  journey: SavedJourney;
  exportFormat: 'json' | 'csv' | 'pdf';
  includeWeatherData: boolean;
  includeRouteDetails: boolean;
}