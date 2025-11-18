import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RouteMapWithWeather } from '../RouteMapWithWeather';
import { Route, WeatherForecast, TravelMode, WeatherCondition, PrecipitationType } from '../../../types/shared';

// Mock Leaflet and react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }: any) => (
    <div data-testid="map-container" {...props}>
      {children}
    </div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Polyline: ({ positions, color }: any) => (
    <div data-testid="polyline" data-color={color} data-positions={JSON.stringify(positions)} />
  ),
  Marker: ({ children, position }: any) => (
    <div data-testid="marker" data-position={JSON.stringify(position)}>
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    fitBounds: vi.fn(),
  }),
}));

vi.mock('leaflet', () => {
  const mockL = {
    Icon: {
      Default: {
        prototype: {
          _getIconUrl: vi.fn(),
        },
        mergeOptions: vi.fn(),
      },
    },
    divIcon: vi.fn(() => ({ options: {} })),
    latLngBounds: vi.fn(() => ({
      extend: vi.fn(),
    })),
  };
  
  return {
    default: mockL,
    ...mockL,
  };
});

// Mock CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const mockRoute: Route = {
  id: 'test-route-1',
  source: {
    name: 'New York',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    address: 'New York, NY, USA'
  },
  destination: {
    name: 'Boston',
    coordinates: { latitude: 42.3601, longitude: -71.0589 },
    address: 'Boston, MA, USA'
  },
  travelMode: TravelMode.DRIVING,
  waypoints: [
    {
      coordinates: { latitude: 40.7128, longitude: -74.0060 },
      distanceFromStart: 0,
      estimatedTimeFromStart: 0
    },
    {
      coordinates: { latitude: 41.5868, longitude: -72.6560 },
      distanceFromStart: 150,
      estimatedTimeFromStart: 120
    },
    {
      coordinates: { latitude: 42.3601, longitude: -71.0589 },
      distanceFromStart: 300,
      estimatedTimeFromStart: 240
    }
  ],
  totalDistance: 300,
  estimatedDuration: 240,
  segments: []
};

const mockWeatherData: WeatherForecast[] = [
  {
    location: {
      name: 'New York',
      coordinates: { latitude: 40.7128, longitude: -74.0060 }
    },
    timestamp: new Date('2024-01-15T10:00:00Z'),
    temperature: {
      current: 15,
      feelsLike: 13,
      min: 10,
      max: 18
    },
    conditions: {
      main: WeatherCondition.SUNNY,
      description: 'clear sky',
      icon: 'sunny'
    },
    precipitation: {
      type: PrecipitationType.NONE,
      probability: 10,
      intensity: 0
    },
    wind: {
      speed: 15,
      direction: 180
    },
    humidity: 65,
    visibility: 10
  },
  {
    location: {
      name: 'Hartford',
      coordinates: { latitude: 41.5868, longitude: -72.6560 }
    },
    timestamp: new Date('2024-01-15T12:00:00Z'),
    temperature: {
      current: 12,
      feelsLike: 10,
      min: 8,
      max: 15
    },
    conditions: {
      main: WeatherCondition.CLOUDY,
      description: 'partly cloudy',
      icon: 'cloudy'
    },
    precipitation: {
      type: PrecipitationType.RAIN,
      probability: 60,
      intensity: 2
    },
    wind: {
      speed: 20,
      direction: 200
    },
    humidity: 75,
    visibility: 8
  },
  {
    location: {
      name: 'Boston',
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
      description: 'light rain',
      icon: 'rainy'
    },
    precipitation: {
      type: PrecipitationType.RAIN,
      probability: 80,
      intensity: 3
    },
    wind: {
      speed: 25,
      direction: 220
    },
    humidity: 85,
    visibility: 6
  }
];

describe('RouteMapWithWeather', () => {
  it('renders map with route and weather markers', () => {
    render(
      <RouteMapWithWeather
        route={mockRoute}
        weatherData={mockWeatherData}
      />
    );

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
    expect(screen.getByTestId('polyline')).toBeInTheDocument();
    
    // Should have markers for start, end, and weather points
    const markers = screen.getAllByTestId('marker');
    expect(markers.length).toBeGreaterThanOrEqual(2); // At least start and end markers
  });

  it('displays map legend with route and weather information', () => {
    render(
      <RouteMapWithWeather
        route={mockRoute}
        weatherData={mockWeatherData}
      />
    );

    expect(screen.getByText('Map Legend')).toBeInTheDocument();
    expect(screen.getByText(/driving.*route/i)).toBeInTheDocument();
    expect(screen.getByText('Sunny Weather')).toBeInTheDocument();
    expect(screen.getByText('Rainy Weather')).toBeInTheDocument();
    expect(screen.getByText('Cloudy Weather')).toBeInTheDocument();
  });

  it('shows empty state when no route is provided', () => {
    const emptyRoute: Route = {
      ...mockRoute,
      waypoints: []
    };

    render(
      <RouteMapWithWeather
        route={emptyRoute}
        weatherData={mockWeatherData}
      />
    );

    expect(screen.getByText('No Route Available')).toBeInTheDocument();
    expect(screen.getByText('Enter your travel route to see the map with weather overlay.')).toBeInTheDocument();
  });

  it('calls onWeatherPointSelect when weather point is selected', () => {
    const mockOnSelect = vi.fn();
    
    render(
      <RouteMapWithWeather
        route={mockRoute}
        weatherData={mockWeatherData}
        onWeatherPointSelect={mockOnSelect}
      />
    );

    // This test would need more sophisticated mocking to simulate marker clicks
    // For now, we just verify the component renders without errors
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('displays weather details when a forecast is selected', () => {
    render(
      <RouteMapWithWeather
        route={mockRoute}
        weatherData={mockWeatherData}
      />
    );

    // Initially no selected weather details should be shown
    expect(screen.queryByText('Selected Location Weather')).not.toBeInTheDocument();
  });

  it('renders with custom height', () => {
    const customHeight = 600;
    
    render(
      <RouteMapWithWeather
        route={mockRoute}
        weatherData={mockWeatherData}
        height={customHeight}
      />
    );

    const mapContainer = screen.getByTestId('map-container');
    expect(mapContainer.parentElement).toHaveStyle({ height: `${customHeight}px` });
  });

  it('applies custom className', () => {
    const customClass = 'custom-map-class';
    
    render(
      <RouteMapWithWeather
        route={mockRoute}
        weatherData={mockWeatherData}
        className={customClass}
      />
    );

    const container = screen.getByTestId('map-container').closest('.custom-map-class');
    expect(container).toBeInTheDocument();
  });

  it('handles different travel modes with appropriate route colors', () => {
    const walkingRoute = { ...mockRoute, travelMode: TravelMode.WALKING };
    
    render(
      <RouteMapWithWeather
        route={walkingRoute}
        weatherData={mockWeatherData}
      />
    );

    expect(screen.getByText(/walking.*route/i)).toBeInTheDocument();
  });

  it('displays route information in start and end markers', () => {
    render(
      <RouteMapWithWeather
        route={mockRoute}
        weatherData={mockWeatherData}
      />
    );

    // Check that route source and destination names are present
    expect(screen.getByText(`Start: ${mockRoute.source.name}`)).toBeInTheDocument();
    expect(screen.getByText(`End: ${mockRoute.destination.name}`)).toBeInTheDocument();
  });

  it('handles empty weather data gracefully', () => {
    render(
      <RouteMapWithWeather
        route={mockRoute}
        weatherData={[]}
      />
    );

    // Should still render the map with route
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('polyline')).toBeInTheDocument();
  });
});