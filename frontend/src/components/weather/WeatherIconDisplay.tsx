import React from 'react';
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudSnow, 
  CloudLightning, 
  CloudDrizzle,
  EyeOff
} from 'lucide-react';
import { WeatherCondition, PrecipitationType } from '../../types/shared';

interface WeatherIconDisplayProps {
  condition: WeatherCondition;
  precipitationType: PrecipitationType;
  size?: number;
  className?: string;
}

export const WeatherIconDisplay: React.FC<WeatherIconDisplayProps> = ({
  condition,
  precipitationType,
  size = 24,
  className = ''
}) => {
  const getWeatherIcon = () => {
    // Priority: precipitation type overrides general condition
    if (precipitationType !== PrecipitationType.NONE) {
      switch (precipitationType) {
        case PrecipitationType.RAIN:
          return <CloudRain size={size} className={`text-blue-500 ${className}`} />;
        case PrecipitationType.SLEET:
          return <CloudDrizzle size={size} className={`text-blue-400 ${className}`} />;
        case PrecipitationType.SNOW:
          return <CloudSnow size={size} className={`text-blue-200 ${className}`} />;
        case PrecipitationType.HAIL:
          return <CloudLightning size={size} className={`text-purple-500 ${className}`} />;
        default:
          break;
      }
    }

    // General weather conditions
    switch (condition) {
      case WeatherCondition.SUNNY:
        return <Sun size={size} className={`text-yellow-500 ${className}`} />;
      case WeatherCondition.CLOUDY:
        return <Cloud size={size} className={`text-gray-400 ${className}`} />;
      case WeatherCondition.OVERCAST:
        return <Cloud size={size} className={`text-gray-600 ${className}`} />;
      case WeatherCondition.RAINY:
        return <CloudRain size={size} className={`text-blue-500 ${className}`} />;
      case WeatherCondition.STORMY:
        return <CloudLightning size={size} className={`text-purple-600 ${className}`} />;
      case WeatherCondition.FOGGY:
        return <EyeOff size={size} className={`text-gray-500 ${className}`} />;
      case WeatherCondition.SNOWY:
        return <CloudSnow size={size} className={`text-blue-200 ${className}`} />;
      default:
        return <Sun size={size} className={`text-gray-400 ${className}`} />;
    }
  };

  return (
    <div className="inline-flex items-center justify-center">
      {getWeatherIcon()}
    </div>
  );
};

export default WeatherIconDisplay;