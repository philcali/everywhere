import React from 'react';
import { TravelMode } from '../../../../shared/src/types/travel';

interface TravelModeOption {
  mode: TravelMode;
  label: string;
  icon: React.ReactNode;
  category: 'land' | 'air' | 'sea';
  description: string;
}

interface TravelModeSelectorProps {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
  error?: string;
  className?: string;
}

const TravelModeSelector: React.FC<TravelModeSelectorProps> = ({
  value,
  onChange,
  error,
  className = ''
}) => {
  const travelModes: TravelModeOption[] = [
    // Land modes
    {
      mode: TravelMode.DRIVING,
      label: 'Driving',
      category: 'land',
      description: 'Car, truck, or motorcycle',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0M15 17a2 2 0 104 0" />
        </svg>
      )
    },
    {
      mode: TravelMode.WALKING,
      label: 'Walking',
      category: 'land',
      description: 'On foot',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      mode: TravelMode.CYCLING,
      label: 'Cycling',
      category: 'land',
      description: 'Bicycle or e-bike',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12a4 4 0 100-8 4 4 0 000 8zM16 12a4 4 0 100-8 4 4 0 000 8zM12 8l-2 4h4l-2-4z" />
        </svg>
      )
    },
    // Air modes
    {
      mode: TravelMode.FLYING,
      label: 'Flying',
      category: 'air',
      description: 'Commercial or private aircraft',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      )
    },
    // Sea modes
    {
      mode: TravelMode.SAILING,
      label: 'Sailing',
      category: 'sea',
      description: 'Sailboat or yacht',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v1a2 2 0 01-2 2H2m20-2a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2zm-5-2H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      mode: TravelMode.CRUISE,
      label: 'Cruise',
      category: 'sea',
      description: 'Cruise ship or ferry',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    }
  ];

  const categories = {
    land: { label: 'Land Travel', color: 'text-green-600' },
    air: { label: 'Air Travel', color: 'text-blue-600' },
    sea: { label: 'Sea Travel', color: 'text-cyan-600' }
  };

  const groupedModes = travelModes.reduce((acc, mode) => {
    if (!acc[mode.category]) {
      acc[mode.category] = [];
    }
    acc[mode.category].push(mode);
    return acc;
  }, {} as Record<string, TravelModeOption[]>);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Travel Mode
        <span className="text-red-500 ml-1">*</span>
      </label>
      
      <div className="space-y-4">
        {Object.entries(groupedModes).map(([category, modes]) => (
          <div key={category}>
            <h4 className={`text-sm font-medium mb-2 ${categories[category as keyof typeof categories].color}`}>
              {categories[category as keyof typeof categories].label}
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {modes.map((mode) => (
                <label
                  key={mode.mode}
                  className={`
                    relative flex items-center p-4 border rounded-lg cursor-pointer transition-all
                    hover:bg-gray-50 focus-within:ring-2 focus-within:ring-primary-500
                    ${value === mode.mode 
                      ? 'border-primary-500 bg-primary-50 text-primary-700' 
                      : 'border-gray-300 bg-white text-gray-900'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="travel-mode"
                    value={mode.mode}
                    checked={value === mode.mode}
                    onChange={(e) => onChange(e.target.value as TravelMode)}
                    className="sr-only"
                  />
                  
                  <div className="flex items-center space-x-3 w-full">
                    <div className={`
                      flex-shrink-0 p-2 rounded-md
                      ${value === mode.mode 
                        ? 'bg-primary-100 text-primary-600' 
                        : 'bg-gray-100 text-gray-600'
                      }
                    `}>
                      {mode.icon}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{mode.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{mode.description}</div>
                    </div>
                    
                    {value === mode.mode && (
                      <div className="flex-shrink-0">
                        <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default TravelModeSelector;