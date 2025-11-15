import React, { useState } from 'react';
import { Location } from '../../../../shared/src/types/location';
import { TravelMode } from '../../../../shared/src/types/travel';
import LocationInput from './LocationInput';
import TravelModeSelector from './TravelModeSelector';
import DurationSpeedInput from './DurationSpeedInput';
import ValidationMessage from './ValidationMessage';

interface TravelPlannerFormData {
  source: {
    input: string;
    location: Location | null;
  };
  destination: {
    input: string;
    location: Location | null;
  };
  travelMode: TravelMode;
  duration?: number;
  speed?: number;
}

interface TravelPlannerFormProps {
  onSubmit: (data: TravelPlannerFormData) => void;
  onDataChange?: (data: TravelPlannerFormData) => void;
  isLoading?: boolean;
  className?: string;
}

interface FormErrors {
  source?: string;
  destination?: string;
  travelMode?: string;
  timing?: string;
  general?: string;
}

const TravelPlannerForm: React.FC<TravelPlannerFormProps> = ({
  onSubmit,
  onDataChange,
  isLoading = false,
  className = ''
}) => {
  const [formData, setFormData] = useState<TravelPlannerFormData>({
    source: { input: '', location: null },
    destination: { input: '', location: null },
    travelMode: TravelMode.DRIVING,
    duration: undefined,
    speed: undefined
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isValidating, setIsValidating] = useState(false);

  // Real-time validation
  const validateForm = (data: TravelPlannerFormData): FormErrors => {
    const newErrors: FormErrors = {};

    // Source validation
    if (!data.source.input.trim()) {
      newErrors.source = 'Source location is required';
    } else if (!data.source.location) {
      newErrors.source = 'Please select a valid source location from the suggestions';
    }

    // Destination validation
    if (!data.destination.input.trim()) {
      newErrors.destination = 'Destination location is required';
    } else if (!data.destination.location) {
      newErrors.destination = 'Please select a valid destination location from the suggestions';
    }

    // Check if source and destination are the same
    if (data.source.location && data.destination.location) {
      const sourceCoords = data.source.location.coordinates;
      const destCoords = data.destination.location.coordinates;
      const distance = Math.sqrt(
        Math.pow(sourceCoords.latitude - destCoords.latitude, 2) +
        Math.pow(sourceCoords.longitude - destCoords.longitude, 2)
      );
      
      if (distance < 0.001) { // Very close coordinates (roughly same location)
        newErrors.general = 'Source and destination cannot be the same location';
      }
    }

    // Travel mode validation (should always be valid due to default, but just in case)
    if (!Object.values(TravelMode).includes(data.travelMode)) {
      newErrors.travelMode = 'Please select a valid travel mode';
    }

    return newErrors;
  };

  // Update form data and trigger validation
  const updateFormData = (updates: Partial<TravelPlannerFormData>) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);
    
    // Real-time validation
    setIsValidating(true);
    const newErrors = validateForm(newData);
    setErrors(newErrors);
    setIsValidating(false);

    // Notify parent of data changes
    if (onDataChange) {
      onDataChange(newData);
    }
  };

  // Handle source location changes
  const handleSourceInputChange = (value: string) => {
    updateFormData({
      source: { input: value, location: formData.source.location }
    });
  };

  const handleSourceLocationSelect = (location: Location | null) => {
    updateFormData({
      source: { input: formData.source.input, location }
    });
  };

  // Handle destination location changes
  const handleDestinationInputChange = (value: string) => {
    updateFormData({
      destination: { input: value, location: formData.destination.location }
    });
  };

  const handleDestinationLocationSelect = (location: Location | null) => {
    updateFormData({
      destination: { input: formData.destination.input, location }
    });
  };

  // Handle travel mode change
  const handleTravelModeChange = (mode: TravelMode) => {
    updateFormData({ travelMode: mode });
  };

  // Handle duration/speed changes
  const handleDurationChange = (duration: number | undefined) => {
    updateFormData({ duration, speed: undefined });
  };

  const handleSpeedChange = (speed: number | undefined) => {
    updateFormData({ speed, duration: undefined });
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      onSubmit(formData);
    }
  };

  // Check if form is valid
  const isFormValid = Object.keys(errors).length === 0 && 
                     formData.source.location && 
                     formData.destination.location;

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {/* General error message */}
      {errors.general && (
        <ValidationMessage type="error" message={errors.general} />
      )}

      {/* Location inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LocationInput
          label="From"
          placeholder="Enter starting location"
          value={formData.source.input}
          onChange={handleSourceInputChange}
          onLocationSelect={handleSourceLocationSelect}
          error={errors.source}
          required
        />
        
        <LocationInput
          label="To"
          placeholder="Enter destination"
          value={formData.destination.input}
          onChange={handleDestinationInputChange}
          onLocationSelect={handleDestinationLocationSelect}
          error={errors.destination}
          required
        />
      </div>

      {/* Travel mode selector */}
      <TravelModeSelector
        value={formData.travelMode}
        onChange={handleTravelModeChange}
        error={errors.travelMode}
      />

      {/* Duration/Speed input */}
      <DurationSpeedInput
        travelMode={formData.travelMode}
        duration={formData.duration}
        speed={formData.speed}
        onDurationChange={handleDurationChange}
        onSpeedChange={handleSpeedChange}
        error={errors.timing}
      />

      {/* Submit button */}
      <div className="flex justify-center pt-4">
        <button
          type="submit"
          disabled={!isFormValid || isLoading || isValidating}
          className={`
            btn-primary text-lg px-8 py-3 min-w-48
            ${(!isFormValid || isLoading || isValidating) 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-primary-700'
            }
          `}
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Planning Route...</span>
            </div>
          ) : (
            'Get Weather Forecast'
          )}
        </button>
      </div>

      {/* Form status */}
      {isValidating && (
        <div className="text-center">
          <p className="text-sm text-gray-500">Validating...</p>
        </div>
      )}
    </form>
  );
};

export default TravelPlannerForm;