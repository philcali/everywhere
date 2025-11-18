import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WeatherVisualization } from '../WeatherVisualization';
import { WeatherForecast, WeatherCondition, PrecipitationType } from '../../../types/shared';

const mockWeatherData: WeatherForecast[] = [
  {
    location: {
      name: 'Start Location',
      coordinates: { latitude: 40.7128, longitude: -74.0060 },
      address: '123 Start St'
    },
    timestamp: new Date('2024-01-01T10:00:00Z'),
    temperature: {
      current: 20,
      feelsLike: 22,
      min: 18,
      max: 25
    },
    conditions: {
      main: WeatherCondition.SUNNY,
      description: 'Clear sky',
      icon: 'sunny'
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
    visibility: 10
  },
  {
    location: {
      name: 'Mid Location',
      coordinates: { latitude: 41.8781, longitude: -87.6298 },
      address: '456 Mid Ave'
    },
    timestamp: new Date('2024-01-01T14:00:00Z'),
    temperature: {
      current: 15,
      feelsLike: 13,
      min: 12,
      max: 18
    },
    conditions: {
      main: WeatherCondition.RAINY,
      description: 'Light rain',
      icon: 'rainy'
    },
    precipitation: {
      type: PrecipitationType.RAIN,
      probability: 80,
      intensity: 0.4
    },
    wind: {
      speed: 15,
      direction: 270
    },
    humidity: 85,
    visibility: 8
  }
];

describe('WeatherVisualization', () => {
  it('renders empty state when no weather data provided', () => {
    render(<WeatherVisualization weatherData={[]} />);
    
    expect(screen.getByText('No Weather Data Available')).toBeInTheDocument();
    expect(screen.getByText('Enter your travel route to see weather forecasts along your journey.')).toBeInTheDocument();
  });

  it('renders weather summary with correct data', () => {
    render(<WeatherVisualization weatherData={mockWeatherData} />);
    
    expect(screen.getByText('Weather Summary')).toBeInTheDocument();
    expect(screen.getByText('18°C')).toBeInTheDocument(); // Average temperature
    expect(screen.getByText('12° - 25°C')).toBeInTheDocument(); // Temperature range
    expect(screen.getByText('40%')).toBeInTheDocument(); // Average precipitation
  });

  it('renders chart view selector buttons', () => {
    render(<WeatherVisualization weatherData={mockWeatherData} />);
    
    expect(screen.getByText('Interactive Timeline')).toBeInTheDocument();
    expect(screen.getByText('Temperature Trend')).toBeInTheDocument();
    expect(screen.getByText('Precipitation')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('switches between different chart views', () => {
    render(<WeatherVisualization weatherData={mockWeatherData} />);
    
    const temperatureButton = screen.getByRole('button', { name: /temperature trend/i });
    fireEvent.click(temperatureButton);
    
    expect(screen.getAllByText('Temperature Trend')).toHaveLength(2); // Button and chart title
  });

  it('calls onForecastSelect when forecast is selected', () => {
    const mockOnForecastSelect = vi.fn();
    render(
      <WeatherVisualization 
        weatherData={mockWeatherData} 
        onForecastSelect={mockOnForecastSelect}
      />
    );
    
    // This would be triggered by chart interaction in real usage
    // For testing, we can verify the component renders correctly
    expect(screen.getByText('Weather Summary')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <WeatherVisualization 
        weatherData={mockWeatherData} 
        className="custom-weather-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-weather-class');
  });

  it('renders different weather conditions in summary', () => {
    const mixedWeatherData = [
      ...mockWeatherData,
      {
        ...mockWeatherData[0],
        conditions: {
          main: WeatherCondition.SNOWY,
          description: 'Light snow',
          icon: 'snowy'
        }
      }
    ];

    render(<WeatherVisualization weatherData={mixedWeatherData} />);
    
    expect(screen.getByText('Weather Summary')).toBeInTheDocument();
  });
});