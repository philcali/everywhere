import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Route, WeatherForecast, WeatherCondition, PrecipitationType } from '../../types/shared';
import { WeatherIconDisplay } from './WeatherIconDisplay';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RouteMapWithWeatherProps {
  route: Route;
  weatherData: WeatherForecast[];
  className?: string;
  onWeatherPointSelect?: (forecast: WeatherForecast) => void;
  height?: number;
}

// Weather condition to color mapping
const getWeatherColor = (condition: WeatherCondition, precipitationType: PrecipitationType): string => {
  if (precipitationType !== PrecipitationType.NONE) {
    switch (precipitationType) {
      case PrecipitationType.RAIN:
        return '#3B82F6'; // Blue
      case PrecipitationType.SNOW:
        return '#E5E7EB'; // Light gray
      case PrecipitationType.SLEET:
        return '#6B7280'; // Gray
      case PrecipitationType.HAIL:
        return '#374151'; // Dark gray
      default:
        return '#3B82F6';
    }
  }

  switch (condition) {
    case WeatherCondition.SUNNY:
      return '#F59E0B'; // Amber
    case WeatherCondition.CLOUDY:
      return '#6B7280'; // Gray
    case WeatherCondition.OVERCAST:
      return '#4B5563'; // Dark gray
    case WeatherCondition.RAINY:
      return '#3B82F6'; // Blue
    case WeatherCondition.STORMY:
      return '#7C2D12'; // Dark red
    case WeatherCondition.FOGGY:
      return '#9CA3AF'; // Light gray
    case WeatherCondition.SNOWY:
      return '#E5E7EB'; // Very light gray
    default:
      return '#6B7280';
  }
};

// Get weather intensity for marker size
const getWeatherIntensity = (forecast: WeatherForecast): number => {
  const tempIntensity = Math.abs(forecast.temperature.current - 20) / 30; // Normalize around 20°C
  const precipIntensity = forecast.precipitation.probability / 100;
  const windIntensity = Math.min(forecast.wind.speed / 50, 1); // Normalize wind speed
  
  return Math.max(tempIntensity, precipIntensity, windIntensity);
};

// Custom weather marker component
const WeatherMarker: React.FC<{
  forecast: WeatherForecast;
  onSelect?: (forecast: WeatherForecast) => void;
}> = ({ forecast, onSelect }) => {
  const position: [number, number] = [
    forecast.location.coordinates.latitude,
    forecast.location.coordinates.longitude
  ];

  const color = getWeatherColor(forecast.conditions.main, forecast.precipitation.type);
  const intensity = getWeatherIntensity(forecast);
  const size = Math.max(20, Math.min(40, 20 + intensity * 20));

  const weatherIcon = L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        font-size: ${Math.max(12, size * 0.4)}px;
        color: white;
        font-weight: bold;
      ">
        ${Math.round(forecast.temperature.current)}°
      </div>
    `,
    className: 'weather-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  return (
    <Marker
      position={position}
      icon={weatherIcon}
      eventHandlers={{
        click: () => onSelect?.(forecast),
      }}
    >
      <Popup>
        <div className="p-2 min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <WeatherIconDisplay
              condition={forecast.conditions.main}
              precipitationType={forecast.precipitation.type}
              size={24}
            />
            <div>
              <h3 className="font-semibold text-sm">{forecast.location.name}</h3>
              <p className="text-xs text-gray-600">
                {new Date(forecast.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Temperature:</span>
              <span className="font-medium">{forecast.temperature.current}°C</span>
            </div>
            <div className="flex justify-between">
              <span>Feels like:</span>
              <span className="font-medium">{forecast.temperature.feelsLike}°C</span>
            </div>
            <div className="flex justify-between">
              <span>Condition:</span>
              <span className="font-medium capitalize">{forecast.conditions.description}</span>
            </div>
            <div className="flex justify-between">
              <span>Precipitation:</span>
              <span className="font-medium">{forecast.precipitation.probability}%</span>
            </div>
            <div className="flex justify-between">
              <span>Wind:</span>
              <span className="font-medium">{forecast.wind.speed} km/h</span>
            </div>
            <div className="flex justify-between">
              <span>Humidity:</span>
              <span className="font-medium">{forecast.humidity}%</span>
            </div>
            <div className="flex justify-between">
              <span>Visibility:</span>
              <span className="font-medium">{forecast.visibility} km</span>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

// Component to fit map bounds to route
const FitBounds: React.FC<{ route: Route }> = ({ route }) => {
  const map = useMap();

  useEffect(() => {
    if (route.waypoints.length > 0) {
      const bounds = L.latLngBounds(
        route.waypoints.map(wp => [wp.coordinates.latitude, wp.coordinates.longitude])
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, route]);

  return null;
};

export const RouteMapWithWeather: React.FC<RouteMapWithWeatherProps> = ({
  route,
  weatherData,
  className = '',
  onWeatherPointSelect,
  height = 400
}) => {
  const [selectedForecast, setSelectedForecast] = useState<WeatherForecast | null>(null);

  if (!route || !route.waypoints || route.waypoints.length === 0) {
    return (
      <div className={`w-full ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">🗺️</div>
            <h3 className="text-lg font-medium mb-1">No Route Available</h3>
            <p className="text-sm">Enter your travel route to see the map with weather overlay.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleWeatherPointSelect = (forecast: WeatherForecast) => {
    setSelectedForecast(forecast);
    onWeatherPointSelect?.(forecast);
  };

  // Create route line coordinates
  const routeCoordinates: [number, number][] = route.waypoints.map(wp => [
    wp.coordinates.latitude,
    wp.coordinates.longitude
  ]);

  // Get route color based on travel mode
  const getRouteColor = (travelMode: string): string => {
    switch (travelMode) {
      case 'driving':
        return '#3B82F6'; // Blue
      case 'walking':
        return '#10B981'; // Green
      case 'cycling':
        return '#F59E0B'; // Amber
      case 'flying':
        return '#8B5CF6'; // Purple
      case 'sailing':
        return '#06B6D4'; // Cyan
      case 'cruise':
        return '#EC4899'; // Pink
      default:
        return '#6B7280'; // Gray
    }
  };

  // Calculate center point for initial map view
  const centerLat = route.waypoints.reduce((sum, wp) => sum + wp.coordinates.latitude, 0) / route.waypoints.length;
  const centerLng = route.waypoints.reduce((sum, wp) => sum + wp.coordinates.longitude, 0) / route.waypoints.length;

  return (
    <div className={`w-full ${className}`}>
      {/* Map Legend */}
      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Map Legend</h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-1 rounded"
              style={{ backgroundColor: getRouteColor(route.travelMode) }}
            />
            <span className="capitalize">{route.travelMode} Route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full border border-white" />
            <span>Sunny Weather</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full border border-white" />
            <span>Rainy Weather</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded-full border border-white" />
            <span>Cloudy Weather</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Marker size indicates weather intensity. Click markers for detailed weather information.
        </p>
      </div>

      {/* Map Container */}
      <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Route Line */}
          <Polyline
            positions={routeCoordinates}
            color={getRouteColor(route.travelMode)}
            weight={4}
            opacity={0.8}
          />

          {/* Start Marker */}
          <Marker position={routeCoordinates[0]}>
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm">Start: {route.source.name}</h3>
                <p className="text-xs text-gray-600">{route.source.address}</p>
              </div>
            </Popup>
          </Marker>

          {/* End Marker */}
          <Marker position={routeCoordinates[routeCoordinates.length - 1]}>
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm">End: {route.destination.name}</h3>
                <p className="text-xs text-gray-600">{route.destination.address}</p>
              </div>
            </Popup>
          </Marker>

          {/* Weather Markers */}
          {weatherData.map((forecast, index) => (
            <WeatherMarker
              key={`weather-${index}-${forecast.timestamp}`}
              forecast={forecast}
              onSelect={handleWeatherPointSelect}
            />
          ))}

          {/* Fit bounds to route */}
          <FitBounds route={route} />
        </MapContainer>
      </div>

      {/* Selected Weather Details */}
      {selectedForecast && (
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Selected Location Weather</h3>
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
              <p className="text-sm text-gray-700 capitalize mb-2">
                {selectedForecast.conditions.description}
              </p>
              <div className="text-xs text-gray-600">
                Coordinates: {selectedForecast.location.coordinates.latitude.toFixed(4)}, {selectedForecast.location.coordinates.longitude.toFixed(4)}
              </div>
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
                <span>Min/Max:</span>
                <span className="font-medium">{selectedForecast.temperature.min}°C / {selectedForecast.temperature.max}°C</span>
              </div>
              <div className="flex justify-between">
                <span>Humidity:</span>
                <span className="font-medium">{selectedForecast.humidity}%</span>
              </div>
              <div className="flex justify-between">
                <span>Wind:</span>
                <span className="font-medium">{selectedForecast.wind.speed} km/h ({selectedForecast.wind.direction}°)</span>
              </div>
              <div className="flex justify-between">
                <span>Precipitation:</span>
                <span className="font-medium">
                  {selectedForecast.precipitation.probability}% ({selectedForecast.precipitation.type})
                </span>
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

export default RouteMapWithWeather;