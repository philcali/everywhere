import React from 'react';
import { WeatherVisualization } from './WeatherVisualization';
import { WeatherForecast, WeatherCondition, PrecipitationType, Route, TravelMode } from '../../types/shared';

// Demo component to showcase the weather visualization functionality
export const WeatherVisualizationDemo: React.FC = () => {
  // Sample route data for demonstration
  const sampleRoute: Route = {
    id: 'demo-route-ny-to-richmond',
    source: {
      name: 'New York, NY',
      coordinates: { latitude: 40.7128, longitude: -74.0060 },
      address: 'New York, NY, USA'
    },
    destination: {
      name: 'Richmond, VA',
      coordinates: { latitude: 37.5407, longitude: -77.4360 },
      address: 'Richmond, VA, USA'
    },
    travelMode: TravelMode.DRIVING,
    waypoints: [
      {
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        distanceFromStart: 0,
        estimatedTimeFromStart: 0
      },
      {
        coordinates: { latitude: 39.9526, longitude: -75.1652 },
        distanceFromStart: 150,
        estimatedTimeFromStart: 240
      },
      {
        coordinates: { latitude: 39.2904, longitude: -76.6122 },
        distanceFromStart: 280,
        estimatedTimeFromStart: 480
      },
      {
        coordinates: { latitude: 38.9072, longitude: -77.0369 },
        distanceFromStart: 350,
        estimatedTimeFromStart: 720
      },
      {
        coordinates: { latitude: 37.5407, longitude: -77.4360 },
        distanceFromStart: 450,
        estimatedTimeFromStart: 960
      }
    ],
    totalDistance: 450,
    estimatedDuration: 960,
    segments: []
  };

  // Sample weather data for demonstration
  const sampleWeatherData: WeatherForecast[] = [
    {
      location: {
        name: 'New York, NY',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        address: 'New York, NY, USA'
      },
      timestamp: new Date('2024-01-15T08:00:00Z'),
      temperature: {
        current: 5,
        feelsLike: 2,
        min: 2,
        max: 8
      },
      conditions: {
        main: WeatherCondition.CLOUDY,
        description: 'Partly cloudy',
        icon: 'cloudy'
      },
      precipitation: {
        type: PrecipitationType.NONE,
        probability: 10,
        intensity: 0
      },
      wind: {
        speed: 12,
        direction: 270
      },
      humidity: 65,
      visibility: 10
    },
    {
      location: {
        name: 'Philadelphia, PA',
        coordinates: { latitude: 39.9526, longitude: -75.1652 },
        address: 'Philadelphia, PA, USA'
      },
      timestamp: new Date('2024-01-15T12:00:00Z'),
      temperature: {
        current: 8,
        feelsLike: 6,
        min: 5,
        max: 12
      },
      conditions: {
        main: WeatherCondition.RAINY,
        description: 'Light rain',
        icon: 'rainy'
      },
      precipitation: {
        type: PrecipitationType.RAIN,
        probability: 75,
        intensity: 0.4
      },
      wind: {
        speed: 15,
        direction: 180
      },
      humidity: 85,
      visibility: 8
    },
    {
      location: {
        name: 'Baltimore, MD',
        coordinates: { latitude: 39.2904, longitude: -76.6122 },
        address: 'Baltimore, MD, USA'
      },
      timestamp: new Date('2024-01-15T16:00:00Z'),
      temperature: {
        current: 12,
        feelsLike: 10,
        min: 8,
        max: 15
      },
      conditions: {
        main: WeatherCondition.SUNNY,
        description: 'Clear sky',
        icon: 'sunny'
      },
      precipitation: {
        type: PrecipitationType.NONE,
        probability: 5,
        intensity: 0
      },
      wind: {
        speed: 8,
        direction: 225
      },
      humidity: 55,
      visibility: 15
    },
    {
      location: {
        name: 'Washington, DC',
        coordinates: { latitude: 38.9072, longitude: -77.0369 },
        address: 'Washington, DC, USA'
      },
      timestamp: new Date('2024-01-15T20:00:00Z'),
      temperature: {
        current: 10,
        feelsLike: 8,
        min: 6,
        max: 13
      },
      conditions: {
        main: WeatherCondition.STORMY,
        description: 'Thunderstorm',
        icon: 'stormy'
      },
      precipitation: {
        type: PrecipitationType.RAIN,
        probability: 90,
        intensity: 0.8
      },
      wind: {
        speed: 25,
        direction: 315
      },
      humidity: 90,
      visibility: 5
    },
    {
      location: {
        name: 'Richmond, VA',
        coordinates: { latitude: 37.5407, longitude: -77.4360 },
        address: 'Richmond, VA, USA'
      },
      timestamp: new Date('2024-01-16T00:00:00Z'),
      temperature: {
        current: 15,
        feelsLike: 13,
        min: 10,
        max: 18
      },
      conditions: {
        main: WeatherCondition.FOGGY,
        description: 'Fog',
        icon: 'foggy'
      },
      precipitation: {
        type: PrecipitationType.NONE,
        probability: 20,
        intensity: 0
      },
      wind: {
        speed: 5,
        direction: 90
      },
      humidity: 95,
      visibility: 2
    }
  ];

  const handleForecastSelect = (forecast: WeatherForecast) => {
    console.log('Selected forecast:', forecast);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Weather Visualization Demo
        </h1>
        <p className="text-lg text-gray-600">
          Interactive weather charts showing conditions along a sample travel route from New York to Richmond.
        </p>
      </div>

      <WeatherVisualization
        weatherData={sampleWeatherData}
        route={sampleRoute}
        onForecastSelect={handleForecastSelect}
        className="bg-gray-50 rounded-xl p-6"
      />

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Features Demonstrated:</h2>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Interactive timeline chart with multiple weather metrics</li>
          <li>• Temperature trend visualization with min/max ranges</li>
          <li>• Precipitation probability and intensity charts</li>
          <li>• Interactive route map with weather overlay markers</li>
          <li>• Color-coded weather conditions and intensity indicators</li>
          <li>• Weather condition icons and visual indicators</li>
          <li>• Responsive design for mobile and desktop</li>
          <li>• Detailed forecast information on selection</li>
        </ul>
      </div>
    </div>
  );
};

export default WeatherVisualizationDemo;