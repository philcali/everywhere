import React, { useState } from 'react';
import { TravelMode } from '../../types/shared';

interface JourneyFiltersProps {
  onFiltersChange: (filters: JourneyFilters) => void;
  availableTags: string[];
}

export interface JourneyFilters {
  searchTerm: string;
  travelMode?: TravelMode;
  tags: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  sortBy: 'createdAt' | 'name' | 'actualTravelDate';
  sortOrder: 'asc' | 'desc';
}

const JourneyFiltersComponent: React.FC<JourneyFiltersProps> = ({
  onFiltersChange,
  availableTags
}) => {
  const [filters, setFilters] = useState<JourneyFilters>({
    searchTerm: '',
    tags: [],
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilters = (newFilters: Partial<JourneyFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const clearFilters = () => {
    const clearedFilters: JourneyFilters = {
      searchTerm: '',
      tags: [],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    updateFilters({ tags: newTags });
  };

  const hasActiveFilters = filters.searchTerm || 
    filters.travelMode || 
    filters.tags.length > 0 || 
    filters.dateRange;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search journeys..."
            value={filters.searchTerm}
            onChange={(e) => updateFilters({ searchTerm: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
            Filters
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-') as [typeof filters.sortBy, typeof filters.sortOrder];
              updateFilters({ sortBy, sortOrder });
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="createdAt-desc">Newest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="actualTravelDate-desc">Travel Date (Recent)</option>
            <option value="actualTravelDate-asc">Travel Date (Oldest)</option>
          </select>
          
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Travel Mode
              </label>
              <select
                value={filters.travelMode || ''}
                onChange={(e) => updateFilters({ 
                  travelMode: e.target.value ? e.target.value as TravelMode : undefined 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Modes</option>
                <option value={TravelMode.DRIVING}>Driving</option>
                <option value={TravelMode.WALKING}>Walking</option>
                <option value={TravelMode.CYCLING}>Cycling</option>
                <option value={TravelMode.FLYING}>Flying</option>
                <option value={TravelMode.SAILING}>Sailing</option>
                <option value={TravelMode.CRUISE}>Cruise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date From
              </label>
              <input
                type="date"
                value={filters.dateRange?.start || ''}
                onChange={(e) => updateFilters({
                  dateRange: {
                    start: e.target.value,
                    end: filters.dateRange?.end || ''
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date To
              </label>
              <input
                type="date"
                value={filters.dateRange?.end || ''}
                onChange={(e) => updateFilters({
                  dateRange: {
                    start: filters.dateRange?.start || '',
                    end: e.target.value
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {availableTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.tags.includes(tag)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JourneyFiltersComponent;