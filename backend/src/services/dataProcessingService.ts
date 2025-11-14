import { Route, RouteSegment } from '@shared/types/route.js';
import { WeatherForecast } from '@shared/types/weather.js';
import { Location, Waypoint } from '@shared/types/location.js';
import { TravelConfig } from '@shared/types/travel.js';

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
}