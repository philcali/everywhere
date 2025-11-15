import React, { useState, useEffect } from 'react';
import { TravelMode } from '../../../../shared/src/types/travel';

interface DurationSpeedInputProps {
  travelMode: TravelMode;
  duration?: number; // in hours
  speed?: number; // in km/h or mph depending on unit
  onDurationChange: (duration: number | undefined) => void;
  onSpeedChange: (speed: number | undefined) => void;
  distanceUnit?: 'metric' | 'imperial';
  error?: string;
  className?: string;
}

interface ModeDefaults {
  speed: number; // km/h
  speedRange: { min: number; max: number };
  unit: string;
}

const DurationSpeedInput: React.FC<DurationSpeedInputProps> = ({
  travelMode,
  duration,
  speed,
  onDurationChange,
  onSpeedChange,
  distanceUnit = 'metric',
  error,
  className = ''
}) => {
  const [inputMode, setInputMode] = useState<'duration' | 'speed'>('duration');
  const [durationInput, setDurationInput] = useState(duration?.toString() || '');
  const [speedInput, setSpeedInput] = useState(speed?.toString() || '');
  const [durationError, setDurationError] = useState('');
  const [speedError, setSpeedError] = useState('');

  // Default speeds and ranges for different travel modes (in km/h)
  const modeDefaults: Record<TravelMode, ModeDefaults> = {
    [TravelMode.WALKING]: {
      speed: 5,
      speedRange: { min: 3, max: 8 },
      unit: 'km/h'
    },
    [TravelMode.CYCLING]: {
      speed: 20,
      speedRange: { min: 10, max: 40 },
      unit: 'km/h'
    },
    [TravelMode.DRIVING]: {
      speed: 80,
      speedRange: { min: 30, max: 130 },
      unit: 'km/h'
    },
    [TravelMode.FLYING]: {
      speed: 800,
      speedRange: { min: 400, max: 1200 },
      unit: 'km/h'
    },
    [TravelMode.SAILING]: {
      speed: 15,
      speedRange: { min: 5, max: 30 },
      unit: 'km/h'
    },
    [TravelMode.CRUISE]: {
      speed: 40,
      speedRange: { min: 20, max: 60 },
      unit: 'km/h'
    }
  };

  const currentDefaults = modeDefaults[travelMode];
  const speedUnit = distanceUnit === 'imperial' ? 'mph' : 'km/h';

  // Convert between metric and imperial
  const convertSpeed = (value: number, fromMetric: boolean): number => {
    if (distanceUnit === 'imperial') {
      return fromMetric ? value * 0.621371 : value / 0.621371;
    }
    return value;
  };

  const getDisplaySpeed = (kmhSpeed: number): number => {
    return Math.round(convertSpeed(kmhSpeed, true));
  };

  const getKmhSpeed = (displaySpeed: number): number => {
    return convertSpeed(displaySpeed, false);
  };

  // Validation functions
  const validateDuration = (value: string): string => {
    if (!value.trim()) return '';
    
    const num = parseFloat(value);
    if (isNaN(num)) return 'Please enter a valid number';
    if (num <= 0) return 'Duration must be greater than 0';
    if (num > 8760) return 'Duration cannot exceed 1 year (8760 hours)'; // 365 * 24
    
    return '';
  };

  const validateSpeed = (value: string): string => {
    if (!value.trim()) return '';
    
    const num = parseFloat(value);
    if (isNaN(num)) return 'Please enter a valid number';
    if (num <= 0) return 'Speed must be greater than 0';
    
    const kmhSpeed = getKmhSpeed(num);
    const { min, max } = currentDefaults.speedRange;
    
    if (kmhSpeed < min || kmhSpeed > max) {
      const displayMin = getDisplaySpeed(min);
      const displayMax = getDisplaySpeed(max);
      return `Speed should be between ${displayMin} and ${displayMax} ${speedUnit} for ${travelMode}`;
    }
    
    return '';
  };

  // Handle input changes
  const handleDurationChange = (value: string) => {
    setDurationInput(value);
    const error = validateDuration(value);
    setDurationError(error);
    
    if (!error && value.trim()) {
      const num = parseFloat(value);
      onDurationChange(num);
      // Clear speed when duration is set
      setSpeedInput('');
      onSpeedChange(undefined);
    } else if (!value.trim()) {
      onDurationChange(undefined);
    }
  };

  const handleSpeedChange = (value: string) => {
    setSpeedInput(value);
    const error = validateSpeed(value);
    setSpeedError(error);
    
    if (!error && value.trim()) {
      const displaySpeed = parseFloat(value);
      const kmhSpeed = getKmhSpeed(displaySpeed);
      onSpeedChange(kmhSpeed);
      // Clear duration when speed is set
      setDurationInput('');
      onDurationChange(undefined);
    } else if (!value.trim()) {
      onSpeedChange(undefined);
    }
  };

  // Update inputs when props change
  useEffect(() => {
    if (duration !== undefined) {
      setDurationInput(duration.toString());
      setInputMode('duration');
    }
  }, [duration]);

  useEffect(() => {
    if (speed !== undefined) {
      const displaySpeed = getDisplaySpeed(speed);
      setSpeedInput(displaySpeed.toString());
      setInputMode('speed');
    }
  }, [speed, distanceUnit]);

  // Clear inputs when travel mode changes
  useEffect(() => {
    setDurationInput('');
    setSpeedInput('');
    setDurationError('');
    setSpeedError('');
    onDurationChange(undefined);
    onSpeedChange(undefined);
  }, [travelMode]);

  const defaultSpeed = getDisplaySpeed(currentDefaults.speed);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Travel Timing
      </label>
      
      {/* Input mode selector */}
      <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setInputMode('duration')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            inputMode === 'duration'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Set Duration
        </button>
        <button
          type="button"
          onClick={() => setInputMode('speed')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            inputMode === 'speed'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Set Speed
        </button>
      </div>

      {inputMode === 'duration' ? (
        <div>
          <label htmlFor="duration-input" className="block text-sm font-medium text-gray-600 mb-2">
            Travel Duration
          </label>
          <div className="relative">
            <input
              id="duration-input"
              type="number"
              value={durationInput}
              onChange={(e) => handleDurationChange(e.target.value)}
              placeholder="e.g., 2.5"
              min="0"
              step="0.1"
              className={`form-input w-full pr-16 ${durationError ? 'border-red-500 focus:border-red-500' : ''}`}
              aria-describedby={durationError ? 'duration-error' : 'duration-help'}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
              hours
            </div>
          </div>
          {durationError ? (
            <p id="duration-error" className="mt-1 text-sm text-red-600" role="alert">
              {durationError}
            </p>
          ) : (
            <p id="duration-help" className="mt-1 text-sm text-gray-500">
              How long will your journey take?
            </p>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="speed-input" className="block text-sm font-medium text-gray-600 mb-2">
            Travel Speed
          </label>
          <div className="relative">
            <input
              id="speed-input"
              type="number"
              value={speedInput}
              onChange={(e) => handleSpeedChange(e.target.value)}
              placeholder={`e.g., ${defaultSpeed}`}
              min="0"
              step="1"
              className={`form-input w-full pr-16 ${speedError ? 'border-red-500 focus:border-red-500' : ''}`}
              aria-describedby={speedError ? 'speed-error' : 'speed-help'}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
              {speedUnit}
            </div>
          </div>
          {speedError ? (
            <p id="speed-error" className="mt-1 text-sm text-red-600" role="alert">
              {speedError}
            </p>
          ) : (
            <p id="speed-help" className="mt-1 text-sm text-gray-500">
              Average speed for your journey (default: {defaultSpeed} {speedUnit})
            </p>
          )}
        </div>
      )}

      {/* Default information */}
      <div className="mt-3 p-3 bg-gray-50 rounded-md">
        <p className="text-sm text-gray-600">
          <span className="font-medium">Default for {travelMode}:</span> {defaultSpeed} {speedUnit}
          {!durationInput && !speedInput && (
            <span className="text-gray-500"> (will be used if no custom value is set)</span>
          )}
        </p>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default DurationSpeedInput;