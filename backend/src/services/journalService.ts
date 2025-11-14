import { 
  JourneyModel, 
  SavedJourney, 
  CreateJourneyData, 
  UpdateJourneyData, 
  JourneyQuery,
  JourneyExportData 
} from '../models/Journey.js';
import { Route } from '../../../shared/src/types/route.js';
import { WeatherForecast } from '../../../shared/src/types/weather.js';
import { TravelConfig } from '../../../shared/src/types/travel.js';

export interface SaveJourneyRequest {
  name: string;
  description?: string;
  route: Route;
  weatherData: WeatherForecast[];
  travelConfig: TravelConfig;
  metadata?: {
    actualTravelDate?: string;
    tags?: string[];
    rating?: number;
    notes?: string;
  };
}

export interface UpdateJourneyRequest {
  name?: string;
  description?: string;
  metadata?: {
    actualTravelDate?: string;
    tags?: string[];
    rating?: number;
    notes?: string;
  };
}

export interface JourneyListQuery {
  dateRange?: {
    start: string;
    end: string;
  };
  travelMode?: string;
  tags?: string[];
  searchTerm?: string;
  rating?: number;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'name' | 'rating' | 'actual_travel_date';
  sortOrder?: 'ASC' | 'DESC';
}

export interface JourneyListResponse {
  journeys: SavedJourney[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface JourneyStatsResponse {
  totalJourneys: number;
  totalDistance: number;
  totalDuration: number;
  favoriteMode: string | null;
  averageRating: number | null;
}

export class JournalService {
  /**
   * Save a new journey to the user's travel journal
   */
  static async saveJourney(userId: number, journeyData: SaveJourneyRequest): Promise<SavedJourney> {
    // Validate input data
    this.validateJourneyData(journeyData);

    // Prepare metadata with proper date conversion
    const metadata = journeyData.metadata ? {
      ...journeyData.metadata,
      actualTravelDate: journeyData.metadata.actualTravelDate 
        ? new Date(journeyData.metadata.actualTravelDate)
        : undefined
    } : undefined;

    const createData: CreateJourneyData = {
      userId,
      name: journeyData.name,
      description: journeyData.description,
      route: journeyData.route,
      weatherData: journeyData.weatherData,
      travelConfig: journeyData.travelConfig,
      metadata
    };

    return await JourneyModel.create(createData);
  }

  /**
   * Retrieve a specific journey by ID
   */
  static async getJourney(journeyId: number, userId: number): Promise<SavedJourney | null> {
    return await JourneyModel.findByIdAndUserId(journeyId, userId);
  }

  /**
   * Retrieve user's journeys with filtering and pagination
   */
  static async getJourneys(userId: number, query: JourneyListQuery = {}): Promise<JourneyListResponse> {
    const {
      dateRange,
      travelMode,
      tags,
      searchTerm,
      rating,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = query;

    // Validate pagination parameters
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page
    const offset = (safePage - 1) * safeLimit;

    // Prepare query parameters
    const queryParams: JourneyQuery = {
      userId,
      limit: safeLimit,
      offset,
      sortBy,
      sortOrder
    };

    if (dateRange) {
      queryParams.dateRange = {
        start: new Date(dateRange.start),
        end: new Date(dateRange.end)
      };
    }

    if (travelMode) {
      queryParams.travelMode = travelMode;
    }

    if (tags && tags.length > 0) {
      queryParams.tags = tags;
    }

    if (searchTerm) {
      queryParams.searchTerm = searchTerm.trim();
    }

    if (rating !== undefined) {
      queryParams.rating = rating;
    }

    const { journeys, total } = await JourneyModel.query(queryParams);

    return {
      journeys,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  }

  /**
   * Update an existing journey
   */
  static async updateJourney(
    journeyId: number, 
    userId: number, 
    updateData: UpdateJourneyRequest
  ): Promise<SavedJourney | null> {
    // Validate update data
    if (updateData.name !== undefined && !updateData.name.trim()) {
      throw new Error('Journey name cannot be empty');
    }

    if (updateData.metadata?.rating !== undefined) {
      const rating = updateData.metadata.rating;
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        throw new Error('Rating must be an integer between 1 and 5');
      }
    }

    // Prepare metadata with proper date conversion
    const metadata = updateData.metadata ? {
      ...updateData.metadata,
      actualTravelDate: updateData.metadata.actualTravelDate 
        ? new Date(updateData.metadata.actualTravelDate)
        : undefined
    } : undefined;

    const updatePayload: UpdateJourneyData = {
      name: updateData.name,
      description: updateData.description,
      metadata
    };

    return await JourneyModel.update(journeyId, userId, updatePayload);
  }

  /**
   * Delete a journey
   */
  static async deleteJourney(journeyId: number, userId: number): Promise<boolean> {
    return await JourneyModel.delete(journeyId, userId);
  }

  /**
   * Get user's journey statistics
   */
  static async getUserStats(userId: number): Promise<JourneyStatsResponse> {
    return await JourneyModel.getUserStats(userId);
  }

  /**
   * Get all unique tags for a user
   */
  static async getUserTags(userId: number): Promise<string[]> {
    return await JourneyModel.getUserTags(userId);
  }

  /**
   * Export a specific journey
   */
  static async exportJourney(journeyId: number, userId: number): Promise<JourneyExportData | null> {
    return await JourneyModel.exportJourney(journeyId, userId);
  }

  /**
   * Export all journeys for a user
   */
  static async exportAllJourneys(userId: number): Promise<JourneyExportData[]> {
    return await JourneyModel.exportAllJourneys(userId);
  }

  /**
   * Search journeys by text across multiple fields
   */
  static async searchJourneys(
    userId: number, 
    searchTerm: string, 
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ journeys: SavedJourney[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    if (!searchTerm.trim()) {
      return { journeys: [], total: 0 };
    }

    return await JourneyModel.query({
      userId,
      searchTerm: searchTerm.trim(),
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });
  }

  /**
   * Get journeys by travel mode
   */
  static async getJourneysByMode(
    userId: number, 
    travelMode: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ journeys: SavedJourney[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    return await JourneyModel.query({
      userId,
      travelMode,
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });
  }

  /**
   * Get journeys by tags
   */
  static async getJourneysByTags(
    userId: number, 
    tags: string[],
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ journeys: SavedJourney[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    if (!tags.length) {
      return { journeys: [], total: 0 };
    }

    return await JourneyModel.query({
      userId,
      tags,
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });
  }

  /**
   * Get recent journeys for a user
   */
  static async getRecentJourneys(
    userId: number, 
    limit: number = 10
  ): Promise<SavedJourney[]> {
    const { journeys } = await JourneyModel.query({
      userId,
      limit: Math.min(limit, 50), // Cap at 50
      offset: 0,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });

    return journeys;
  }

  /**
   * Get journeys within a date range
   */
  static async getJourneysByDateRange(
    userId: number,
    startDate: Date,
    endDate: Date,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ journeys: SavedJourney[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    if (startDate > endDate) {
      throw new Error('Start date must be before end date');
    }

    return await JourneyModel.query({
      userId,
      dateRange: { start: startDate, end: endDate },
      limit,
      offset,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });
  }

  /**
   * Validate journey data before saving
   */
  private static validateJourneyData(journeyData: SaveJourneyRequest): void {
    // Validate name
    if (!journeyData.name || !journeyData.name.trim()) {
      throw new Error('Journey name is required');
    }

    if (journeyData.name.length > 255) {
      throw new Error('Journey name must be less than 255 characters');
    }

    // Validate description
    if (journeyData.description && journeyData.description.length > 1000) {
      throw new Error('Journey description must be less than 1000 characters');
    }

    // Validate route
    if (!journeyData.route) {
      throw new Error('Route data is required');
    }

    if (!journeyData.route.source || !journeyData.route.destination) {
      throw new Error('Route must have source and destination');
    }

    // Validate weather data
    if (!journeyData.weatherData || !Array.isArray(journeyData.weatherData)) {
      throw new Error('Weather data is required and must be an array');
    }

    // Validate travel config
    if (!journeyData.travelConfig) {
      throw new Error('Travel configuration is required');
    }

    if (!journeyData.travelConfig.mode) {
      throw new Error('Travel mode is required');
    }

    // Validate metadata if provided
    if (journeyData.metadata) {
      if (journeyData.metadata.rating !== undefined) {
        const rating = journeyData.metadata.rating;
        if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
          throw new Error('Rating must be an integer between 1 and 5');
        }
      }

      if (journeyData.metadata.tags && !Array.isArray(journeyData.metadata.tags)) {
        throw new Error('Tags must be an array');
      }

      if (journeyData.metadata.notes && journeyData.metadata.notes.length > 2000) {
        throw new Error('Notes must be less than 2000 characters');
      }

      if (journeyData.metadata.actualTravelDate) {
        const travelDate = new Date(journeyData.metadata.actualTravelDate);
        if (isNaN(travelDate.getTime())) {
          throw new Error('Invalid travel date format');
        }
      }
    }
  }
}