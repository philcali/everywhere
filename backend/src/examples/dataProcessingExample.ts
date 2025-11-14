import { DataProcessingService } from '../services/dataProcessingService.js';
import { Route } from '@shared/types/route.js';
import { WeatherForecast, WeatherCondition, PrecipitationType } from '@shared/types/weather.js';
import { TravelMode } from '@shared/types/travel.js';

/**
 * Example demonstrating how to use the DataProcessingService
 * to integrate route and weather data
 */
async function demonstrateDataProcessing() {
  const service = new DataProcessingService();

  // Example route from New York to Boston
  const exampleRoute: Route = {
    id: 'example-route-1',
    source: {
      name: 'New York, NY',
      coordinates: { latitude: 40.7128, longitude: -74.0060 }
    },
    destination: {
      name: 'Boston, MA',
      coordinates: { latitude: 42.3601, longitude: -71.0589 }
    },
    travelMode: TravelMode.DRIVING,
    totalDistance: 300, // km
    estimatedDuration: 14400, // 4 hours in seconds
    waypoints: [
      {
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        distanceFromStart: 0,
        estimatedTimeFromStart: 0
      },
      {
        coordinates: { latitude: 41.0, longitude: -73.0 },
        distanceFromStart: 100,
        estimatedTimeFromStart: 4800 // 1.33 hours
      },
      {
        coordinates: { latitude: 41.5, longitude: -72.0 },
        distanceFromStart: 200,
        estimatedTimeFromStart: 9600 // 2.67 hours
      },
      {
        coordinates: { latitude: 42.3601, longitude: -71.0589 },
        distanceFromStart: 300,
        estimatedTimeFromStart: 14400 // 4 hours
      }
    ],
    segments: [
      {
        startPoint: {
          coordinates: { latitude: 40.7128, longitude: -74.0060 },
          distanceFromStart: 0,
          estimatedTimeFromStart: 0
        },
        endPoint: {
          coordinates: { latitude: 41.0, longitude: -73.0 },
          distanceFromStart: 100,
          estimatedTimeFromStart: 4800
        },
        distance: 100,
        estimatedDuration: 4800,
        travelMode: TravelMode.DRIVING
      },
      {
        startPoint: {
          coordinates: { latitude: 41.0, longitude: -73.0 },
          distanceFromStart: 100,
          estimatedTimeFromStart: 4800
        },
        endPoint: {
          coordinates: { latitude: 41.5, longitude: -72.0 },
          distanceFromStart: 200,
          estimatedTimeFromStart: 9600
        },
        distance: 100,
        estimatedDuration: 4800,
        travelMode: TravelMode.DRIVING
      },
      {
        startPoint: {
          coordinates: { latitude: 41.5, longitude: -72.0 },
          distanceFromStart: 200,
          estimatedTimeFromStart: 9600
        },
        endPoint: {
          coordinates: { latitude: 42.3601, longitude: -71.0589 },
          distanceFromStart: 300,
          estimatedTimeFromStart: 14400
        },
        distance: 100,
        estimatedDuration: 4800,
        travelMode: TravelMode.DRIVING
      }
    ]
  };

  // Example weather data along the route
  const exampleWeatherData: WeatherForecast[] = [
    {
      location: {
        name: 'New York, NY',
        coordinates: { latitude: 40.7128, longitude: -74.0060 }
      },
      timestamp: new Date('2024-01-15T10:00:00Z'),
      temperature: {
        current: 15,
        feelsLike: 12,
        min: 10,
        max: 18
      },
      conditions: {
        main: WeatherCondition.SUNNY,
        description: 'Clear sky',
        icon: '01d'
      },
      precipitation: {
        type: PrecipitationType.NONE,
        probability: 0,
        intensity: 0
      },
      wind: {
        speed: 10,
        direction: 180
      },
      humidity: 60,
      visibility: 15
    },
    {
      location: {
        name: 'Hartford, CT',
        coordinates: { latitude: 41.5, longitude: -72.0 }
      },
      timestamp: new Date('2024-01-15T12:30:00Z'),
      temperature: {
        current: 12,
        feelsLike: 9,
        min: 8,
        max: 15
      },
      conditions: {
        main: WeatherCondition.CLOUDY,
        description: 'Partly cloudy',
        icon: '02d'
      },
      precipitation: {
        type: PrecipitationType.NONE,
        probability: 20,
        intensity: 0
      },
      wind: {
        speed: 15,
        direction: 200
      },
      humidity: 70,
      visibility: 12
    },
    {
      location: {
        name: 'Boston, MA',
        coordinates: { latitude: 42.3601, longitude: -71.0589 }
      },
      timestamp: new Date('2024-01-15T14:00:00Z'),
      temperature: {
        current: 8,
        feelsLike: 5,
        min: 5,
        max: 12
      },
      conditions: {
        main: WeatherCondition.RAINY,
        description: 'Light rain',
        icon: '10d'
      },
      precipitation: {
        type: PrecipitationType.RAIN,
        probability: 80,
        intensity: 3
      },
      wind: {
        speed: 20,
        direction: 220
      },
      humidity: 85,
      visibility: 8
    }
  ];

  const startTime = new Date('2024-01-15T10:00:00Z');

  try {
    console.log('🚗 Integrating route and weather data...\n');

    // 1. Integrate route with weather data
    const integration = await service.integrateRouteWithWeather(
      exampleRoute,
      exampleWeatherData,
      startTime
    );

    console.log('📊 Integration Results:');
    console.log(`- Route: ${integration.route.source.name} → ${integration.route.destination.name}`);
    console.log(`- Distance: ${integration.route.totalDistance} km`);
    console.log(`- Duration: ${Math.round(integration.totalDuration / 3600 * 10) / 10} hours`);
    console.log(`- Timeline points: ${integration.timeline.length}`);
    console.log(`- Data quality: ${Math.round(integration.dataQuality.completeness * 100)}% complete, ${Math.round(integration.dataQuality.confidence * 100)}% confidence`);
    console.log(`- Interpolated points: ${integration.dataQuality.interpolatedPoints}`);

    if (integration.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      integration.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log('\n🌤️  Weather Timeline:');
    integration.timeline.forEach((point, index) => {
      const time = point.travelTime.toLocaleTimeString();
      const temp = point.weather.temperature.current;
      const condition = point.weather.conditions.description;
      const distance = Math.round(point.distanceFromStart);
      const interpolated = point.isInterpolated ? ' (interpolated)' : '';
      const confidence = Math.round(point.confidence * 100);
      
      console.log(`  ${index + 1}. ${time} - ${distance}km: ${temp}°C, ${condition} (${confidence}% confidence)${interpolated}`);
    });

    // 2. Validate data consistency
    console.log('\n🔍 Data Validation:');
    const validation = service.validateDataConsistency(
      exampleRoute,
      exampleWeatherData,
      startTime
    );

    console.log(`- Valid: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`- Consistency score: ${Math.round(validation.dataConsistencyScore * 100)}%`);
    console.log(`- Missing data points: ${validation.missingDataPoints}`);

    if (validation.errors.length > 0) {
      console.log('\n❌ Errors:');
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Validation Warnings:');
      validation.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    // 3. Align weather with route segments
    console.log('\n🛣️  Route Segments with Weather:');
    const alignedSegments = service.alignWeatherWithRouteSegments(
      exampleRoute,
      exampleWeatherData,
      startTime
    );

    alignedSegments.forEach((aligned, index) => {
      const startTime = aligned.segmentStartTime.toLocaleTimeString();
      const endTime = aligned.segmentEndTime.toLocaleTimeString();
      const distance = Math.round(aligned.segment.distance);
      const avgTemp = aligned.averageWeather.temperature.current;
      const condition = aligned.averageWeather.conditions.description;
      
      console.log(`  Segment ${index + 1}: ${startTime} - ${endTime} (${distance}km)`);
      console.log(`    Weather: ${avgTemp}°C, ${condition}`);
      console.log(`    Forecasts: ${aligned.weatherForecasts.length} data points`);
    });

    // 4. Demonstrate spatial weather interpolation
    console.log('\n🌍 Spatial Weather Interpolation:');
    const spatialInterpolation = service.spatialWeatherInterpolation(
      exampleRoute.waypoints,
      exampleWeatherData,
      25 // 25km resolution
    );

    console.log(`- Original weather points: ${spatialInterpolation.originalPoints.length}`);
    console.log(`- Interpolated points: ${spatialInterpolation.interpolatedPoints.length}`);
    console.log(`- Spatial resolution: ${spatialInterpolation.spatialResolution}km`);
    console.log(`- Interpolation confidence: ${Math.round(spatialInterpolation.confidence * 100)}%`);

    if (spatialInterpolation.interpolatedPoints.length > 0) {
      console.log('\n  Sample interpolated points:');
      spatialInterpolation.interpolatedPoints.slice(0, 3).forEach((point, index) => {
        const lat = point.location.coordinates.latitude.toFixed(4);
        const lng = point.location.coordinates.longitude.toFixed(4);
        const temp = point.temperature.current;
        const condition = point.conditions.description;
        console.log(`    ${index + 1}. (${lat}, ${lng}): ${temp}°C, ${condition}`);
      });
    }

    // 5. Demonstrate temporal weather interpolation
    console.log('\n⏰ Temporal Weather Interpolation:');
    const endTime = new Date(startTime.getTime() + exampleRoute.estimatedDuration * 1000);
    const temporalInterpolation = service.temporalWeatherInterpolation(
      exampleWeatherData,
      startTime,
      endTime,
      45 // 45 minute resolution
    );

    console.log(`- Original weather points: ${temporalInterpolation.originalPoints.length}`);
    console.log(`- Interpolated points: ${temporalInterpolation.interpolatedPoints.length}`);
    console.log(`- Temporal resolution: ${temporalInterpolation.temporalResolution} minutes`);
    console.log(`- Interpolation confidence: ${Math.round(temporalInterpolation.confidence * 100)}%`);

    if (temporalInterpolation.interpolatedPoints.length > 0) {
      console.log('\n  Sample interpolated points:');
      temporalInterpolation.interpolatedPoints.slice(0, 3).forEach((point, index) => {
        const time = point.timestamp.toLocaleTimeString();
        const temp = point.temperature.current;
        const condition = point.conditions.description;
        console.log(`    ${index + 1}. ${time}: ${temp}°C, ${condition}`);
      });
    }

    // 6. Identify weather pattern changes
    console.log('\n🌦️  Weather Pattern Changes:');
    const patternChanges = service.identifyWeatherPatternChanges(
      integration.timeline,
      0.2 // Sensitivity threshold
    );

    console.log(`- Pattern changes detected: ${patternChanges.length}`);
    
    if (patternChanges.length > 0) {
      patternChanges.forEach((change, index) => {
        const time = change.timestamp.toLocaleTimeString();
        const lat = change.location.coordinates.latitude.toFixed(4);
        const lng = change.location.coordinates.longitude.toFixed(4);
        console.log(`\n  Change ${index + 1} (${change.severity}):`);
        console.log(`    Time: ${time} at (${lat}, ${lng})`);
        console.log(`    Transition: ${change.fromCondition} → ${change.toCondition}`);
        console.log(`    Description: ${change.description}`);
        console.log(`    Travel Impact: ${change.travelImpact}`);
      });
    } else {
      console.log('  No significant weather pattern changes detected along the route.');
    }

    // 7. Calculate travel mode weather considerations
    console.log('\n🚶‍♂️ Travel Mode Weather Considerations:');
    
    const travelModes = [TravelMode.WALKING, TravelMode.CYCLING, TravelMode.DRIVING, TravelMode.FLYING];
    
    for (const mode of travelModes) {
      const considerations = service.calculateTravelModeWeatherConsiderations(
        mode,
        exampleWeatherData
      );

      console.log(`\n  ${mode.toUpperCase()}:`);
      console.log(`    Temperature range: ${considerations.weatherFactors.temperature.optimal.min}°C - ${considerations.weatherFactors.temperature.optimal.max}°C (optimal)`);
      console.log(`    Wind tolerance: up to ${considerations.weatherFactors.wind.optimal} km/h (optimal)`);
      console.log(`    Visibility requirement: ${considerations.weatherFactors.visibility.optimal}km+ (optimal)`);
      
      if (considerations.warnings.length > 0) {
        console.log(`    Warnings: ${considerations.warnings.length}`);
        considerations.warnings.slice(0, 2).forEach(warning => {
          console.log(`      - ${warning}`);
        });
      }
      
      if (considerations.recommendations.length > 0) {
        console.log(`    Recommendations: ${considerations.recommendations.length}`);
        considerations.recommendations.slice(0, 2).forEach(rec => {
          console.log(`      - ${rec}`);
        });
      }
    }

    // 8. Demonstrate extreme weather scenario
    console.log('\n❄️  Extreme Weather Scenario Analysis:');
    
    const extremeWeatherData: WeatherForecast[] = [
      {
        ...exampleWeatherData[0],
        temperature: { current: -15, feelsLike: -22, min: -20, max: -10 },
        conditions: { main: WeatherCondition.SNOWY, description: 'Heavy snow', icon: '13d' },
        precipitation: { type: PrecipitationType.SNOW, probability: 95, intensity: 8 },
        wind: { speed: 45, direction: 270 },
        visibility: 2
      },
      {
        ...exampleWeatherData[1],
        temperature: { current: -12, feelsLike: -18, min: -15, max: -8 },
        conditions: { main: WeatherCondition.SNOWY, description: 'Snow showers', icon: '13d' },
        precipitation: { type: PrecipitationType.SNOW, probability: 80, intensity: 6 },
        wind: { speed: 35, direction: 280 },
        visibility: 3
      },
      {
        ...exampleWeatherData[2],
        temperature: { current: -8, feelsLike: -15, min: -12, max: -5 },
        conditions: { main: WeatherCondition.CLOUDY, description: 'Overcast', icon: '04d' },
        precipitation: { type: PrecipitationType.SLEET, probability: 60, intensity: 4 },
        wind: { speed: 25, direction: 290 },
        visibility: 5
      }
    ];

    const extremeIntegration = await service.integrateRouteWithWeather(
      exampleRoute,
      extremeWeatherData,
      startTime
    );

    console.log(`- Extreme weather warnings: ${extremeIntegration.warnings.length}`);
    extremeIntegration.warnings.forEach(warning => {
      console.log(`    - ${warning}`);
    });

    const extremePatternChanges = service.identifyWeatherPatternChanges(
      extremeIntegration.timeline,
      0.1
    );

    console.log(`- Weather pattern changes in extreme conditions: ${extremePatternChanges.length}`);
    
    const drivingConsiderations = service.calculateTravelModeWeatherConsiderations(
      TravelMode.DRIVING,
      extremeWeatherData
    );

    console.log(`- Driving warnings in extreme weather: ${drivingConsiderations.warnings.length}`);
    drivingConsiderations.warnings.slice(0, 3).forEach(warning => {
      console.log(`    - ${warning}`);
    });

    console.log('\n✅ Weather interpolation and analysis demonstration completed successfully!');

  } catch (error) {
    console.error('❌ Error during data processing:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  }
}

// Run the demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateDataProcessing().catch(console.error);
}

export { demonstrateDataProcessing };