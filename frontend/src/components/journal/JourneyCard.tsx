import React from 'react';
import { SavedJourney, TravelMode, WeatherCondition } from '../../types/shared';

interface JourneyCardProps {
  journey: SavedJourney;
  onClick: () => void;
  onDelete?: () => void;
  onCompare?: () => void;
  isSelected?: boolean;
}

const JourneyCard: React.FC<JourneyCardProps> = ({
  journey,
  onClick,
  onDelete,
  onCompare,
  isSelected = false
}) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDistance = (distance: number) => {
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  };

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getTravelModeIcon = (mode: TravelMode) => {
    switch (mode) {
      case TravelMode.DRIVING:
        return '🚗';
      case TravelMode.WALKING:
        return '🚶';
      case TravelMode.CYCLING:
        return '🚴';
      case TravelMode.FLYING:
        return '✈️';
      case TravelMode.SAILING:
        return '⛵';
      case TravelMode.CRUISE:
        return '🚢';
      default:
        return '🚗';
    }
  };

  const getWeatherIcon = (condition: WeatherCondition) => {
    switch (condition) {
      case WeatherCondition.SUNNY:
        return '☀️';
      case WeatherCondition.CLOUDY:
        return '☁️';
      case WeatherCondition.OVERCAST:
        return '☁️';
      case WeatherCondition.RAINY:
        return '🌧️';
      case WeatherCondition.STORMY:
        return '⛈️';
      case WeatherCondition.FOGGY:
        return '🌫️';
      case WeatherCondition.SNOWY:
        return '❄️';
      default:
        return '☀️';
    }
  };

  const getAverageTemperature = () => {
    if (journey.weatherData.length === 0) return null;
    const sum = journey.weatherData.reduce((acc, weather) => acc + weather.temperature.current, 0);
    return Math.round(sum / journey.weatherData.length);
  };

  const getDominantWeatherCondition = () => {
    if (journey.weatherData.length === 0) return null;
    const conditions = journey.weatherData.map(w => w.conditions.main);
    const conditionCounts = conditions.reduce((acc, condition) => {
      acc[condition] = (acc[condition] || 0) + 1;
      return acc;
    }, {} as Record<WeatherCondition, number>);
    
    return Object.entries(conditionCounts).reduce((a, b) => 
      conditionCounts[a[0] as WeatherCondition] > conditionCounts[b[0] as WeatherCondition] ? a : b
    )[0] as WeatherCondition;
  };

  const avgTemp = getAverageTemperature();
  const dominantWeather = getDominantWeatherCondition();

  return (
    <div 
      className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
      }`}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">{journey.name}</h3>
            <p className="text-sm text-gray-600">
              {journey.route.source.name} → {journey.route.destination.name}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {onCompare && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCompare();
                }}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                title="Compare journey"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete journey"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
          <div className="flex items-center gap-1">
            <span>{getTravelModeIcon(journey.travelConfig.mode)}</span>
            <span className="capitalize">{journey.travelConfig.mode}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>{formatDistance(journey.route.totalDistance)}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatDuration(journey.route.estimatedDuration)}</span>
          </div>
        </div>

        {(avgTemp !== null || dominantWeather) && (
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
            {avgTemp !== null && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 0V12m0-7.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                </svg>
                <span>{avgTemp}°C avg</span>
              </div>
            )}
            {dominantWeather && (
              <div className="flex items-center gap-1">
                <span>{getWeatherIcon(dominantWeather)}</span>
                <span className="capitalize">{dominantWeather}</span>
              </div>
            )}
          </div>
        )}

        {journey.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {journey.metadata.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {journey.metadata.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                +{journey.metadata.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>Created {formatDate(journey.createdAt)}</span>
            {journey.metadata.actualTravelDate && (
              <span>Traveled {formatDate(journey.metadata.actualTravelDate)}</span>
            )}
          </div>
          {journey.metadata.rating && journey.metadata.rating > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-yellow-400">★</span>
              <span>{journey.metadata.rating}/5</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JourneyCard;