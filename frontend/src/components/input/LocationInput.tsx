import React, { useState, useEffect, useRef } from 'react';
import { Location } from '../../../../shared/src/types/location';

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (location: Location | null) => void;
  error?: string;
  required?: boolean;
  className?: string;
}

interface LocationSuggestion {
  name: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

const LocationInput: React.FC<LocationInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  onLocationSelect,
  error,
  required = false,
  className = ''
}) => {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Mock geocoding function - in real implementation, this would call the backend API
  const mockGeocode = async (query: string): Promise<LocationSuggestion[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock suggestions based on query
    const mockSuggestions: LocationSuggestion[] = [
      {
        name: `${query} City Center`,
        address: `${query} City Center, State, Country`,
        coordinates: { latitude: 40.7128, longitude: -74.0060 }
      },
      {
        name: `${query} Airport`,
        address: `${query} International Airport, State, Country`,
        coordinates: { latitude: 40.6892, longitude: -74.1745 }
      },
      {
        name: `${query} Downtown`,
        address: `Downtown ${query}, State, Country`,
        coordinates: { latitude: 40.7589, longitude: -73.9851 }
      }
    ];

    return query.length >= 2 ? mockSuggestions : [];
  };

  // Debounced search function
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (value.length >= 2) {
        setIsLoading(true);
        try {
          const results = await mockGeocode(value);
          setSuggestions(results);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        } catch (error) {
          console.error('Geocoding error:', error);
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Clear selection when user types
    if (newValue !== value) {
      onLocationSelect(null);
    }
  };

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    const location: Location = {
      name: suggestion.name,
      coordinates: suggestion.coordinates,
      address: suggestion.address
    };
    
    onChange(suggestion.name);
    onLocationSelect(location);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 200);
  };

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <label 
        htmlFor={`location-${label.toLowerCase().replace(/\s+/g, '-')}`}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <input
          ref={inputRef}
          id={`location-${label.toLowerCase().replace(/\s+/g, '-')}`}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`form-input w-full ${error ? 'border-red-500 focus:border-red-500' : ''}`}
          aria-describedby={error ? `${label}-error` : undefined}
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
          role="combobox"
          autoComplete="off"
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          </div>
        )}
        
        {/* Location icon */}
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        
        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div 
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                  index === selectedIndex ? 'bg-primary-50 text-primary-700' : 'text-gray-900'
                }`}
                onClick={() => handleSuggestionClick(suggestion)}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <div className="font-medium">{suggestion.name}</div>
                <div className="text-sm text-gray-500">{suggestion.address}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {error && (
        <p id={`${label}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default LocationInput;