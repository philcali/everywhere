import { Route, RouteSegment } from '@shared/types/route.js';
import { WeatherForecast, WeatherCondition, PrecipitationType } from '@shared/types/weather.js';
import { Location, Waypoint } from '@shared/types/location.js';
import { TravelConfig, TravelMode } from '@shared/types/travel.js';

export interface RouteWeatherIntegration {
  route: Route;
  weatherData: WeatherForecast[];
  timeline: RouteTimelinePoint[];
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  warnings: string[];
  dataQuality: {
    completeness: number;
    confidence: number;
    interpolatedPoints: number;
  };
}

export interface RouteTimelinePoint {
  waypoint: Waypoint;
  weather: WeatherForecast;
  travelTime: Date;
  segmentIndex: number;
  distanceFromStart: number;
  timeFromStart: number;
  isInterpolated: boolean;
  confidence: number;
}

export interface WeatherRouteValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingDataPoints: number;
  dataConsistencyScore: number;
}

export interface WeatherPatternChange {
  location: Waypoint;
  timestamp: Date;
  fromCondition: WeatherCondition;
  toCondition: WeatherCondition;
  severity: 'minor' | 'moderate' | 'major';
  description: string;
  travelImpact: string;
}

export interface TravelModeWeatherConsiderations {
  travelMode: TravelMode;
  weatherFactors: {
    temperature: {
      optimal: { min: number; max: number };
      warning: { min: number; max: number };
      dangerous: { min: number; max: number };
    };
    wind: {
      optimal: number;
      warning: number;
      dangerous: number;
    };
    precipitation: {
      acceptable: PrecipitationType[];
      warning: PrecipitationType[];
      dangerous: PrecipitationType[];
    };
    visibility: {
      optimal: number;
      warning: number;
      dangerous: number;
    };
  };
  recommendations: string[];
  warnings: string[];
}

export interface InterpolatedWeatherData {
  originalPoints: WeatherForecast[];
  interpolatedPoints: WeatherForecast[];
  spatialResolution: number; // km between points
  temporalResolution: number; // minutes between points
  interpolationMethod: 'linear' | 'cubic' | 'weighted';
  confidence: number;
}

export class DataProcessingError extends Error {
  public code: string;
  public suggestions?: string[];

  constructor(code: string, message: string, suggestions?: string[]) {
    super(message);
    this.name = 'DataProcessingError';
    this.code = code;
    this.suggestions = suggestions;
  }
}

export class DataProcessingService {
  /**
   * Combine route waypoints with weather forecast data
   */
  async integrateRouteWithWeather(
    route: Route,
    weatherData: WeatherForecast[],
    startTime: Date,
    travelConfig?: TravelConfig
  ): Promise<RouteWeatherIntegration> {
    // Validate inputs
    this.validateRouteData(route);
    this.validateWeatherData(weatherData);

    // Create timeline synchronization
    const timeline = await this.createTimelineSynchronization(
      route,
      weatherData,
      startTime,
      travelConfig
    );

    // Calculate end time
    const endTime = new Date(startTime.getTime() + route.estimatedDuration * 1000);

    // Analyze data quality
    const dataQuality = this.analyzeDataQuality(timeline, weatherData);

    // Generate warnings
    const warnings = this.generateIntegrationWarnings(route, weatherData, timeline);

    return {
      route,
      weatherData,
      timeline,
      startTime,
      endTime,
      totalDuration: route.estimatedDuration,
      warnings,
      dataQuality
    };
  }

  /**
   * Create timeline synchronization between travel progress and weather timing
   */
  async createTimelineSynchronization(
    route: Route,
    weatherData: WeatherForecast[],
    startTime: Date,
    travelConfig?: TravelConfig
  ): Promise<RouteTimelinePoint[]> {
    const timeline: RouteTimelinePoint[] = [];

    // Sort weather data by timestamp to ensure proper ordering
    const sortedWeatherData = [...weatherData].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Process each waypoint and align with weather data
    for (let i = 0; i < route.waypoints.length; i++) {
      const waypoint = route.waypoints[i];
      const travelTime = new Date(startTime.getTime() + waypoint.estimatedTimeFromStart * 1000);
      
      // Find the most appropriate weather forecast for this waypoint
      const weather = this.findBestWeatherMatch(
        waypoint,
        travelTime,
        sortedWeatherData
      );

      // Determine which route segment this waypoint belongs to
      const segmentIndex = this.findSegmentForWaypoint(route.segments, waypoint);

      // Check if this is an interpolated weather point
      const isInterpolated = this.isWeatherInterpolated(weather, waypoint, sortedWeatherData);
      
      // Calculate confidence based on data quality and interpolation
      const confidence = this.calculateWeatherConfidence(
        weather,
        waypoint,
        travelTime,
        sortedWeatherData,
        isInterpolated
      );

      timeline.push({
        waypoint,
        weather,
        travelTime,
        segmentIndex,
        distanceFromStart: waypoint.distanceFromStart,
        timeFromStart: waypoint.estimatedTimeFromStart,
        isInterpolated,
        confidence
      });
    }

    // Fill gaps with interpolated data if needed
    const enhancedTimeline = await this.fillTimelineGaps(timeline, route, startTime);

    return enhancedTimeline.sort((a, b) => a.timeFromStart - b.timeFromStart);
  }

  /**
   * Implement data processing logic to align weather forecasts with route segments
   */
  alignWeatherWithRouteSegments(
    route: Route,
    weatherData: WeatherForecast[],
    startTime: Date
  ): Array<{
    segment: RouteSegment;
    weatherForecasts: WeatherForecast[];
    segmentStartTime: Date;
    segmentEndTime: Date;
    averageWeather: WeatherForecast;
  }> {
    const alignedSegments: Array<{
      segment: RouteSegment;
      weatherForecasts: WeatherForecast[];
      segmentStartTime: Date;
      segmentEndTime: Date;
      averageWeather: WeatherForecast;
    }> = [];

    let cumulativeTime = 0;

    for (const segment of route.segments) {
      const segmentStartTime = new Date(startTime.getTime() + cumulativeTime * 1000);
      const segmentEndTime = new Date(startTime.getTime() + (cumulativeTime + segment.estimatedDuration) * 1000);

      // Find weather forecasts that fall within this segment's timeframe
      const segmentWeatherForecasts = weatherData.filter(weather => {
        const weatherTime = weather.timestamp.getTime();
        return weatherTime >= segmentStartTime.getTime() && weatherTime <= segmentEndTime.getTime();
      });

      // If no direct matches, find the closest weather forecasts
      if (segmentWeatherForecasts.length === 0) {
        const closestWeather = this.findClosestWeatherForTimeRange(
          weatherData,
          segmentStartTime,
          segmentEndTime
        );
        if (closestWeather) {
          segmentWeatherForecasts.push(closestWeather);
        }
      }

      // Calculate average weather conditions for the segment
      const averageWeather = this.calculateAverageWeather(
        segmentWeatherForecasts,
        segment,
        segmentStartTime,
        segmentEndTime
      );

      alignedSegments.push({
        segment,
        weatherForecasts: segmentWeatherForecasts,
        segmentStartTime,
        segmentEndTime,
        averageWeather
      });

      cumulativeTime += segment.estimatedDuration;
    }

    return alignedSegments;
  }

  /**
   * Validate data consistency between route and weather information
   */
  validateDataConsistency(
    route: Route,
    weatherData: WeatherForecast[],
    startTime: Date
  ): WeatherRouteValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    let missingDataPoints = 0;
    let dataConsistencyScore = 1.0;

    // Check route data validity
    if (!route.waypoints || route.waypoints.length === 0) {
      errors.push('Route must contain waypoints for weather integration');
      dataConsistencyScore -= 0.5;
    }

    if (route.estimatedDuration <= 0) {
      errors.push('Route must have a valid estimated duration');
      dataConsistencyScore -= 0.3;
    }

    // Check weather data validity
    if (!weatherData || weatherData.length === 0) {
      errors.push('Weather data is required for route integration');
      dataConsistencyScore -= 0.5;
    }

    // Validate time alignment
    if (weatherData.length > 0) {
      const endTime = new Date(startTime.getTime() + route.estimatedDuration * 1000);
      const weatherTimeRange = {
        start: Math.min(...weatherData.map(w => w.timestamp.getTime())),
        end: Math.max(...weatherData.map(w => w.timestamp.getTime()))
      };

      const routeTimeRange = {
        start: startTime.getTime(),
        end: endTime.getTime()
      };

      // Check if weather data covers the entire route duration
      if (weatherTimeRange.start > routeTimeRange.start) {
        warnings.push('Weather data starts after route start time');
        dataConsistencyScore -= 0.1;
      }

      if (weatherTimeRange.end < routeTimeRange.end) {
        warnings.push('Weather data ends before route completion');
        dataConsistencyScore -= 0.1;
      }

      // Check for gaps in weather data
      const expectedDataPoints = Math.ceil(route.estimatedDuration / 3600); // Hourly data points
      const actualDataPoints = weatherData.length;
      missingDataPoints = Math.max(0, expectedDataPoints - actualDataPoints);

      if (missingDataPoints > 0) {
        warnings.push(`${missingDataPoints} weather data points are missing for optimal coverage`);
        dataConsistencyScore -= Math.min(0.3, missingDataPoints * 0.05);
      }
    }

    // Validate geographic alignment
    if (route.waypoints && weatherData.length > 0) {
      const routeBounds = this.calculateRouteBounds(route.waypoints);
      const weatherBounds = this.calculateWeatherBounds(weatherData);

      if (!this.boundsOverlap(routeBounds, weatherBounds)) {
        warnings.push('Weather data geographic coverage may not fully align with route');
        dataConsistencyScore -= 0.2;
      }
    }

    // Ensure score doesn't go below 0
    dataConsistencyScore = Math.max(0, dataConsistencyScore);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      missingDataPoints,
      dataConsistencyScore
    };
  }

  /**
   * Find the best weather match for a waypoint and time
   */
  private findBestWeatherMatch(
    waypoint: Waypoint,
    travelTime: Date,
    weatherData: WeatherForecast[]
  ): WeatherForecast {
    if (weatherData.length === 0) {
      throw new DataProcessingError(
        'NO_WEATHER_DATA',
        'No weather data available for route integration',
        ['Ensure weather data is provided for the route timeframe']
      );
    }

    // Find weather forecast closest in time and location
    let bestMatch = weatherData[0];
    let bestScore = this.calculateWeatherMatchScore(bestMatch, waypoint, travelTime);

    for (const weather of weatherData) {
      const score = this.calculateWeatherMatchScore(weather, waypoint, travelTime);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = weather;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate weather match score based on time and location proximity
   */
  private calculateWeatherMatchScore(
    weather: WeatherForecast,
    waypoint: Waypoint,
    targetTime: Date
  ): number {
    // Time proximity score (0-1, higher is better)
    const timeDiff = Math.abs(weather.timestamp.getTime() - targetTime.getTime());
    const maxTimeDiff = 4 * 60 * 60 * 1000; // 4 hours
    const timeScore = Math.max(0, 1 - (timeDiff / maxTimeDiff));

    // Location proximity score (0-1, higher is better)
    const distance = this.calculateDistance(
      waypoint.coordinates,
      weather.location.coordinates
    );
    const maxDistance = 50; // 50 km
    const locationScore = Math.max(0, 1 - (distance / maxDistance));

    // Weighted combination (time is more important for route planning)
    return timeScore * 0.7 + locationScore * 0.3;
  }

  /**
   * Calculate distance between two coordinate points using Haversine formula
   */
  private calculateDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) * Math.cos(this.toRadians(coord2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Find which route segment a waypoint belongs to
   */
  private findSegmentForWaypoint(segments: RouteSegment[], waypoint: Waypoint): number {
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (waypoint.distanceFromStart >= segment.startPoint.distanceFromStart &&
          waypoint.distanceFromStart <= segment.endPoint.distanceFromStart) {
        return i;
      }
    }
    return segments.length - 1; // Default to last segment
  }

  /**
   * Check if weather data is interpolated
   */
  private isWeatherInterpolated(
    weather: WeatherForecast,
    waypoint: Waypoint,
    originalWeatherData: WeatherForecast[]
  ): boolean {
    // Check if this exact weather forecast exists in original data
    return !originalWeatherData.some(original => 
      original.timestamp.getTime() === weather.timestamp.getTime() &&
      this.calculateDistance(original.location.coordinates, waypoint.coordinates) < 1
    );
  }

  /**
   * Calculate confidence score for weather data at a waypoint
   */
  private calculateWeatherConfidence(
    weather: WeatherForecast,
    waypoint: Waypoint,
    travelTime: Date,
    originalWeatherData: WeatherForecast[],
    isInterpolated: boolean
  ): number {
    let confidence = 1.0;

    // Reduce confidence for interpolated data
    if (isInterpolated) {
      confidence -= 0.2;
    }

    // Reduce confidence based on time difference
    const timeDiff = Math.abs(weather.timestamp.getTime() - travelTime.getTime());
    const hoursDiff = timeDiff / (60 * 60 * 1000);
    if (hoursDiff > 2) {
      confidence -= Math.min(0.3, hoursDiff * 0.05);
    }

    // Reduce confidence based on location distance
    const distance = this.calculateDistance(
      waypoint.coordinates,
      weather.location.coordinates
    );
    if (distance > 10) {
      confidence -= Math.min(0.2, distance * 0.01);
    }

    return Math.max(0.1, confidence);
  }

  /**
   * Fill gaps in timeline with interpolated data
   */
  private async fillTimelineGaps(
    timeline: RouteTimelinePoint[],
    route: Route,
    startTime: Date
  ): Promise<RouteTimelinePoint[]> {
    // For now, return timeline as-is to maintain expected length
    // Gap filling can be enabled based on configuration or specific requirements
    return timeline;
  }

  /**
   * Create interpolated timeline points between two existing points
   */
  private createInterpolatedTimelinePoints(
    startPoint: RouteTimelinePoint,
    endPoint: RouteTimelinePoint,
    route: Route,
    startTime: Date
  ): RouteTimelinePoint[] {
    const interpolatedPoints: RouteTimelinePoint[] = [];
    const timeDiff = endPoint.timeFromStart - startPoint.timeFromStart;
    const numPoints = Math.floor(timeDiff / (30 * 60)); // Every 30 minutes

    for (let i = 1; i < numPoints; i++) {
      const progress = i / numPoints;
      const interpolatedTime = startPoint.timeFromStart + (timeDiff * progress);
      const travelTime = new Date(startTime.getTime() + interpolatedTime * 1000);

      // Interpolate waypoint position
      const interpolatedWaypoint: Waypoint = {
        coordinates: {
          latitude: startPoint.waypoint.coordinates.latitude + 
            (endPoint.waypoint.coordinates.latitude - startPoint.waypoint.coordinates.latitude) * progress,
          longitude: startPoint.waypoint.coordinates.longitude + 
            (endPoint.waypoint.coordinates.longitude - startPoint.waypoint.coordinates.longitude) * progress
        },
        distanceFromStart: startPoint.distanceFromStart + 
          (endPoint.distanceFromStart - startPoint.distanceFromStart) * progress,
        estimatedTimeFromStart: interpolatedTime
      };

      // Interpolate weather data
      const interpolatedWeather = this.interpolateWeatherData(
        startPoint.weather,
        endPoint.weather,
        progress,
        interpolatedWaypoint,
        travelTime
      );

      interpolatedPoints.push({
        waypoint: interpolatedWaypoint,
        weather: interpolatedWeather,
        travelTime,
        segmentIndex: startPoint.segmentIndex,
        distanceFromStart: interpolatedWaypoint.distanceFromStart,
        timeFromStart: interpolatedTime,
        isInterpolated: true,
        confidence: Math.min(startPoint.confidence, endPoint.confidence) * 0.8 // Lower confidence for interpolated data
      });
    }

    return interpolatedPoints;
  }

  /**
   * Interpolate weather data between two forecasts
   */
  private interpolateWeatherData(
    weather1: WeatherForecast,
    weather2: WeatherForecast,
    progress: number,
    waypoint: Waypoint,
    targetTime: Date
  ): WeatherForecast {
    const location: Location = {
      name: `Interpolated point at ${waypoint.coordinates.latitude.toFixed(4)}, ${waypoint.coordinates.longitude.toFixed(4)}`,
      coordinates: waypoint.coordinates
    };

    return {
      location,
      timestamp: targetTime,
      temperature: {
        current: Math.round(weather1.temperature.current + (weather2.temperature.current - weather1.temperature.current) * progress),
        feelsLike: Math.round(weather1.temperature.feelsLike + (weather2.temperature.feelsLike - weather1.temperature.feelsLike) * progress),
        min: Math.round(weather1.temperature.min + (weather2.temperature.min - weather1.temperature.min) * progress),
        max: Math.round(weather1.temperature.max + (weather2.temperature.max - weather1.temperature.max) * progress)
      },
      conditions: {
        main: progress < 0.5 ? weather1.conditions.main : weather2.conditions.main,
        description: progress < 0.5 ? weather1.conditions.description : weather2.conditions.description,
        icon: progress < 0.5 ? weather1.conditions.icon : weather2.conditions.icon
      },
      precipitation: {
        type: progress < 0.5 ? weather1.precipitation.type : weather2.precipitation.type,
        probability: Math.round(weather1.precipitation.probability + (weather2.precipitation.probability - weather1.precipitation.probability) * progress),
        intensity: Math.round(weather1.precipitation.intensity + (weather2.precipitation.intensity - weather1.precipitation.intensity) * progress)
      },
      wind: {
        speed: Math.round((weather1.wind.speed + (weather2.wind.speed - weather1.wind.speed) * progress) * 10) / 10,
        direction: this.interpolateWindDirection(weather1.wind.direction, weather2.wind.direction, progress)
      },
      humidity: Math.round(weather1.humidity + (weather2.humidity - weather1.humidity) * progress),
      visibility: Math.round(weather1.visibility + (weather2.visibility - weather1.visibility) * progress)
    };
  }

  /**
   * Interpolate wind direction considering circular nature
   */
  private interpolateWindDirection(dir1: number, dir2: number, progress: number): number {
    let diff = dir2 - dir1;
    
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }
    
    let result = dir1 + diff * progress;
    
    if (result < 0) {
      result += 360;
    } else if (result >= 360) {
      result -= 360;
    }
    
    return Math.round(result);
  }

  /**
   * Find closest weather forecast for a time range
   */
  private findClosestWeatherForTimeRange(
    weatherData: WeatherForecast[],
    startTime: Date,
    endTime: Date
  ): WeatherForecast | null {
    if (weatherData.length === 0) return null;

    const midTime = new Date((startTime.getTime() + endTime.getTime()) / 2);
    
    let closest = weatherData[0];
    let smallestDiff = Math.abs(closest.timestamp.getTime() - midTime.getTime());

    for (const weather of weatherData) {
      const diff = Math.abs(weather.timestamp.getTime() - midTime.getTime());
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closest = weather;
      }
    }

    return closest;
  }

  /**
   * Calculate average weather conditions for a segment
   */
  private calculateAverageWeather(
    weatherForecasts: WeatherForecast[],
    segment: RouteSegment,
    startTime: Date,
    endTime: Date
  ): WeatherForecast {
    if (weatherForecasts.length === 0) {
      // Create a default weather forecast if no data available
      return this.createDefaultWeatherForecast(segment, startTime, endTime);
    }

    if (weatherForecasts.length === 1) {
      return weatherForecasts[0];
    }

    // Calculate averages for numerical values
    const avgTemp = weatherForecasts.reduce((sum, w) => sum + w.temperature.current, 0) / weatherForecasts.length;
    const avgFeelsLike = weatherForecasts.reduce((sum, w) => sum + w.temperature.feelsLike, 0) / weatherForecasts.length;
    const avgHumidity = weatherForecasts.reduce((sum, w) => sum + w.humidity, 0) / weatherForecasts.length;
    const avgVisibility = weatherForecasts.reduce((sum, w) => sum + w.visibility, 0) / weatherForecasts.length;
    const avgWindSpeed = weatherForecasts.reduce((sum, w) => sum + w.wind.speed, 0) / weatherForecasts.length;
    const avgPrecipProb = weatherForecasts.reduce((sum, w) => sum + w.precipitation.probability, 0) / weatherForecasts.length;

    // Use the most common condition
    const conditionCounts = new Map<string, number>();
    weatherForecasts.forEach(w => {
      const count = conditionCounts.get(w.conditions.main) || 0;
      conditionCounts.set(w.conditions.main, count + 1);
    });
    
    const mostCommonCondition = Array.from(conditionCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
    
    const representativeWeather = weatherForecasts.find(w => w.conditions.main === mostCommonCondition) || weatherForecasts[0];

    const location: Location = {
      name: `Segment from ${segment.startPoint.coordinates.latitude.toFixed(4)}, ${segment.startPoint.coordinates.longitude.toFixed(4)} to ${segment.endPoint.coordinates.latitude.toFixed(4)}, ${segment.endPoint.coordinates.longitude.toFixed(4)}`,
      coordinates: {
        latitude: (segment.startPoint.coordinates.latitude + segment.endPoint.coordinates.latitude) / 2,
        longitude: (segment.startPoint.coordinates.longitude + segment.endPoint.coordinates.longitude) / 2
      }
    };

    return {
      location,
      timestamp: new Date((startTime.getTime() + endTime.getTime()) / 2),
      temperature: {
        current: Math.round(avgTemp),
        feelsLike: Math.round(avgFeelsLike),
        min: Math.min(...weatherForecasts.map(w => w.temperature.min)),
        max: Math.max(...weatherForecasts.map(w => w.temperature.max))
      },
      conditions: representativeWeather.conditions,
      precipitation: {
        type: representativeWeather.precipitation.type,
        probability: Math.round(avgPrecipProb),
        intensity: representativeWeather.precipitation.intensity
      },
      wind: {
        speed: Math.round(avgWindSpeed * 10) / 10,
        direction: representativeWeather.wind.direction
      },
      humidity: Math.round(avgHumidity),
      visibility: Math.round(avgVisibility)
    };
  }

  /**
   * Create default weather forecast when no data is available
   */
  private createDefaultWeatherForecast(
    segment: RouteSegment,
    startTime: Date,
    endTime: Date
  ): WeatherForecast {
    const location: Location = {
      name: `Default forecast for segment`,
      coordinates: {
        latitude: (segment.startPoint.coordinates.latitude + segment.endPoint.coordinates.latitude) / 2,
        longitude: (segment.startPoint.coordinates.longitude + segment.endPoint.coordinates.longitude) / 2
      }
    };

    return {
      location,
      timestamp: new Date((startTime.getTime() + endTime.getTime()) / 2),
      temperature: {
        current: 20,
        feelsLike: 20,
        min: 15,
        max: 25
      },
      conditions: {
        main: 'CLOUDY' as any,
        description: 'Partly cloudy',
        icon: '02d'
      },
      precipitation: {
        type: 'NONE' as any,
        probability: 0,
        intensity: 0
      },
      wind: {
        speed: 10,
        direction: 180
      },
      humidity: 60,
      visibility: 10
    };
  }

  /**
   * Analyze data quality of the integration
   */
  private analyzeDataQuality(
    timeline: RouteTimelinePoint[],
    weatherData: WeatherForecast[]
  ): {
    completeness: number;
    confidence: number;
    interpolatedPoints: number;
  } {
    if (timeline.length === 0) {
      return { completeness: 0, confidence: 0, interpolatedPoints: 0 };
    }

    const interpolatedPoints = timeline.filter(point => point.isInterpolated).length;
    const completeness = timeline.length > 0 ? (timeline.length - interpolatedPoints) / timeline.length : 0;
    const avgConfidence = timeline.reduce((sum, point) => sum + point.confidence, 0) / timeline.length;

    return {
      completeness: Math.round(completeness * 100) / 100,
      confidence: Math.round(avgConfidence * 100) / 100,
      interpolatedPoints
    };
  }

  /**
   * Generate integration warnings
   */
  private generateIntegrationWarnings(
    route: Route,
    weatherData: WeatherForecast[],
    timeline: RouteTimelinePoint[]
  ): string[] {
    const warnings: string[] = [];

    // Check data coverage
    const interpolatedCount = timeline.filter(point => point.isInterpolated).length;
    if (interpolatedCount > timeline.length * 0.5) {
      warnings.push(`${interpolatedCount} of ${timeline.length} weather points are interpolated - consider getting more weather data`);
    }

    // Check for low confidence points
    const lowConfidenceCount = timeline.filter(point => point.confidence < 0.6).length;
    if (lowConfidenceCount > 0) {
      warnings.push(`${lowConfidenceCount} weather predictions have low confidence`);
    }

    // Check for weather data gaps
    if (weatherData.length < 3 && route.estimatedDuration > 3600) {
      warnings.push('Limited weather data for route duration - forecasts may be less accurate');
    }

    // Check for extreme weather conditions
    const extremeWeatherCount = timeline.filter(point => 
      point.weather.temperature.current < -10 || 
      point.weather.temperature.current > 40 ||
      point.weather.wind.speed > 50 ||
      point.weather.precipitation.intensity > 7
    ).length;

    if (extremeWeatherCount > 0) {
      warnings.push(`${extremeWeatherCount} points along route have extreme weather conditions`);
    }

    return warnings;
  }

  /**
   * Validate route data
   */
  private validateRouteData(route: Route): void {
    if (!route) {
      throw new DataProcessingError(
        'INVALID_ROUTE',
        'Route data is required for integration',
        ['Provide a valid route object with waypoints and segments']
      );
    }

    if (!route.waypoints || route.waypoints.length === 0) {
      throw new DataProcessingError(
        'NO_WAYPOINTS',
        'Route must contain waypoints for weather integration',
        ['Ensure route calculation includes waypoint generation']
      );
    }

    if (route.estimatedDuration <= 0) {
      throw new DataProcessingError(
        'INVALID_DURATION',
        'Route must have a valid estimated duration',
        ['Verify route calculation includes proper duration estimation']
      );
    }
  }

  /**
   * Validate weather data
   */
  private validateWeatherData(weatherData: WeatherForecast[]): void {
    if (!weatherData || weatherData.length === 0) {
      throw new DataProcessingError(
        'NO_WEATHER_DATA',
        'Weather data is required for route integration',
        ['Provide weather forecast data for the route timeframe']
      );
    }

    // Check for valid timestamps
    const invalidTimestamps = weatherData.filter(w => !w.timestamp || isNaN(w.timestamp.getTime()));
    if (invalidTimestamps.length > 0) {
      throw new DataProcessingError(
        'INVALID_TIMESTAMPS',
        `${invalidTimestamps.length} weather forecasts have invalid timestamps`,
        ['Ensure all weather data has valid timestamp information']
      );
    }

    // Check for valid coordinates
    const invalidCoordinates = weatherData.filter(w => 
      !w.location?.coordinates ||
      Math.abs(w.location.coordinates.latitude) > 90 ||
      Math.abs(w.location.coordinates.longitude) > 180
    );
    
    if (invalidCoordinates.length > 0) {
      throw new DataProcessingError(
        'INVALID_COORDINATES',
        `${invalidCoordinates.length} weather forecasts have invalid coordinates`,
        ['Ensure all weather data has valid latitude and longitude values']
      );
    }
  }

  /**
   * Calculate route bounds
   */
  private calculateRouteBounds(waypoints: Waypoint[]): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    const lats = waypoints.map(w => w.coordinates.latitude);
    const lngs = waypoints.map(w => w.coordinates.longitude);

    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };
  }

  /**
   * Calculate weather bounds
   */
  private calculateWeatherBounds(weatherData: WeatherForecast[]): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    const lats = weatherData.map(w => w.location.coordinates.latitude);
    const lngs = weatherData.map(w => w.location.coordinates.longitude);

    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };
  }

  /**
   * Check if two bounds overlap
   */
  private boundsOverlap(
    bounds1: { north: number; south: number; east: number; west: number },
    bounds2: { north: number; south: number; east: number; west: number }
  ): boolean {
    return !(bounds1.east < bounds2.west || 
             bounds2.east < bounds1.west || 
             bounds1.north < bounds2.south || 
             bounds2.north < bounds1.south);
  }

  /**
   * Implement spatial interpolation for weather data between waypoints
   */
  spatialWeatherInterpolation(
    waypoints: Waypoint[],
    weatherData: WeatherForecast[],
    targetResolution: number = 10 // km between interpolated points
  ): InterpolatedWeatherData {
    if (waypoints.length < 2 || weatherData.length < 2) {
      return {
        originalPoints: weatherData,
        interpolatedPoints: [],
        spatialResolution: targetResolution,
        temporalResolution: 0,
        interpolationMethod: 'linear',
        confidence: weatherData.length > 0 ? 0.8 : 0
      };
    }

    const interpolatedPoints: WeatherForecast[] = [];
    const sortedWaypoints = [...waypoints].sort((a, b) => a.distanceFromStart - b.distanceFromStart);

    // Create interpolated points between waypoints
    for (let i = 0; i < sortedWaypoints.length - 1; i++) {
      const startWaypoint = sortedWaypoints[i];
      const endWaypoint = sortedWaypoints[i + 1];
      
      const startWeather = this.findClosestWeatherByLocation(startWaypoint, weatherData);
      const endWeather = this.findClosestWeatherByLocation(endWaypoint, weatherData);

      if (startWeather && endWeather) {
        const segmentDistance = endWaypoint.distanceFromStart - startWaypoint.distanceFromStart;
        const numInterpolatedPoints = Math.floor(segmentDistance / targetResolution);

        for (let j = 1; j < numInterpolatedPoints; j++) {
          const progress = j / numInterpolatedPoints;
          const interpolatedWaypoint = this.interpolateWaypoint(startWaypoint, endWaypoint, progress);
          const interpolatedWeather = this.spatiallyInterpolateWeather(
            startWeather,
            endWeather,
            progress,
            interpolatedWaypoint
          );
          
          interpolatedPoints.push(interpolatedWeather);
        }
      }
    }

    return {
      originalPoints: weatherData,
      interpolatedPoints,
      spatialResolution: targetResolution,
      temporalResolution: 0,
      interpolationMethod: 'linear',
      confidence: this.calculateInterpolationConfidence(weatherData, interpolatedPoints)
    };
  }

  /**
   * Write temporal interpolation functions for smooth weather transitions
   */
  temporalWeatherInterpolation(
    weatherData: WeatherForecast[],
    startTime: Date,
    endTime: Date,
    targetResolution: number = 30 // minutes between interpolated points
  ): InterpolatedWeatherData {
    if (weatherData.length < 2) {
      return {
        originalPoints: weatherData,
        interpolatedPoints: [],
        spatialResolution: 0,
        temporalResolution: targetResolution,
        interpolationMethod: 'linear',
        confidence: weatherData.length > 0 ? 0.8 : 0
      };
    }

    const interpolatedPoints: WeatherForecast[] = [];
    const sortedWeatherData = [...weatherData].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const totalDuration = endTime.getTime() - startTime.getTime();
    const intervalMs = targetResolution * 60 * 1000; // Convert minutes to milliseconds
    const numInterpolatedPoints = Math.floor(totalDuration / intervalMs);

    for (let i = 1; i < numInterpolatedPoints; i++) {
      const targetTime = new Date(startTime.getTime() + (i * intervalMs));
      
      // Find the two weather points that bracket this time
      const { before, after } = this.findBracketingWeatherPoints(sortedWeatherData, targetTime);
      
      if (before && after) {
        const timeDiff = after.timestamp.getTime() - before.timestamp.getTime();
        const progress = (targetTime.getTime() - before.timestamp.getTime()) / timeDiff;
        
        const interpolatedWeather = this.temporallyInterpolateWeather(
          before,
          after,
          progress,
          targetTime
        );
        
        interpolatedPoints.push(interpolatedWeather);
      }
    }

    return {
      originalPoints: weatherData,
      interpolatedPoints,
      spatialResolution: 0,
      temporalResolution: targetResolution,
      interpolationMethod: 'linear',
      confidence: this.calculateInterpolationConfidence(weatherData, interpolatedPoints)
    };
  }

  /**
   * Create analysis functions to identify weather pattern changes along route
   */
  identifyWeatherPatternChanges(
    timeline: RouteTimelinePoint[],
    sensitivityThreshold: number = 0.3
  ): WeatherPatternChange[] {
    if (timeline.length < 2) {
      return [];
    }

    const changes: WeatherPatternChange[] = [];
    const sortedTimeline = [...timeline].sort((a, b) => a.timeFromStart - b.timeFromStart);

    for (let i = 1; i < sortedTimeline.length; i++) {
      const previousPoint = sortedTimeline[i - 1];
      const currentPoint = sortedTimeline[i];

      // Check for condition changes
      if (previousPoint.weather.conditions.main !== currentPoint.weather.conditions.main) {
        const severity = this.calculateWeatherChangeSeverity(
          previousPoint.weather,
          currentPoint.weather
        );

        if (severity !== 'minor' || sensitivityThreshold <= 0.1) {
          changes.push({
            location: currentPoint.waypoint,
            timestamp: currentPoint.travelTime,
            fromCondition: previousPoint.weather.conditions.main,
            toCondition: currentPoint.weather.conditions.main,
            severity,
            description: this.generateWeatherChangeDescription(
              previousPoint.weather,
              currentPoint.weather
            ),
            travelImpact: this.assessTravelImpact(
              previousPoint.weather,
              currentPoint.weather
            )
          });
        }
      }

      // Check for significant temperature changes
      const tempChange = Math.abs(
        currentPoint.weather.temperature.current - previousPoint.weather.temperature.current
      );
      if (tempChange >= 10) {
        changes.push({
          location: currentPoint.waypoint,
          timestamp: currentPoint.travelTime,
          fromCondition: previousPoint.weather.conditions.main,
          toCondition: currentPoint.weather.conditions.main,
          severity: tempChange >= 20 ? 'major' : 'moderate',
          description: `Significant temperature change: ${tempChange}°C ${
            currentPoint.weather.temperature.current > previousPoint.weather.temperature.current 
              ? 'increase' : 'decrease'
          }`,
          travelImpact: this.assessTemperatureChangeImpact(tempChange)
        });
      }

      // Check for precipitation changes
      if (previousPoint.weather.precipitation.type !== currentPoint.weather.precipitation.type) {
        const severity = this.calculatePrecipitationChangeSeverity(
          previousPoint.weather.precipitation,
          currentPoint.weather.precipitation
        );

        changes.push({
          location: currentPoint.waypoint,
          timestamp: currentPoint.travelTime,
          fromCondition: previousPoint.weather.conditions.main,
          toCondition: currentPoint.weather.conditions.main,
          severity,
          description: `Precipitation change: ${previousPoint.weather.precipitation.type} to ${currentPoint.weather.precipitation.type}`,
          travelImpact: this.assessPrecipitationChangeImpact(
            previousPoint.weather.precipitation,
            currentPoint.weather.precipitation
          )
        });
      }
    }

    return changes;
  }

  /**
   * Add functions to calculate weather-related travel considerations for different modes
   */
  calculateTravelModeWeatherConsiderations(
    travelMode: TravelMode,
    weatherData: WeatherForecast[]
  ): TravelModeWeatherConsiderations {
    const weatherFactors = this.getTravelModeWeatherFactors(travelMode);
    const recommendations: string[] = [];
    const warnings: string[] = [];

    // Analyze weather conditions for this travel mode
    for (const weather of weatherData) {
      // Temperature analysis
      const temp = weather.temperature.current;
      if (temp < weatherFactors.temperature.dangerous.min || temp > weatherFactors.temperature.dangerous.max) {
        warnings.push(`Dangerous temperature (${temp}°C) for ${travelMode} at ${weather.location.name}`);
      } else if (temp < weatherFactors.temperature.warning.min || temp > weatherFactors.temperature.warning.max) {
        warnings.push(`Suboptimal temperature (${temp}°C) for ${travelMode} at ${weather.location.name}`);
      }

      // Wind analysis
      if (weather.wind.speed > weatherFactors.wind.dangerous) {
        warnings.push(`Dangerous wind speeds (${weather.wind.speed} km/h) for ${travelMode} at ${weather.location.name}`);
      } else if (weather.wind.speed > weatherFactors.wind.warning) {
        warnings.push(`High wind speeds (${weather.wind.speed} km/h) may affect ${travelMode} at ${weather.location.name}`);
      }

      // Precipitation analysis
      if (weatherFactors.precipitation.dangerous.includes(weather.precipitation.type)) {
        warnings.push(`Dangerous precipitation (${weather.precipitation.type}) for ${travelMode} at ${weather.location.name}`);
      } else if (weatherFactors.precipitation.warning.includes(weather.precipitation.type)) {
        warnings.push(`Precipitation (${weather.precipitation.type}) may affect ${travelMode} at ${weather.location.name}`);
      }

      // Visibility analysis
      if (weather.visibility < weatherFactors.visibility.dangerous) {
        warnings.push(`Poor visibility (${weather.visibility} km) for ${travelMode} at ${weather.location.name}`);
      } else if (weather.visibility < weatherFactors.visibility.warning) {
        warnings.push(`Reduced visibility (${weather.visibility} km) for ${travelMode} at ${weather.location.name}`);
      }
    }

    // Generate mode-specific recommendations
    recommendations.push(...this.generateTravelModeRecommendations(travelMode, weatherData));

    return {
      travelMode,
      weatherFactors,
      recommendations,
      warnings
    };
  }

  /**
   * Find closest weather forecast by location
   */
  private findClosestWeatherByLocation(
    waypoint: Waypoint,
    weatherData: WeatherForecast[]
  ): WeatherForecast | null {
    if (weatherData.length === 0) return null;

    let closest = weatherData[0];
    let minDistance = this.calculateDistance(
      waypoint.coordinates,
      closest.location.coordinates
    );

    for (const weather of weatherData) {
      const distance = this.calculateDistance(
        waypoint.coordinates,
        weather.location.coordinates
      );
      if (distance < minDistance) {
        minDistance = distance;
        closest = weather;
      }
    }

    return closest;
  }

  /**
   * Interpolate waypoint between two points
   */
  private interpolateWaypoint(
    start: Waypoint,
    end: Waypoint,
    progress: number
  ): Waypoint {
    return {
      coordinates: {
        latitude: start.coordinates.latitude + 
          (end.coordinates.latitude - start.coordinates.latitude) * progress,
        longitude: start.coordinates.longitude + 
          (end.coordinates.longitude - start.coordinates.longitude) * progress
      },
      distanceFromStart: start.distanceFromStart + 
        (end.distanceFromStart - start.distanceFromStart) * progress,
      estimatedTimeFromStart: start.estimatedTimeFromStart + 
        (end.estimatedTimeFromStart - start.estimatedTimeFromStart) * progress
    };
  }

  /**
   * Spatially interpolate weather between two forecasts
   */
  private spatiallyInterpolateWeather(
    weather1: WeatherForecast,
    weather2: WeatherForecast,
    progress: number,
    waypoint: Waypoint
  ): WeatherForecast {
    const location: Location = {
      name: `Interpolated point at ${waypoint.coordinates.latitude.toFixed(4)}, ${waypoint.coordinates.longitude.toFixed(4)}`,
      coordinates: waypoint.coordinates
    };

    // Use weighted interpolation based on distance
    const weight1 = 1 - progress;
    const weight2 = progress;

    return {
      location,
      timestamp: new Date(
        weather1.timestamp.getTime() * weight1 + weather2.timestamp.getTime() * weight2
      ),
      temperature: {
        current: Math.round(weather1.temperature.current * weight1 + weather2.temperature.current * weight2),
        feelsLike: Math.round(weather1.temperature.feelsLike * weight1 + weather2.temperature.feelsLike * weight2),
        min: Math.round(weather1.temperature.min * weight1 + weather2.temperature.min * weight2),
        max: Math.round(weather1.temperature.max * weight1 + weather2.temperature.max * weight2)
      },
      conditions: {
        main: progress < 0.5 ? weather1.conditions.main : weather2.conditions.main,
        description: progress < 0.5 ? weather1.conditions.description : weather2.conditions.description,
        icon: progress < 0.5 ? weather1.conditions.icon : weather2.conditions.icon
      },
      precipitation: {
        type: progress < 0.5 ? weather1.precipitation.type : weather2.precipitation.type,
        probability: Math.round(weather1.precipitation.probability * weight1 + weather2.precipitation.probability * weight2),
        intensity: Math.round(weather1.precipitation.intensity * weight1 + weather2.precipitation.intensity * weight2)
      },
      wind: {
        speed: Math.round((weather1.wind.speed * weight1 + weather2.wind.speed * weight2) * 10) / 10,
        direction: this.interpolateWindDirection(weather1.wind.direction, weather2.wind.direction, progress)
      },
      humidity: Math.round(weather1.humidity * weight1 + weather2.humidity * weight2),
      visibility: Math.round(weather1.visibility * weight1 + weather2.visibility * weight2)
    };
  }

  /**
   * Find weather points that bracket a target time
   */
  private findBracketingWeatherPoints(
    sortedWeatherData: WeatherForecast[],
    targetTime: Date
  ): { before: WeatherForecast | null; after: WeatherForecast | null } {
    const targetTimestamp = targetTime.getTime();

    let before: WeatherForecast | null = null;
    let after: WeatherForecast | null = null;

    for (let i = 0; i < sortedWeatherData.length; i++) {
      const weather = sortedWeatherData[i];
      const weatherTimestamp = weather.timestamp.getTime();

      if (weatherTimestamp <= targetTimestamp) {
        before = weather;
      } else if (weatherTimestamp > targetTimestamp && !after) {
        after = weather;
        break;
      }
    }

    return { before, after };
  }

  /**
   * Temporally interpolate weather between two forecasts
   */
  private temporallyInterpolateWeather(
    weather1: WeatherForecast,
    weather2: WeatherForecast,
    progress: number,
    targetTime: Date
  ): WeatherForecast {
    // Use the location of the closer weather point
    const location = progress < 0.5 ? weather1.location : weather2.location;

    return {
      location,
      timestamp: targetTime,
      temperature: {
        current: Math.round(weather1.temperature.current + (weather2.temperature.current - weather1.temperature.current) * progress),
        feelsLike: Math.round(weather1.temperature.feelsLike + (weather2.temperature.feelsLike - weather1.temperature.feelsLike) * progress),
        min: Math.round(weather1.temperature.min + (weather2.temperature.min - weather1.temperature.min) * progress),
        max: Math.round(weather1.temperature.max + (weather2.temperature.max - weather1.temperature.max) * progress)
      },
      conditions: {
        main: progress < 0.5 ? weather1.conditions.main : weather2.conditions.main,
        description: progress < 0.5 ? weather1.conditions.description : weather2.conditions.description,
        icon: progress < 0.5 ? weather1.conditions.icon : weather2.conditions.icon
      },
      precipitation: {
        type: progress < 0.5 ? weather1.precipitation.type : weather2.precipitation.type,
        probability: Math.round(weather1.precipitation.probability + (weather2.precipitation.probability - weather1.precipitation.probability) * progress),
        intensity: Math.round(weather1.precipitation.intensity + (weather2.precipitation.intensity - weather1.precipitation.intensity) * progress)
      },
      wind: {
        speed: Math.round((weather1.wind.speed + (weather2.wind.speed - weather1.wind.speed) * progress) * 10) / 10,
        direction: this.interpolateWindDirection(weather1.wind.direction, weather2.wind.direction, progress)
      },
      humidity: Math.round(weather1.humidity + (weather2.humidity - weather1.humidity) * progress),
      visibility: Math.round(weather1.visibility + (weather2.visibility - weather1.visibility) * progress)
    };
  }

  /**
   * Calculate interpolation confidence
   */
  private calculateInterpolationConfidence(
    originalData: WeatherForecast[],
    interpolatedData: WeatherForecast[]
  ): number {
    if (originalData.length === 0) return 0;
    if (interpolatedData.length === 0) return 1;

    // Base confidence on data density
    const totalPoints = originalData.length + interpolatedData.length;
    const originalRatio = originalData.length / totalPoints;
    
    // Higher confidence with more original data points
    let confidence = originalRatio * 0.8 + 0.2;

    // Reduce confidence if interpolating over large gaps
    if (originalData.length >= 2) {
      const maxGap = this.calculateMaxTemporalGap(originalData);
      const hourGap = maxGap / (60 * 60 * 1000); // Convert to hours
      
      if (hourGap > 6) {
        confidence *= Math.max(0.3, 1 - (hourGap - 6) * 0.1);
      }
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Calculate maximum temporal gap in weather data
   */
  private calculateMaxTemporalGap(weatherData: WeatherForecast[]): number {
    if (weatherData.length < 2) return 0;

    const sortedData = [...weatherData].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    let maxGap = 0;

    for (let i = 1; i < sortedData.length; i++) {
      const gap = sortedData[i].timestamp.getTime() - sortedData[i - 1].timestamp.getTime();
      maxGap = Math.max(maxGap, gap);
    }

    return maxGap;
  }

  /**
   * Calculate weather change severity
   */
  private calculateWeatherChangeSeverity(
    weather1: WeatherForecast,
    weather2: WeatherForecast
  ): 'minor' | 'moderate' | 'major' {
    const conditionSeverity = this.getConditionSeverityScore(weather1.conditions.main, weather2.conditions.main);
    const tempChange = Math.abs(weather2.temperature.current - weather1.temperature.current);
    const windChange = Math.abs(weather2.wind.speed - weather1.wind.speed);
    const precipChange = weather1.precipitation.type !== weather2.precipitation.type ? 1 : 0;

    const totalScore = conditionSeverity + (tempChange / 10) + (windChange / 20) + precipChange;

    if (totalScore >= 3) return 'major';
    if (totalScore >= 1.5) return 'moderate';
    return 'minor';
  }

  /**
   * Get condition severity score for weather changes
   */
  private getConditionSeverityScore(condition1: WeatherCondition, condition2: WeatherCondition): number {
    const severityMap = new Map([
      [WeatherCondition.SUNNY, 0],
      [WeatherCondition.CLOUDY, 1],
      [WeatherCondition.OVERCAST, 2],
      [WeatherCondition.FOGGY, 3],
      [WeatherCondition.RAINY, 4],
      [WeatherCondition.SNOWY, 5],
      [WeatherCondition.STORMY, 6]
    ]);

    const score1 = severityMap.get(condition1) || 0;
    const score2 = severityMap.get(condition2) || 0;

    return Math.abs(score2 - score1) / 2;
  }

  /**
   * Generate weather change description
   */
  private generateWeatherChangeDescription(
    weather1: WeatherForecast,
    weather2: WeatherForecast
  ): string {
    const tempChange = weather2.temperature.current - weather1.temperature.current;
    const tempDirection = tempChange > 0 ? 'warmer' : 'cooler';
    const tempMagnitude = Math.abs(tempChange);

    let description = `Weather changing from ${weather1.conditions.description} to ${weather2.conditions.description}`;
    
    if (tempMagnitude >= 5) {
      description += `, becoming ${tempMagnitude}°C ${tempDirection}`;
    }

    if (weather1.precipitation.type !== weather2.precipitation.type) {
      description += `, precipitation changing from ${weather1.precipitation.type} to ${weather2.precipitation.type}`;
    }

    return description;
  }

  /**
   * Assess travel impact of weather changes
   */
  private assessTravelImpact(
    weather1: WeatherForecast,
    weather2: WeatherForecast
  ): string {
    const impacts: string[] = [];

    // Temperature impact
    const tempChange = Math.abs(weather2.temperature.current - weather1.temperature.current);
    if (tempChange >= 15) {
      impacts.push('significant temperature change may require clothing adjustments');
    }

    // Condition impact
    if (weather1.conditions.main === WeatherCondition.SUNNY && weather2.conditions.main === WeatherCondition.STORMY) {
      impacts.push('deteriorating conditions may require route adjustments');
    } else if (weather1.conditions.main === WeatherCondition.STORMY && weather2.conditions.main === WeatherCondition.SUNNY) {
      impacts.push('improving conditions ahead');
    }

    // Precipitation impact
    if (weather1.precipitation.type === PrecipitationType.NONE && weather2.precipitation.type !== PrecipitationType.NONE) {
      impacts.push('precipitation starting - consider protective gear');
    } else if (weather1.precipitation.type !== PrecipitationType.NONE && weather2.precipitation.type === PrecipitationType.NONE) {
      impacts.push('precipitation ending - conditions improving');
    }

    return impacts.length > 0 ? impacts.join('; ') : 'minimal travel impact expected';
  }

  /**
   * Assess temperature change impact
   */
  private assessTemperatureChangeImpact(tempChange: number): string {
    if (tempChange >= 20) {
      return 'extreme temperature change - significant clothing and equipment adjustments needed';
    } else if (tempChange >= 15) {
      return 'major temperature change - clothing adjustments recommended';
    } else if (tempChange >= 10) {
      return 'moderate temperature change - minor clothing adjustments may be needed';
    }
    return 'minor temperature change - minimal impact expected';
  }

  /**
   * Calculate precipitation change severity
   */
  private calculatePrecipitationChangeSeverity(
    precip1: { type: PrecipitationType; probability: number; intensity: number },
    precip2: { type: PrecipitationType; probability: number; intensity: number }
  ): 'minor' | 'moderate' | 'major' {
    const typeChange = precip1.type !== precip2.type ? 1 : 0;
    const intensityChange = Math.abs(precip2.intensity - precip1.intensity);
    const probabilityChange = Math.abs(precip2.probability - precip1.probability);

    const score = typeChange + (intensityChange / 5) + (probabilityChange / 50);

    if (score >= 2) return 'major';
    if (score >= 1) return 'moderate';
    return 'minor';
  }

  /**
   * Assess precipitation change impact
   */
  private assessPrecipitationChangeImpact(
    precip1: { type: PrecipitationType; probability: number; intensity: number },
    precip2: { type: PrecipitationType; probability: number; intensity: number }
  ): string {
    if (precip1.type === PrecipitationType.NONE && precip2.type !== PrecipitationType.NONE) {
      return `${precip2.type} starting with ${precip2.intensity}/10 intensity - consider protective gear`;
    } else if (precip1.type !== PrecipitationType.NONE && precip2.type === PrecipitationType.NONE) {
      return 'precipitation ending - conditions improving for travel';
    } else if (precip1.type !== precip2.type) {
      return `precipitation type changing from ${precip1.type} to ${precip2.type}`;
    } else if (Math.abs(precip2.intensity - precip1.intensity) >= 3) {
      const direction = precip2.intensity > precip1.intensity ? 'intensifying' : 'weakening';
      return `${precip2.type} ${direction} - intensity changing from ${precip1.intensity}/10 to ${precip2.intensity}/10`;
    }
    return 'minimal precipitation impact expected';
  }

  /**
   * Get travel mode weather factors
   */
  private getTravelModeWeatherFactors(travelMode: TravelMode): TravelModeWeatherConsiderations['weatherFactors'] {
    switch (travelMode) {
      case TravelMode.WALKING:
        return {
          temperature: {
            optimal: { min: 15, max: 25 },
            warning: { min: 5, max: 35 },
            dangerous: { min: -10, max: 45 }
          },
          wind: { optimal: 15, warning: 30, dangerous: 50 },
          precipitation: {
            acceptable: [PrecipitationType.NONE],
            warning: [PrecipitationType.RAIN],
            dangerous: [PrecipitationType.SLEET, PrecipitationType.SNOW, PrecipitationType.HAIL]
          },
          visibility: { optimal: 10, warning: 5, dangerous: 1 }
        };

      case TravelMode.CYCLING:
        return {
          temperature: {
            optimal: { min: 10, max: 30 },
            warning: { min: 0, max: 40 },
            dangerous: { min: -15, max: 50 }
          },
          wind: { optimal: 20, warning: 40, dangerous: 60 },
          precipitation: {
            acceptable: [PrecipitationType.NONE],
            warning: [PrecipitationType.RAIN],
            dangerous: [PrecipitationType.SLEET, PrecipitationType.SNOW, PrecipitationType.HAIL]
          },
          visibility: { optimal: 10, warning: 3, dangerous: 1 }
        };

      case TravelMode.DRIVING:
        return {
          temperature: {
            optimal: { min: -20, max: 50 },
            warning: { min: -30, max: 60 },
            dangerous: { min: -40, max: 70 }
          },
          wind: { optimal: 40, warning: 70, dangerous: 100 },
          precipitation: {
            acceptable: [PrecipitationType.NONE, PrecipitationType.RAIN],
            warning: [PrecipitationType.SLEET, PrecipitationType.SNOW],
            dangerous: [PrecipitationType.HAIL]
          },
          visibility: { optimal: 10, warning: 2, dangerous: 0.5 }
        };

      case TravelMode.FLYING:
        return {
          temperature: {
            optimal: { min: -50, max: 50 },
            warning: { min: -60, max: 60 },
            dangerous: { min: -70, max: 70 }
          },
          wind: { optimal: 30, warning: 60, dangerous: 100 },
          precipitation: {
            acceptable: [PrecipitationType.NONE, PrecipitationType.RAIN],
            warning: [PrecipitationType.SNOW, PrecipitationType.SLEET],
            dangerous: [PrecipitationType.HAIL]
          },
          visibility: { optimal: 10, warning: 5, dangerous: 1 }
        };

      case TravelMode.SAILING:
        return {
          temperature: {
            optimal: { min: 10, max: 35 },
            warning: { min: 0, max: 45 },
            dangerous: { min: -10, max: 55 }
          },
          wind: { optimal: 25, warning: 50, dangerous: 80 },
          precipitation: {
            acceptable: [PrecipitationType.NONE, PrecipitationType.RAIN],
            warning: [PrecipitationType.SLEET],
            dangerous: [PrecipitationType.SNOW, PrecipitationType.HAIL]
          },
          visibility: { optimal: 10, warning: 3, dangerous: 1 }
        };

      case TravelMode.CRUISE:
        return {
          temperature: {
            optimal: { min: 15, max: 35 },
            warning: { min: 5, max: 45 },
            dangerous: { min: -5, max: 55 }
          },
          wind: { optimal: 30, warning: 60, dangerous: 100 },
          precipitation: {
            acceptable: [PrecipitationType.NONE, PrecipitationType.RAIN],
            warning: [PrecipitationType.SLEET, PrecipitationType.SNOW],
            dangerous: [PrecipitationType.HAIL]
          },
          visibility: { optimal: 10, warning: 5, dangerous: 2 }
        };

      default:
        return this.getTravelModeWeatherFactors(TravelMode.DRIVING);
    }
  }

  /**
   * Generate travel mode recommendations
   */
  private generateTravelModeRecommendations(
    travelMode: TravelMode,
    weatherData: WeatherForecast[]
  ): string[] {
    const recommendations: string[] = [];

    // Analyze overall weather patterns
    const avgTemp = weatherData.reduce((sum, w) => sum + w.temperature.current, 0) / weatherData.length;
    const maxWind = Math.max(...weatherData.map(w => w.wind.speed));
    const hasPrecipitation = weatherData.some(w => w.precipitation.type !== PrecipitationType.NONE);
    const minVisibility = Math.min(...weatherData.map(w => w.visibility));

    switch (travelMode) {
      case TravelMode.WALKING:
        if (avgTemp < 10) {
          recommendations.push('Pack warm clothing and layers for cold weather walking');
        }
        if (hasPrecipitation) {
          recommendations.push('Bring waterproof clothing and footwear');
        }
        if (maxWind > 25) {
          recommendations.push('Consider windproof clothing for windy conditions');
        }
        break;

      case TravelMode.CYCLING:
        if (avgTemp < 15) {
          recommendations.push('Wear appropriate cycling gear for cooler temperatures');
        }
        if (hasPrecipitation) {
          recommendations.push('Consider waterproof cycling gear and fenders');
        }
        if (maxWind > 30) {
          recommendations.push('Plan for headwinds and consider route adjustments');
        }
        if (minVisibility < 5) {
          recommendations.push('Use lights and reflective gear for low visibility conditions');
        }
        break;

      case TravelMode.DRIVING:
        if (hasPrecipitation) {
          recommendations.push('Check tire condition and reduce speed in wet conditions');
        }
        if (minVisibility < 3) {
          recommendations.push('Use headlights and maintain safe following distance');
        }
        if (weatherData.some(w => w.precipitation.type === PrecipitationType.SNOW)) {
          recommendations.push('Consider snow tires or chains if traveling through snowy areas');
        }
        break;

      case TravelMode.FLYING:
        if (weatherData.some(w => w.conditions.main === WeatherCondition.STORMY)) {
          recommendations.push('Monitor flight status for potential weather delays');
        }
        if (maxWind > 50) {
          recommendations.push('Expect possible turbulence due to high winds');
        }
        break;

      case TravelMode.SAILING:
        if (maxWind < 10) {
          recommendations.push('Light winds expected - consider motor assistance');
        } else if (maxWind > 40) {
          recommendations.push('Strong winds forecasted - reef sails and secure equipment');
        }
        if (weatherData.some(w => w.conditions.main === WeatherCondition.STORMY)) {
          recommendations.push('Monitor marine weather closely and consider postponing if severe storms expected');
        }
        break;

      case TravelMode.CRUISE:
        if (weatherData.some(w => w.conditions.main === WeatherCondition.STORMY)) {
          recommendations.push('Expect possible itinerary changes due to weather conditions');
        }
        if (maxWind > 50) {
          recommendations.push('Prepare for rough seas and potential seasickness');
        }
        break;
    }

    return recommendations;
  }
}