import React, { useState } from 'react';
import { WeatherForecast, WeatherCondition, PrecipitationType } from '../../types/shared';
import { WeatherTimelineChart } from './WeatherTimelineChart';
import { TemperatureTrendChart } from './TemperatureTrendChart';
import { PrecipitationChart } from './PrecipitationChart';
import { WeatherIconDisplay } from './WeatherIconDisplay';

interface WeatherVisualizationProps {
  weatherData: WeatherForecast[];
  className?: string;
  onForecastSelect?: (forecast: WeatherForecast) => void;
}

type ChartView = 'timeline' | 'temperature' | 'precipitation' | 'overview';

export const WeatherVisualization: React.FC<WeatherVisualizationProps> = ({
  weatherData,
  className = '',
  onForecastSelect
}) => {
  const [activeView, setActiveView] = useState<ChartView>('timeline');
  const [selectedForecast, setSelectedForecast] = useState<WeatherForecast | null>(null);

  if (!weatherData || weatherData.length === 0) {
    return (
      <div className={`w-full p-8 text-center ${className}`}>
        <div className="text-gray-500">
          <WeatherIconDisplay condition={WeatherCondition.SUNNY} precipitationType={PrecipitationType.NONE} size={48} className="mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Weather Data Available</h3>
          <p className="text-sm">Enter your travel route to see weather forecasts along your journey.</p>
        </div>
      </div>
    );
  }

  const handleForecastSelect = (forecast: WeatherForecast) => {
    setSelectedForecast(forecast);
    if (onForecastSelect) {
      onForecastSelect(forecast);
    }
  };

  const getWeatherSummary = () => {
    if (weatherData.length === 0) return null;

    const avgTemp = weatherData.reduce((sum, w) => sum + w.temperature.current, 0) / weatherData.length;
    const maxTemp = Math.max(...weatherData.map(w => w.temperature.max));
    const minTemp = Math.min(...weatherData.map(w => w.temperature.min));
    const avgPrecipitation = weatherData.reduce((sum, w) => sum + w.precipitation.probability, 0) / weatherData.length;
    const conditions = weatherData.map(w => w.conditions.main);
    const mostCommonCondition = conditions.sort((a, b) =>
      conditions.filter(v => v === a).length - conditions.filter(v => v === b).length
    ).pop();

    return {
      avgTemp: Math.round(avgTemp),
      maxTemp,
      minTemp,
      avgPrecipitation: Math.round(avgPrecipitation),
      mostCommonCondition
    };
  };

  const summary = getWeatherSummary();

  const renderChart = () => {
    switch (activeView) {
      case 'timeline':
        return (
          <WeatherTimelineChart
            weatherData={weatherData}
            onTimePointSelect={handleForecastSelect}
            height={400}
          />
        );
      case 'temperature':
        return (
          <TemperatureTrendChart
            weatherData={weatherData}
            showFeelsLike={true}
            showMinMax={true}
            height={350}
          />
        );
      case 'precipitation':
        return (
          <PrecipitationChart
            weatherData={weatherData}
            height={300}
          />
        );
      case 'overview':
        return (
          <div className="space-y-6">
            <TemperatureTrendChart
              weatherData={weatherData}
              showFeelsLike={false}
              showMinMax={false}
              height={200}
            />
            <PrecipitationChart
              weatherData={weatherData}
              height={200}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Weather Summary */}
      {summary && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Weather Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <WeatherIconDisplay 
                  condition={summary.mostCommonCondition!} 
                  precipitationType={PrecipitationType.NONE} 
                  size={24} 
                />
              </div>
              <p className="text-sm text-gray-600">Most Common</p>
              <p className="font-semibold capitalize">{summary.mostCommonCondition}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.avgTemp}°C</p>
              <p className="text-sm text-gray-600">Avg Temperature</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-700">
                {summary.minTemp}° - {summary.maxTemp}°C
              </p>
              <p className="text-sm text-gray-600">Temperature Range</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-orange-600">{summary.avgPrecipitation}%</p>
              <p className="text-sm text-gray-600">Avg Precipitation</p>
            </div>
          </div>
        </div>
      )}

      {/* Chart View Selector */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'timeline', label: 'Interactive Timeline', icon: '📊' },
            { key: 'temperature', label: 'Temperature Trend', icon: '🌡️' },
            { key: 'precipitation', label: 'Precipitation', icon: '🌧️' },
            { key: 'overview', label: 'Overview', icon: '📈' }
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key as ChartView)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === key
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart Display */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {renderChart()}
      </div>

      {/* Selected Forecast Details */}
      {selectedForecast && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Selected Forecast Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <WeatherIconDisplay 
                  condition={selectedForecast.conditions.main}
                  precipitationType={selectedForecast.precipitation.type}
                  size={32}
                />
                <div>
                  <p className="font-semibold">{selectedForecast.location.name}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedForecast.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-700 capitalize">
                {selectedForecast.conditions.description}
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Temperature:</span>
                <span className="font-medium">{selectedForecast.temperature.current}°C</span>
              </div>
              <div className="flex justify-between">
                <span>Feels like:</span>
                <span className="font-medium">{selectedForecast.temperature.feelsLike}°C</span>
              </div>
              <div className="flex justify-between">
                <span>Humidity:</span>
                <span className="font-medium">{selectedForecast.humidity}%</span>
              </div>
              <div className="flex justify-between">
                <span>Wind:</span>
                <span className="font-medium">{selectedForecast.wind.speed} km/h</span>
              </div>
              <div className="flex justify-between">
                <span>Precipitation:</span>
                <span className="font-medium">{selectedForecast.precipitation.probability}%</span>
              </div>
              <div className="flex justify-between">
                <span>Visibility:</span>
                <span className="font-medium">{selectedForecast.visibility} km</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherVisualization;