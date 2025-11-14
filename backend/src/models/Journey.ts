import { database } from '../database/connection.js';
import { Route } from '../../../shared/src/types/route.js';
import { WeatherForecast } from '../../../shared/src/types/weather.js';
import { TravelConfig } from '../../../shared/src/types/travel.js';

export interface JourneyMetadata {
  actualTravelDate?: Date;
  tags: string[];
  rating?: number;
  notes?: string;
}

export interface SavedJourney {
  id: number;
  userId: number;
  name: string;
  description?: string;
  createdAt: Date;
  route: Route;
  weatherData: WeatherForecast[];
  travelConfig: TravelConfig;
  metadata: JourneyMetadata;
}

export interface CreateJourneyData {
  userId: number;
  name: string;
  description?: string;
  route: Route;
  weatherData: WeatherForecast[];
  travelConfig: TravelConfig;
  metadata?: Partial<JourneyMetadata>;
}

export interface UpdateJourneyData {
  name?: string;
  description?: string;
  metadata?: Partial<JourneyMetadata>;
}

export interface JourneyQuery {
  userId: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
  travelMode?: string;
  tags?: string[];
  searchTerm?: string;
  rating?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'name' | 'rating' | 'actual_travel_date';
  sortOrder?: 'ASC' | 'DESC';
}

export interface JourneyRow {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  created_at: string;
  route_data: string;
  weather_data: string;
  travel_config: string;
  actual_travel_date?: string;
  tags?: string;
  rating?: number;
  notes?: string;
}

export interface JourneyExportData {
  journey: SavedJourney;
  exportedAt: Date;
  version: string;
}

export class JourneyModel {
  /**
   * Create a new saved journey
   */
  static async create(journeyData: CreateJourneyData): Promise<SavedJourney> {
    const { userId, name, description, route, weatherData, travelConfig, metadata = {} } = journeyData;

    // Validate required fields
    if (!name.trim()) {
      throw new Error('Journey name is required');
    }

    // Prepare metadata with defaults
    const journeyMetadata: JourneyMetadata = {
      tags: [],
      ...metadata
    };

    try {
      const result = await database.run(`
        INSERT INTO saved_journeys (
          user_id, name, description, route_data, weather_data, travel_config,
          actual_travel_date, tags, rating, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        name.trim(),
        description?.trim() || null,
        JSON.stringify(route),
        JSON.stringify(weatherData),
        JSON.stringify(travelConfig),
        journeyMetadata.actualTravelDate?.toISOString() || null,
        JSON.stringify(journeyMetadata.tags),
        journeyMetadata.rating || null,
        journeyMetadata.notes?.trim() || null
      ]);

      const journey = await this.findById(result.lastID);
      if (!journey) {
        throw new Error('Failed to create journey');
      }

      return journey;
    } catch (error: any) {
      if (error.message?.includes('FOREIGN KEY constraint failed')) {
        throw new Error('Invalid user ID');
      }
      throw error;
    }
  }

  /**
   * Find journey by ID
   */
  static async findById(id: number): Promise<SavedJourney | null> {
    const row = await database.get<JourneyRow>(`
      SELECT * FROM saved_journeys WHERE id = ?
    `, [id]);

    return row ? this.mapRowToJourney(row) : null;
  }

  /**
   * Find journey by ID and user ID (for authorization)
   */
  static async findByIdAndUserId(id: number, userId: number): Promise<SavedJourney | null> {
    const row = await database.get<JourneyRow>(`
      SELECT * FROM saved_journeys WHERE id = ? AND user_id = ?
    `, [id, userId]);

    return row ? this.mapRowToJourney(row) : null;
  }

  /**
   * Query journeys with filtering and pagination
   */
  static async query(queryParams: JourneyQuery): Promise<{ journeys: SavedJourney[]; total: number }> {
    const {
      userId,
      dateRange,
      travelMode,
      tags,
      searchTerm,
      rating,
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = queryParams;

    // Build WHERE clause
    const whereConditions: string[] = ['user_id = ?'];
    const whereParams: any[] = [userId];

    if (dateRange) {
      whereConditions.push('created_at BETWEEN ? AND ?');
      whereParams.push(dateRange.start.toISOString(), dateRange.end.toISOString());
    }

    if (travelMode) {
      whereConditions.push('json_extract(travel_config, "$.mode") = ?');
      whereParams.push(travelMode);
    }

    if (tags && tags.length > 0) {
      // Check if any of the provided tags exist in the journey's tags
      const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
      whereConditions.push(`(${tagConditions})`);
      tags.forEach(tag => whereParams.push(`%"${tag}"%`));
    }

    if (searchTerm) {
      whereConditions.push('(name LIKE ? OR description LIKE ? OR notes LIKE ?)');
      const searchPattern = `%${searchTerm}%`;
      whereParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (rating !== undefined) {
      whereConditions.push('rating = ?');
      whereParams.push(rating);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await database.get<{ count: number }>(`
      SELECT COUNT(*) as count FROM saved_journeys WHERE ${whereClause}
    `, whereParams);

    const total = countResult?.count || 0;

    // Get journeys with pagination
    const validSortColumns = ['created_at', 'name', 'rating', 'actual_travel_date'];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const rows = await database.all<JourneyRow>(`
      SELECT * FROM saved_journeys 
      WHERE ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `, [...whereParams, limit, offset]);

    const journeys = rows.map(row => this.mapRowToJourney(row));

    return { journeys, total };
  }

  /**
   * Update journey
   */
  static async update(id: number, userId: number, updateData: UpdateJourneyData): Promise<SavedJourney | null> {
    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.name !== undefined) {
      if (!updateData.name.trim()) {
        throw new Error('Journey name cannot be empty');
      }
      updates.push('name = ?');
      values.push(updateData.name.trim());
    }

    if (updateData.description !== undefined) {
      updates.push('description = ?');
      values.push(updateData.description?.trim() || null);
    }

    if (updateData.metadata) {
      // Get current journey to merge metadata
      const currentJourney = await this.findByIdAndUserId(id, userId);
      if (!currentJourney) {
        return null;
      }

      const mergedMetadata = { ...currentJourney.metadata, ...updateData.metadata };

      if (mergedMetadata.actualTravelDate !== undefined) {
        updates.push('actual_travel_date = ?');
        values.push(mergedMetadata.actualTravelDate?.toISOString() || null);
      }

      if (mergedMetadata.tags !== undefined) {
        updates.push('tags = ?');
        values.push(JSON.stringify(mergedMetadata.tags));
      }

      if (mergedMetadata.rating !== undefined) {
        updates.push('rating = ?');
        values.push(mergedMetadata.rating);
      }

      if (mergedMetadata.notes !== undefined) {
        updates.push('notes = ?');
        values.push(mergedMetadata.notes?.trim() || null);
      }
    }

    if (updates.length === 0) {
      return this.findByIdAndUserId(id, userId);
    }

    values.push(id, userId);
    const result = await database.run(`
      UPDATE saved_journeys SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `, values);

    if (result.changes === 0) {
      return null;
    }

    return this.findByIdAndUserId(id, userId);
  }

  /**
   * Delete journey
   */
  static async delete(id: number, userId: number): Promise<boolean> {
    const result = await database.run(`
      DELETE FROM saved_journeys WHERE id = ? AND user_id = ?
    `, [id, userId]);

    return result.changes > 0;
  }

  /**
   * Get journey statistics for a user
   */
  static async getUserStats(userId: number): Promise<{
    totalJourneys: number;
    totalDistance: number;
    totalDuration: number;
    favoriteMode: string | null;
    averageRating: number | null;
  }> {
    const stats = await database.get<{
      total_journeys: number;
      total_distance: number;
      total_duration: number;
      avg_rating: number | null;
    }>(`
      SELECT 
        COUNT(*) as total_journeys,
        COALESCE(SUM(json_extract(route_data, '$.totalDistance')), 0) as total_distance,
        COALESCE(SUM(json_extract(route_data, '$.estimatedDuration')), 0) as total_duration,
        AVG(rating) as avg_rating
      FROM saved_journeys 
      WHERE user_id = ?
    `, [userId]);

    // Get favorite travel mode
    const modeResult = await database.get<{ mode: string; count: number }>(`
      SELECT 
        json_extract(travel_config, '$.mode') as mode,
        COUNT(*) as count
      FROM saved_journeys 
      WHERE user_id = ?
      GROUP BY json_extract(travel_config, '$.mode')
      ORDER BY count DESC
      LIMIT 1
    `, [userId]);

    return {
      totalJourneys: stats?.total_journeys || 0,
      totalDistance: stats?.total_distance || 0,
      totalDuration: stats?.total_duration || 0,
      favoriteMode: modeResult?.mode || null,
      averageRating: stats?.avg_rating || null
    };
  }

  /**
   * Export journey data for backup
   */
  static async exportJourney(id: number, userId: number): Promise<JourneyExportData | null> {
    const journey = await this.findByIdAndUserId(id, userId);
    if (!journey) {
      return null;
    }

    return {
      journey,
      exportedAt: new Date(),
      version: '1.0'
    };
  }

  /**
   * Export all journeys for a user
   */
  static async exportAllJourneys(userId: number): Promise<JourneyExportData[]> {
    const { journeys } = await this.query({ userId, limit: 1000 }); // Get all journeys
    
    return journeys.map(journey => ({
      journey,
      exportedAt: new Date(),
      version: '1.0'
    }));
  }

  /**
   * Get unique tags for a user
   */
  static async getUserTags(userId: number): Promise<string[]> {
    const rows = await database.all<{ tags: string }>(`
      SELECT DISTINCT tags FROM saved_journeys 
      WHERE user_id = ? AND tags IS NOT NULL AND tags != '[]'
    `, [userId]);

    const allTags = new Set<string>();
    
    rows.forEach(row => {
      try {
        const tags = JSON.parse(row.tags) as string[];
        tags.forEach(tag => allTags.add(tag));
      } catch (error) {
        // Skip invalid JSON
      }
    });

    return Array.from(allTags).sort();
  }

  /**
   * Map database row to SavedJourney object
   */
  private static mapRowToJourney(row: JourneyRow): SavedJourney {
    try {
      const route = JSON.parse(row.route_data) as Route;
      const weatherData = JSON.parse(row.weather_data) as WeatherForecast[];
      const travelConfig = JSON.parse(row.travel_config) as TravelConfig;
      const tags = row.tags ? JSON.parse(row.tags) as string[] : [];

      // Convert date strings back to Date objects in weather data
      const processedWeatherData = weatherData.map(forecast => ({
        ...forecast,
        timestamp: new Date(forecast.timestamp)
      }));

      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description || undefined,
        createdAt: new Date(row.created_at),
        route,
        weatherData: processedWeatherData,
        travelConfig,
        metadata: {
          actualTravelDate: row.actual_travel_date ? new Date(row.actual_travel_date) : undefined,
          tags,
          rating: row.rating || undefined,
          notes: row.notes || undefined
        }
      };
    } catch (error) {
      throw new Error(`Failed to parse journey data: ${error}`);
    }
  }
}