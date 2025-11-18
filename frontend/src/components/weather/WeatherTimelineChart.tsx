import React, { useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { WeatherForecast, WeatherCondition } from '../../types/shared';
import { WeatherIconDisplay } from './WeatherIconDisplay';

interface WeatherTimelineChartProps {
  weatherData: WeatherForecast[];
  height?: number;
  className?: string;
  onTimePointSelect?: (forecast: WeatherForecast) => void;
}

interface TimelineDataPoint {
  time: string;
  timestamp: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  precipitationProbability: number;
  location: string;
  distanceFromStart: number;
  weatherCondition: WeatherCondition;
  forecast: WeatherForecast;
}

export const WeatherTimelineChart: React.FC<WeatherTimelineChartProps> = ({
  weatherData,
  height = 400,
  className = '',
  onTimePointSelect
}) => {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<'temperature' | 'humidity' | 'wind' | 'visibility'>('temperature');

  const chartData: TimelineDataPoint[] = weatherData.map((forecast, index) => ({
    time: new Date(forecast.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    timestamp: new Date(forecast.timestamp).getTime(),
    temperature: forecast.temperature.current,
    humidity: forecast.humidity,
    windSpeed: forecast.wind.speed,
    visibility: forecast.visibility,
    precipitationProbability: forecast.precipitation.probability,
    location: forecast.location.name,
    distanceFromStart: index * 10, // Approximate distance for demo
    weatherCondition: forecast.conditions.main,
    forecast
  }));

  const getMetricConfig = () => {
    switch (activeMetric) {
      case 'temperature':
        return {
          dataKey: 'temperature',
          color: '#2563eb',
          label: 'Temperature (°C)',
          unit: '°C'
        };
      case 'humidity':
        return {
          dataKey: 'humidity',
          color: '#06b6d4',
          label: 'Humidity (%)',
          unit: '%'
        };
      case 'wind':
        return {
          dataKey: 'windSpeed',
          color: '#10b981',
          label: 'Wind Speed (km/h)',
          unit: ' km/h'
        };
      case 'visibility':
        return {
          dataKey: 'visibility',
          color: '#8b5cf6',
          label: 'Visibility (km)',
          unit: ' km'
        };
      default:
        return {
          dataKey: 'temperature',
          color: '#2563eb',
          label: 'Temperature (°C)',
          unit: '°C'
        };
    }
  };

  const metricConfig = getMetricConfig();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <WeatherIconDisplay 
              condition={data.weatherCondition} 
              precipitationType={data.forecast.precipitation.type}
              size={20}
            />
            <div>
              <p className="font-semibold text-gray-800">{label}</p>
              <p className="text-xs text-gray-600">{data.location}</p>
            </div>
          </div>
          
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">{`Temperature: ${data.temperature}°C`}</p>
            <p className="text-cyan-600">{`Humidity: ${data.humidity}%`}</p>
            <p className="text-green-600">{`Wind: ${data.windSpeed} km/h`}</p>
            <p className="text-purple-600">{`Visibility: ${data.visibility} km`}</p>
            <p className="text-orange-600">{`Precipitation: ${data.precipitationProbability}%`}</p>
          </div>
          
          <p className="text-xs text-gray-500 mt-2">{`Distance: ${data.distanceFromStart} km`}</p>
        </div>
      );
    }
    return null;
  };

  const handlePointClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const point = data.activePayload[0].payload;
      setSelectedPoint(point.timestamp);
      if (onTimePointSelect) {
        onTimePointSelect(point.forecast);
      }
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Weather Timeline</h3>
        <p className="text-sm text-gray-600">Interactive weather progression along your journey</p>
      </div>
      
      {/* Metric selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'temperature', label: 'Temperature', color: 'bg-blue-500' },
          { key: 'humidity', label: 'Humidity', color: 'bg-cyan-500' },
          { key: 'wind', label: 'Wind Speed', color: 'bg-green-500' },
          { key: 'visibility', label: 'Visibility', color: 'bg-purple-500' }
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setActiveMetric(key as any)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeMetric === key
                ? `${color} text-white`
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart 
          data={chartData} 
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          onClick={handlePointClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="time" 
            stroke="#666"
            fontSize={12}
            tick={{ fill: '#666' }}
          />
          <YAxis 
            yAxisId="metric"
            stroke="#666"
            fontSize={12}
            tick={{ fill: '#666' }}
            label={{ value: metricConfig.label, angle: -90, position: 'insideLeft' }}
          />
          <YAxis 
            yAxisId="precipitation"
            orientation="right"
            stroke="#f97316"
            fontSize={12}
            tick={{ fill: '#f97316' }}
            label={{ value: 'Precipitation (%)', angle: 90, position: 'insideRight' }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Selected point reference line */}
          {selectedPoint && (
            <ReferenceLine 
              x={chartData.find(d => d.timestamp === selectedPoint)?.time} 
              stroke="#ef4444" 
              strokeDasharray="2 2"
              strokeWidth={2}
            />
          )}
          
          {/* Precipitation probability bars */}
          <Bar
            yAxisId="precipitation"
            dataKey="precipitationProbability"
            fill="rgba(249, 115, 22, 0.3)"
            radius={[2, 2, 0, 0]}
          />
          
          {/* Main metric line */}
          <Line
            yAxisId="metric"
            type="monotone"
            dataKey={metricConfig.dataKey}
            stroke={metricConfig.color}
            strokeWidth={3}
            dot={{ fill: metricConfig.color, strokeWidth: 2, r: 4 }}
            activeDot={{ 
              r: 6, 
              stroke: metricConfig.color, 
              strokeWidth: 2,
              onClick: handlePointClick
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Weather condition indicators */}
      <div className="mt-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-700">Weather conditions:</span>
          {chartData.map((point, index) => (
            <div 
              key={index}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                selectedPoint === point.timestamp 
                  ? 'bg-red-100 border border-red-300' 
                  : 'bg-gray-100'
              }`}
            >
              <WeatherIconDisplay 
                condition={point.weatherCondition}
                precipitationType={point.forecast.precipitation.type}
                size={14}
              />
              <span>{point.time}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-4 h-0.5`} style={{ backgroundColor: metricConfig.color }}></div>
          <span>{metricConfig.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 bg-orange-300 opacity-50"></div>
          <span>Precipitation Probability</span>
        </div>
        {selectedPoint && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-500 border-dashed border-t-2 border-red-500"></div>
            <span>Selected Time</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherTimelineChart;