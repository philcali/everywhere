import React, { useState } from 'react';
import { SavedJourney, WeatherCondition, PrecipitationType, TravelMode } from '../../types/shared';

interface JourneyDetailProps {
  journey: SavedJourney;
  onClose: () => void;
  onEdit?: (journey: SavedJourney) => void;
  onDelete?: () => void;
  onExport?: () => void;
}

const JourneyDetail: React.FC<JourneyDetailProps> = ({
  journey,
  onClose,
  onEdit,
  onDelete,
  onExport
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'weather' | 'route'>('overview');
  const [weatherTimeIndex, setWeatherTimeIndex] = useState(0);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDistance = (distance: number) => {
    if (distance < 1000) {
      return `${Math.round(distance)} m`;
    }
    return `${(distance / 1000).toFixed(1)} km`;
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
      case TravelMode.DRIVING: return '🚗';
      case TravelMode.WALKING: return '🚶';
      case TravelMode.CYCLING: return '🚴';
      case TravelMode.FLYING: return '✈️';
      case TravelMode.SAILING: return '⛵';
      case TravelMode.CRUISE: return '🚢';
      default: return '🚗';
    }
  };

  const getWeatherIcon = (condition: WeatherCondition) => {
    switch (condition) {
      case WeatherCondition.SUNNY: return '☀️';
      case WeatherCondition.CLOUDY: return '☁️';
      case WeatherCondition.OVERCAST: return '☁️';
      case WeatherCondition.RAINY: return '🌧️';
      case WeatherCondition.STORMY: return '⛈️';
      case WeatherCondition.FOGGY: return '🌫️';
      case WeatherCondition.SNOWY: return '❄️';
      default: return '☀️';
    }
  };

  const getPrecipitationIcon = (type: PrecipitationType) => {
    switch (type) {
      case PrecipitationType.RAIN: return '🌧️';
      case PrecipitationType.SLEET: return '🌨️';
      case PrecipitationType.SNOW: return '❄️';
      case PrecipitationType.HAIL: return '🧊';
      default: return '';
    }
  };

  const getWeatherStats = () => {
    if (journey.weatherData.length === 0) return null;
    
    const temps = journey.weatherData.map(w => w.temperature.current);
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    
    const conditions = journey.weatherData.map(w => w.conditions.main);
    const conditionCounts = conditions.reduce((acc, condition) => {
      acc[condition] = (acc[condition] || 0) + 1;
      return acc;
    }, {} as Record<WeatherCondition, number>);
    
    const dominantCondition = Object.entries(conditionCounts).reduce((a, b) => 
      conditionCounts[a[0] as WeatherCondition] > conditionCounts[b[0] as WeatherCondition] ? a : b
    )[0] as WeatherCondition;
    
    const precipitationDays = journey.weatherData.filter(w => 
      w.precipitation.type !== PrecipitationType.NONE && w.precipitation.probability > 0.3
    ).length;
    
    return {
      avgTemp: Math.round(avgTemp),
      minTemp: Math.round(minTemp),
      maxTemp: Math.round(maxTemp),
      dominantCondition,
      precipitationDays,
      totalDays: journey.weatherData.length
    };
  };

  const weatherStats = getWeatherStats();
  const currentWeather = journey.weatherData[weatherTimeIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{journey.name}</h2>
            <p className="text-gray-600 mt-1">
              {journey.route.source.name} → {journey.route.destination.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onExport && (
              <button
                onClick={onExport}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Export journey"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(journey)}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                title="Edit journey"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete journey"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'weather', label: 'Weather Replay' },
              { id: 'route', label: 'Route Details' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Journey Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getTravelModeIcon(journey.travelConfig.mode)}</span>
                      <div>
                        <p className="font-medium capitalize">{journey.travelConfig.mode}</p>
                        <p className="text-sm text-gray-600">Travel Mode</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <div>
                        <p className="font-medium">{formatDistance(journey.route.totalDistance)}</p>
                        <p className="text-sm text-gray-600">Total Distance</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-medium">{formatDuration(journey.route.estimatedDuration)}</p>
                        <p className="text-sm text-gray-600">Estimated Duration</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Weather Summary</h3>
                  {weatherStats ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getWeatherIcon(weatherStats.dominantCondition)}</span>
                        <div>
                          <p className="font-medium capitalize">{weatherStats.dominantCondition}</p>
                          <p className="text-sm text-gray-600">Dominant Condition</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 0V12m0-7.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        </svg>
                        <div>
                          <p className="font-medium">{weatherStats.avgTemp}°C avg ({weatherStats.minTemp}° - {weatherStats.maxTemp}°)</p>
                          <p className="text-sm text-gray-600">Temperature Range</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🌧️</span>
                        <div>
                          <p className="font-medium">{weatherStats.precipitationDays} of {weatherStats.totalDays} points</p>
                          <p className="text-sm text-gray-600">Precipitation Expected</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-600">No weather data available</p>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-medium">{formatDate(journey.createdAt)}</p>
                  </div>
                  {journey.metadata.actualTravelDate && (
                    <div>
                      <p className="text-sm text-gray-600">Travel Date</p>
                      <p className="font-medium">{formatDate(journey.metadata.actualTravelDate)}</p>
                    </div>
                  )}
                  {journey.metadata.rating && journey.metadata.rating > 0 && (
                    <div>
                      <p className="text-sm text-gray-600">Rating</p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-lg ${star <= journey.metadata.rating! ? 'text-yellow-400' : 'text-gray-300'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {journey.metadata.tags.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {journey.metadata.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {journey.description && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Description</p>
                    <p className="text-gray-900">{journey.description}</p>
                  </div>
                )}

                {journey.metadata.notes && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Notes</p>
                    <p className="text-gray-900">{journey.metadata.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'weather' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Weather Replay</h3>
                {journey.weatherData.length > 1 && (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setWeatherTimeIndex(Math.max(0, weatherTimeIndex - 1))}
                      disabled={weatherTimeIndex === 0}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm text-gray-600">
                      {weatherTimeIndex + 1} of {journey.weatherData.length}
                    </span>
                    <button
                      onClick={() => setWeatherTimeIndex(Math.min(journey.weatherData.length - 1, weatherTimeIndex + 1))}
                      disabled={weatherTimeIndex === journey.weatherData.length - 1}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {currentWeather ? (
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-6xl mb-2">{getWeatherIcon(currentWeather.conditions.main)}</div>
                      <p className="text-lg font-semibold capitalize">{currentWeather.conditions.main}</p>
                      <p className="text-sm text-gray-600">{currentWeather.conditions.description}</p>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Temperature</p>
                        <p className="text-2xl font-bold">{Math.round(currentWeather.temperature.current)}°C</p>
                        <p className="text-sm text-gray-600">
                          Feels like {Math.round(currentWeather.temperature.feelsLike)}°C
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Range</p>
                        <p className="font-medium">
                          {Math.round(currentWeather.temperature.min)}° - {Math.round(currentWeather.temperature.max)}°C
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Wind</p>
                        <p className="font-medium">{currentWeather.wind.speed} km/h</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Humidity</p>
                        <p className="font-medium">{currentWeather.humidity}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Visibility</p>
                        <p className="font-medium">{currentWeather.visibility} km</p>
                      </div>
                    </div>
                  </div>
                  
                  {currentWeather.precipitation.type !== PrecipitationType.NONE && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getPrecipitationIcon(currentWeather.precipitation.type)}</span>
                        <div>
                          <p className="font-medium capitalize">{currentWeather.precipitation.type}</p>
                          <p className="text-sm text-gray-600">
                            {Math.round(currentWeather.precipitation.probability * 100)}% chance, 
                            intensity: {currentWeather.precipitation.intensity}/10
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">Location & Time</p>
                    <p className="font-medium">{currentWeather.location.name}</p>
                    <p className="text-sm text-gray-600">{formatDate(currentWeather.timestamp)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">No weather data available</p>
              )}

              {journey.weatherData.length > 1 && (
                <div className="mt-6">
                  <input
                    type="range"
                    min="0"
                    max={journey.weatherData.length - 1}
                    value={weatherTimeIndex}
                    onChange={(e) => setWeatherTimeIndex(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'route' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Route Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Source</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="font-medium">{journey.route.source.name}</p>
                    {journey.route.source.address && (
                      <p className="text-sm text-gray-600 mt-1">{journey.route.source.address}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {journey.route.source.coordinates.latitude.toFixed(6)}, {journey.route.source.coordinates.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Destination</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="font-medium">{journey.route.destination.name}</p>
                    {journey.route.destination.address && (
                      <p className="text-sm text-gray-600 mt-1">{journey.route.destination.address}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {journey.route.destination.coordinates.latitude.toFixed(6)}, {journey.route.destination.coordinates.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>

              {journey.route.waypoints.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Waypoints ({journey.route.waypoints.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {journey.route.waypoints.map((waypoint, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 rounded p-3">
                        <div>
                          <p className="text-sm font-medium">Waypoint {index + 1}</p>
                          <p className="text-xs text-gray-500">
                            {waypoint.coordinates.latitude.toFixed(6)}, {waypoint.coordinates.longitude.toFixed(6)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{formatDistance(waypoint.distanceFromStart)}</p>
                          <p className="text-xs text-gray-500">{formatDuration(waypoint.estimatedTimeFromStart)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {journey.route.segments.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Route Segments</h4>
                  <div className="space-y-2">
                    {journey.route.segments.map((segment, index) => (
                      <div key={index} className="bg-gray-50 rounded p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Segment {index + 1}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>{formatDistance(segment.distance)}</span>
                            <span>{formatDuration(segment.estimatedDuration)}</span>
                            <span className="capitalize">{segment.travelMode}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JourneyDetail;