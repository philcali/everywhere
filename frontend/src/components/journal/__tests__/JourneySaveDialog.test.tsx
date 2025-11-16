// React is imported automatically by Vite
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import JourneySaveDialog from '../JourneySaveDialog';
import { Route, WeatherForecast, TravelConfig, TravelMode, WeatherCondition, PrecipitationType } from '../../../types/shared';

const mockRoute: Route = {
  id: 'test-route',
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
  waypoints: [],
  totalDistance: 300000,
  estimatedDuration: 14400,
  segments: []
};

const mockWeatherData: WeatherForecast[] = [
  {
    location: mockRoute.source,
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
  }
];

const mockTravelConfig: TravelConfig = {
  mode: TravelMode.DRIVING,
  preferences: {
    weatherUpdateInterval: 3600,
    routeOptimization: true
  }
};

describe('JourneySaveDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(
      <JourneySaveDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        route={mockRoute}
        weatherData={mockWeatherData}
        travelConfig={mockTravelConfig}
      />
    );

    expect(screen.getByRole('heading', { name: 'Save Journey' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('New York to Boston')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <JourneySaveDialog
        isOpen={false}
        onClose={mockOnClose}
        onSave={mockOnSave}
        route={mockRoute}
        weatherData={mockWeatherData}
        travelConfig={mockTravelConfig}
      />
    );

    expect(screen.queryByText('Save Journey')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(
      <JourneySaveDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        route={mockRoute}
        weatherData={mockWeatherData}
        travelConfig={mockTravelConfig}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', () => {
    render(
      <JourneySaveDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        route={mockRoute}
        weatherData={mockWeatherData}
        travelConfig={mockTravelConfig}
      />
    );

    // Find the close button by looking for all buttons and finding the one with SVG
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(button => button.querySelector('svg'));
    if (closeButton) {
      fireEvent.click(closeButton);
    }
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('allows adding and removing tags', () => {
    render(
      <JourneySaveDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        route={mockRoute}
        weatherData={mockWeatherData}
        travelConfig={mockTravelConfig}
      />
    );

    const tagInput = screen.getByPlaceholderText('Add a tag...');
    const addButton = screen.getByText('Add');

    // Add a tag
    fireEvent.change(tagInput, { target: { value: 'business' } });
    fireEvent.click(addButton);

    expect(screen.getByText('business')).toBeInTheDocument();

    // Remove the tag
    const removeButton = screen.getByText('×');
    fireEvent.click(removeButton);

    expect(screen.queryByText('business')).not.toBeInTheDocument();
  });

  it('allows setting rating', () => {
    render(
      <JourneySaveDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        route={mockRoute}
        weatherData={mockWeatherData}
        travelConfig={mockTravelConfig}
      />
    );

    const stars = screen.getAllByText('★');
    fireEvent.click(stars[3]); // Click 4th star (4-star rating)

    // Check that first 4 stars are highlighted
    expect(stars[0]).toHaveClass('text-yellow-400');
    expect(stars[1]).toHaveClass('text-yellow-400');
    expect(stars[2]).toHaveClass('text-yellow-400');
    expect(stars[3]).toHaveClass('text-yellow-400');
    expect(stars[4]).toHaveClass('text-gray-300');
  });

  it('submits form with correct data', async () => {
    mockOnSave.mockResolvedValue(undefined);

    render(
      <JourneySaveDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        route={mockRoute}
        weatherData={mockWeatherData}
        travelConfig={mockTravelConfig}
      />
    );

    // Fill form
    const nameInput = screen.getByDisplayValue('New York to Boston');
    fireEvent.change(nameInput, { target: { value: 'My Test Journey' } });

    const descriptionInput = screen.getByPlaceholderText('Optional description of your journey...');
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Save Journey' }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'My Test Journey',
        description: 'Test description',
        route: mockRoute,
        weatherData: mockWeatherData,
        travelConfig: mockTravelConfig,
        metadata: {
          actualTravelDate: undefined,
          tags: [],
          rating: undefined,
          notes: undefined
        }
      });
    });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows error when save fails', async () => {
    mockOnSave.mockRejectedValue(new Error('Save failed'));

    render(
      <JourneySaveDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        route={mockRoute}
        weatherData={mockWeatherData}
        travelConfig={mockTravelConfig}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Journey' }));

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('disables form during save', async () => {
    mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <JourneySaveDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        route={mockRoute}
        weatherData={mockWeatherData}
        travelConfig={mockTravelConfig}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Journey' }));

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByDisplayValue('New York to Boston')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});