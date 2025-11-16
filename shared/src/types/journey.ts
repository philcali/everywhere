import { Route } from './route.js';
import { WeatherForecast } from './weather.js';
import { TravelConfig } from './travel.js';

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
  travelMode?: string;
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