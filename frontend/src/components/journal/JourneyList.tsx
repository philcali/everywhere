import React, { useState, useEffect } from 'react';
import { SavedJourney, JourneyListResponse } from '../../types/shared';
import JourneyCard from './JourneyCard';
import JourneyFilters, { JourneyFilters as FilterType } from './JourneyFilters';

interface JourneyListProps {
  onJourneySelect: (journey: SavedJourney) => void;
  onJourneyDelete: (journeyId: string) => Promise<void>;
  onJourneyCompare: (journeys: SavedJourney[]) => void;
  fetchJourneys: (filters: FilterType, offset?: number) => Promise<JourneyListResponse>;
}

const JourneyList: React.FC<JourneyListProps> = ({
  onJourneySelect,
  onJourneyDelete,
  onJourneyCompare,
  fetchJourneys
}) => {
  const [journeys, setJourneys] = useState<SavedJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedJourneys, setSelectedJourneys] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [currentFilters, setCurrentFilters] = useState<FilterType>({
    searchTerm: '',
    tags: [],
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const loadJourneys = async (filters: FilterType, offset = 0, append = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchJourneys(filters, offset);
      
      if (append) {
        setJourneys(prev => [...prev, ...response.journeys]);
      } else {
        setJourneys(response.journeys);
      }
      
      setHasMore(response.hasMore);
      
      // Extract unique tags from all journeys
      const allTags = response.journeys.flatMap(j => j.metadata.tags);
      const uniqueTags = Array.from(new Set(allTags)).sort();
      setAvailableTags(uniqueTags);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journeys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJourneys(currentFilters);
  }, [currentFilters]);

  const handleFiltersChange = (filters: FilterType) => {
    setCurrentFilters(filters);
    setSelectedJourneys([]); // Clear selection when filters change
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadJourneys(currentFilters, journeys.length, true);
    }
  };

  const handleJourneyDelete = async (journeyId: string) => {
    if (window.confirm('Are you sure you want to delete this journey?')) {
      try {
        await onJourneyDelete(journeyId);
        setJourneys(prev => prev.filter(j => j.id !== journeyId));
        setSelectedJourneys(prev => prev.filter(id => id !== journeyId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete journey');
      }
    }
  };

  const toggleJourneySelection = (journeyId: string) => {
    setSelectedJourneys(prev => 
      prev.includes(journeyId)
        ? prev.filter(id => id !== journeyId)
        : [...prev, journeyId]
    );
  };

  const handleCompareSelected = () => {
    const selectedJourneyObjects = journeys.filter(j => selectedJourneys.includes(j.id));
    onJourneyCompare(selectedJourneyObjects);
  };

  const clearSelection = () => {
    setSelectedJourneys([]);
  };

  if (loading && journeys.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your journeys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Travel Journal</h2>
        {selectedJourneys.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {selectedJourneys.length} selected
            </span>
            {selectedJourneys.length > 1 && (
              <button
                onClick={handleCompareSelected}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                Compare Selected
              </button>
            )}
            <button
              onClick={clearSelection}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      <JourneyFilters
        onFiltersChange={handleFiltersChange}
        availableTags={availableTags}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {journeys.length === 0 && !loading ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No journeys found</h3>
          <p className="text-gray-600 mb-4">
            {currentFilters.searchTerm || currentFilters.travelMode || currentFilters.tags.length > 0 || currentFilters.dateRange
              ? 'Try adjusting your filters to see more results.'
              : 'Start planning your first journey to see it here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {journeys.map((journey) => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                onClick={() => onJourneySelect(journey)}
                onDelete={() => handleJourneyDelete(journey.id)}
                onCompare={() => toggleJourneySelection(journey.id)}
                isSelected={selectedJourneys.includes(journey.id)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="text-center py-6">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default JourneyList;