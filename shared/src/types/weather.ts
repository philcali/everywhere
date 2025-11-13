import { Location } from './location.js';

export enum WeatherCondition {
  SUNNY = 'sunny',
  CLOUDY = 'cloudy',
  OVERCAST = 'overcast',
  RAINY = 'rainy',
  STORMY = 'stormy',
  FOGGY = 'foggy',
  SNOWY = 'snowy'
}

export enum PrecipitationType {
  NONE = 'none',
  RAIN = 'rain',
  SLEET = 'sleet',
  SNOW = 'snow',
  HAIL = 'hail'
}

export interface WeatherForecast {
  location: Location;
  timestamp: Date;
  temperature: {
    current: number;
    feelsLike: number;
    min: number;
    max: number;
  };
  conditions: {
    main: WeatherCondition;
    description: string;
    icon: string;
  };
  precipitation: {
    type: PrecipitationType;
    probability: number;
    intensity: number;
  };
  wind: {
    speed: number;
    direction: number;
  };
  humidity: number;
  visibility: number;
}