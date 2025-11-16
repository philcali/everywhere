import React, { useState } from 'react';
import { SavedJourney, WeatherCondition, PrecipitationType, TravelMode } from '../../types/shared';

interface JourneyComparisonProps {
  journeys: SavedJourney[];
  onClose: () => void;
}

const JourneyComparison: React.FC<JourneyComparisonProps> = ({
  journeys,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'weather' | 'routes'>('overview');

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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

  const getJourneyStats = (journey: SavedJourney) => {
    const weatherData = journey.weatherData;
    
    if (weatherData.length === 0) {
      return {
        avgTemp: null,
        minTemp: null,
        maxTemp: null,
        dominantCondition: null,
        precipitationDays: 0,
        totalWeatherPoints: 0
      };
    }
    
    const temps = weatherData.map(w => w.temperature.current);
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    
    const conditions = weatherData.map(w => w.conditions.main);
    const conditionCounts = conditions.reduce((acc, condition) => {
      acc[condition] = (acc[condition] || 0) + 1;
      return acc;
    }, {} as Record<WeatherCondition, number>);
    
    const dominantCondition = Object.entries(conditionCounts).reduce((a, b) => 
      conditionCounts[a[0] as WeatherCondition] > conditionCounts[b[0] as WeatherCondition] ? a : b
    )[0] as WeatherCondition;
    
    const precipitationDays = weatherData.filter(w => 
      w.precipitation.type !== PrecipitationType.NONE && w.precipitation.probability > 0.3
    ).length;
    
    return {
      avgTemp: Math.round(avgTemp),
      minTemp: Math.round(minTemp),
      maxTemp: Math.round(maxTemp),
      dominantCondition,
      precipitationDays,
      totalWeatherPoints: weatherData.length
    };
  };

  const getComparisonInsights = () => {
    const stats = journeys.map(getJourneyStats);
    
    // Find extremes
    const distances = journeys.map(j => j.route.totalDistance);
    const durations = journeys.map(j => j.route.estimatedDuration);
    const avgTemps = stats.map(s => s.avgTemp).filter(t => t !== null) as number[];
    
    const longestJourney = journeys[distances.indexOf(Math.max(...distances))];
    const shortestJourney = journeys[distances.indexOf(Math.min(...distances))];
    const fastestJourney = journeys[durations.indexOf(Math.min(...durations))];
    const slowestJourney = journeys[durations.indexOf(Math.max(...durations))];
    
    const insights = [];
    
    if (longestJourney.id !== shortestJourney.id) {
      insights.push(`${longestJourney.name} is the longest journey at ${formatDistance(longestJourney.route.totalDistance)}`);
      insights.push(`${shortestJourney.name} is the shortest journey at ${formatDistance(shortestJourney.route.totalDistance)}`);
    }
    
    if (fastestJourney.id !== slowestJourney.id) {
      insights.push(`${fastestJourney.name} is the fastest journey at ${formatDuration(fastestJourney.route.estimatedDuration)}`);
      insights.push(`${slowestJourney.name} takes the longest at ${formatDuration(slowestJourney.route.estimatedDuration)}`);
    }
    
    if (avgTemps.length > 1) {
      const warmestIndex = avgTemps.indexOf(Math.max(...avgTemps));
      const coldestIndex = avgTemps.indexOf(Math.min(...avgTemps));
      const warmestJourney = journeys[warmestIndex];
      const coldestJourney = journeys[coldestIndex];
      
      if (warmestJourney.id !== coldestJourney.id) {
        insights.push(`${warmestJourney.name} had the warmest weather (${avgTemps[warmestIndex]}°C avg)`);
        insights.push(`${coldestJourney.name} had the coldest weather (${avgTemps[coldestIndex]}°C avg)`);
      }
    }
    
    return insights;
  };

  const insights = getComparisonInsights();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Journey Comparison</h2>
            <p className="text-gray-600 mt-1">Comparing {journeys.length} journeys</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'weather', label: 'Weather Comparison' },
              { id: 'routes', label: 'Route Comparison' }
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
              {/* Insights */}
              {insights.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Key Insights</h3>
                  <ul className="space-y-1">
                    {insights.map((insight, index) => (
                      <li key={index} className="text-blue-800 text-sm">• {insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Journey Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {journeys.map((journey) => {
                  const stats = getJourneyStats(journey);
                  return (
                    <div key={journey.id} className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">{journey.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {journey.route.source.name} → {journey.route.destination.name}
                      </p>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Mode:</span>
                          <div className="flex items-center gap-1">
                            <span>{getTravelModeIcon(journey.travelConfig.mode)}</span>
                            <span className="capitalize">{journey.travelConfig.mode}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Distance:</span>
                          <span className="font-medium">{formatDistance(journey.route.totalDistance)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium">{formatDuration(journey.route.estimatedDuration)}</span>
                        </div>
                        
                        {stats.avgTemp !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Avg Temp:</span>
                            <span className="font-medium">{stats.avgTemp}°C</span>
                          </div>
                        )}
                        
                        {stats.dominantCondition && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Weather:</span>
                            <div className="flex items-center gap-1">
                              <span>{getWeatherIcon(stats.dominantCondition)}</span>
                              <span className="capitalize">{stats.dominantCondition}</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Created:</span>
                          <span className="font-medium">{formatDate(journey.createdAt)}</span>
                        </div>
                        
                        {journey.metadata.rating && journey.metadata.rating > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Rating:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-yellow-400">★</span>
                              <span>{journey.metadata.rating}/5</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'weather' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Weather Comparison</h3>
              
              {/* Weather Stats Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Journey
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Temp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Temp Range
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dominant Weather
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Precipitation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {journeys.map((journey) => {
                      const stats = getJourneyStats(journey);
                      return (
                        <tr key={journey.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{journey.name}</div>
                              <div className="text-sm text-gray-500">{journey.travelConfig.mode}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {stats.avgTemp !== null ? `${stats.avgTemp}°C` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {stats.minTemp !== null && stats.maxTemp !== null 
                              ? `${stats.minTemp}° - ${stats.maxTemp}°C` 
                              : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {stats.dominantCondition ? (
                              <div className="flex items-center gap-2">
                                <span>{getWeatherIcon(stats.dominantCondition)}</span>
                                <span className="text-sm text-gray-900 capitalize">{stats.dominantCondition}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {stats.totalWeatherPoints > 0 
                              ? `${stats.precipitationDays}/${stats.totalWeatherPoints} points`
                              : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'routes' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Route Comparison</h3>
              
              {/* Route Stats Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Journey
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Route
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Distance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Waypoints
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Speed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {journeys.map((journey) => {
                      const avgSpeed = journey.route.estimatedDuration > 0 
                        ? (journey.route.totalDistance / 1000) / (journey.route.estimatedDuration / 3600)
                        : 0;
                      
                      return (
                        <tr key={journey.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{journey.name}</div>
                              <div className="flex items-center gap-1 text-sm text-gray-500">
                                <span>{getTravelModeIcon(journey.travelConfig.mode)}</span>
                                <span className="capitalize">{journey.travelConfig.mode}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              <div>{journey.route.source.name}</div>
                              <div className="text-gray-500">↓</div>
                              <div>{journey.route.destination.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDistance(journey.route.totalDistance)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDuration(journey.route.estimatedDuration)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {journey.route.waypoints.length}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {avgSpeed > 0 ? `${avgSpeed.toFixed(1)} km/h` : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Route Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {journeys.map((journey) => (
                  <div key={journey.id} className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">{journey.name}</h4>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Source:</span>
                        <p className="font-medium">{journey.route.source.name}</p>
                        {journey.route.source.address && (
                          <p className="text-gray-500 text-xs">{journey.route.source.address}</p>
                        )}
                      </div>
                      
                      <div>
                        <span className="text-gray-600">Destination:</span>
                        <p className="font-medium">{journey.route.destination.name}</p>
                        {journey.route.destination.address && (
                          <p className="text-gray-500 text-xs">{journey.route.destination.address}</p>
                        )}
                      </div>
                      
                      {journey.route.segments.length > 0 && (
                        <div>
                          <span className="text-gray-600">Segments:</span>
                          <div className="mt-1 space-y-1">
                            {journey.route.segments.map((segment, index) => (
                              <div key={index} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                                <span>Segment {index + 1}</span>
                                <span>{formatDistance(segment.distance)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JourneyComparison;