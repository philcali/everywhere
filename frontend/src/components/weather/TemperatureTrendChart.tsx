import React from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';
import { WeatherForecast } from '../../types/shared';

interface TemperatureTrendChartProps {
  weatherData: WeatherForecast[];
  showFeelsLike?: boolean;
  showMinMax?: boolean;
  height?: number;
  className?: string;
}

interface ChartDataPoint {
  time: string;
  timestamp: number;
  current: number;
  feelsLike: number;
  min: number;
  max: number;
  location: string;
  distanceFromStart: number;
}

export const TemperatureTrendChart: React.FC<TemperatureTrendChartProps> = ({
  weatherData,
  showFeelsLike = true,
  showMinMax = true,
  height = 300,
  className = ''
}) => {
  const chartData: ChartDataPoint[] = weatherData.map((forecast, index) => ({
    time: new Date(forecast.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    timestamp: new Date(forecast.timestamp).getTime(),
    current: forecast.temperature.current,
    feelsLike: forecast.temperature.feelsLike,
    min: forecast.temperature.min,
    max: forecast.temperature.max,
    location: forecast.location.name,
    distanceFromStart: index * 10 // Approximate distance for demo
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{`Time: ${label}`}</p>
          <p className="text-sm text-gray-600">{`Location: ${data.location}`}</p>
          <p className="text-sm text-gray-600">{`Distance: ${data.distanceFromStart} km`}</p>
          <div className="mt-2 space-y-1">
            <p className="text-blue-600">{`Current: ${data.current}°C`}</p>
            {showFeelsLike && (
              <p className="text-orange-500">{`Feels like: ${data.feelsLike}°C`}</p>
            )}
            {showMinMax && (
              <>
                <p className="text-red-400">{`Max: ${data.max}°C`}</p>
                <p className="text-blue-400">{`Min: ${data.min}°C`}</p>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Temperature Trend</h3>
        <p className="text-sm text-gray-600">Temperature changes along your route over time</p>
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
            label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Temperature range area */}
          {showMinMax && (
            <Area
              type="monotone"
              dataKey="max"
              stroke="none"
              fill="rgba(239, 68, 68, 0.1)"
              fillOpacity={0.3}
            />
          )}
          
          {/* Main temperature line */}
          <Line
            type="monotone"
            dataKey="current"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2 }}
          />
          
          {/* Feels like temperature line */}
          {showFeelsLike && (
            <Line
              type="monotone"
              dataKey="feelsLike"
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#f97316', strokeWidth: 1, r: 3 }}
            />
          )}
          
          {/* Min/Max temperature lines */}
          {showMinMax && (
            <>
              <Line
                type="monotone"
                dataKey="max"
                stroke="#ef4444"
                strokeWidth={1}
                dot={false}
                strokeDasharray="2 2"
              />
              <Line
                type="monotone"
                dataKey="min"
                stroke="#3b82f6"
                strokeWidth={1}
                dot={false}
                strokeDasharray="2 2"
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-600"></div>
          <span>Current Temperature</span>
        </div>
        {showFeelsLike && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-orange-500 border-dashed border-t-2 border-orange-500"></div>
            <span>Feels Like</span>
          </div>
        )}
        {showMinMax && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-red-400 border-dashed border-t border-red-400"></div>
              <span>Max</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-400 border-dashed border-t border-blue-400"></div>
              <span>Min</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TemperatureTrendChart;