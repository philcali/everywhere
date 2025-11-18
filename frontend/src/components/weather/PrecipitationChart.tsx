import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { WeatherForecast, PrecipitationType, WeatherCondition } from '../../types/shared';
import { WeatherIconDisplay } from './WeatherIconDisplay';

interface PrecipitationChartProps {
  weatherData: WeatherForecast[];
  height?: number;
  className?: string;
}

interface PrecipitationDataPoint {
  time: string;
  timestamp: number;
  probability: number;
  intensity: number;
  type: PrecipitationType;
  location: string;
  distanceFromStart: number;
}

export const PrecipitationChart: React.FC<PrecipitationChartProps> = ({
  weatherData,
  height = 250,
  className = ''
}) => {
  const chartData: PrecipitationDataPoint[] = weatherData.map((forecast, index) => ({
    time: new Date(forecast.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    timestamp: new Date(forecast.timestamp).getTime(),
    probability: forecast.precipitation.probability,
    intensity: forecast.precipitation.intensity,
    type: forecast.precipitation.type,
    location: forecast.location.name,
    distanceFromStart: index * 10 // Approximate distance for demo
  }));

  const getPrecipitationColor = (type: PrecipitationType, intensity: number) => {
    const baseColors = {
      [PrecipitationType.NONE]: '#e5e7eb',
      [PrecipitationType.RAIN]: '#3b82f6',
      [PrecipitationType.SLEET]: '#6366f1',
      [PrecipitationType.SNOW]: '#e0e7ff',
      [PrecipitationType.HAIL]: '#7c3aed'
    };

    const baseColor = baseColors[type];
    
    // Adjust opacity based on intensity (0-1 scale)
    if (type === PrecipitationType.NONE) {
      return baseColor;
    }
    
    const opacity = Math.max(0.3, intensity);
    return `${baseColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
  };

  const getIntensityLabel = (intensity: number, type: PrecipitationType) => {
    if (type === PrecipitationType.NONE) return 'None';
    
    if (intensity <= 0.3) return 'Light';
    if (intensity <= 0.6) return 'Moderate';
    return 'Heavy';
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{`Time: ${label}`}</p>
          <p className="text-sm text-gray-600">{`Location: ${data.location}`}</p>
          <p className="text-sm text-gray-600">{`Distance: ${data.distanceFromStart} km`}</p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <WeatherIconDisplay 
                condition={WeatherCondition.RAINY} 
                precipitationType={data.type} 
                size={16} 
              />
              <span className="capitalize">{data.type}</span>
            </div>
            <p className="text-blue-600">{`Probability: ${data.probability}%`}</p>
            <p className="text-purple-600">
              {`Intensity: ${getIntensityLabel(data.intensity, data.type)} (${(data.intensity * 100).toFixed(0)}%)`}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Precipitation Forecast</h3>
        <p className="text-sm text-gray-600">Chance and intensity of precipitation along your route</p>
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="time" 
            stroke="#666"
            fontSize={12}
            tick={{ fill: '#666' }}
          />
          <YAxis 
            stroke="#666"
            fontSize={12}
            tick={{ fill: '#666' }}
            label={{ value: 'Probability (%)', angle: -90, position: 'insideLeft' }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          
          <Bar dataKey="probability" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={getPrecipitationColor(entry.type, entry.intensity)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Precipitation type indicators */}
      <div className="mt-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <WeatherIconDisplay condition={WeatherCondition.RAINY} precipitationType={PrecipitationType.RAIN} size={16} />
            <span>Rain</span>
          </div>
          <div className="flex items-center gap-2">
            <WeatherIconDisplay condition={WeatherCondition.RAINY} precipitationType={PrecipitationType.SLEET} size={16} />
            <span>Sleet</span>
          </div>
          <div className="flex items-center gap-2">
            <WeatherIconDisplay condition={WeatherCondition.SNOWY} precipitationType={PrecipitationType.SNOW} size={16} />
            <span>Snow</span>
          </div>
          <div className="flex items-center gap-2">
            <WeatherIconDisplay condition={WeatherCondition.STORMY} precipitationType={PrecipitationType.HAIL} size={16} />
            <span>Hail</span>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-gray-500">
          <p>Bar height shows probability, color intensity shows precipitation intensity</p>
        </div>
      </div>
    </div>
  );
};

export default PrecipitationChart;