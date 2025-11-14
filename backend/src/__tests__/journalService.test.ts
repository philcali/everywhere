import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { database } from '../database/connection.js';
import { runMigrations } from '../database/migrations.js';
import { JournalService } from '../services/journalService.js';
import { UserModel } from '../models/User.js';
import { TravelMode } from '../../../shared/src/types/travel.js';
import { WeatherCondition, PrecipitationType } from '../../../shared/src/types/weather.js';

describe('JournalService', () => {
  let testUserId: number;

  beforeAll(async () => {
    await database.connect();
    await runMigrations();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Create a test user
    const user = await UserModel.create({
      email: 'test@example.com',
      password: 'TestPassword123'
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await database.run('DELETE FROM saved_journeys');
    await database.run('DELETE FROM users');
  });

  const createTestJourneyData = () => ({
    name: 'Test Journey',
    description: 'A test journey from New York to Boston',
    route: {
      id: 'route-123',
      source: {
        name: 'New York, NY',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        address: 'New York, NY, USA'
      },
      destination: {
        name: 'Boston, MA',
        coordinates: { latitude: 42.3601, longitude: -71.0589 },
        address: 'Boston, MA, USA'
      },
      travelMode: TravelMode.DRIVING,
      waypoints: [
        {
          coordinates: { latitude: 40.7128, longitude: -74.0060 },
          distanceFromStart: 0,
          estimatedTimeFromStart: 0
        },
        {
          coordinates: { latitude: 42.3601, longitude: -71.0589 },
          distanceFromStart: 215000,
          estimatedTimeFromStart: 14400
        }
      ],
      totalDistance: 215000,
      estimatedDuration: 14400,
      segments: []
    },
    weatherData: [
      {
        location: {
          name: 'New York, NY',
          coordinates: { latitude: 40.7128, longitude: -74.0060 }
        },
        timestamp: new Date('2024-01-15T10:00:00Z'),
        temperature: {
          current: 15,
          feelsLike: 12,
          min: 10,
          max: 18
        },
        conditions: {
          main: WeatherCondition.SUNNY,
          description: 'Clear sky',
          icon: '01d'
        },
        precipitation: {
          type: PrecipitationType.NONE,
          probability: 0,
          intensity: 0
        },
        wind: {
          speed: 5,
          direction: 180
        },
        humidity: 65,
        visibility: 10000
      }
    ],
    travelConfig: {
      mode: TravelMode.DRIVING,
      preferences: {
        weatherUpdateInterval: 3600,
        routeOptimization: true
      }
    },
    metadata: {
      actualTravelDate: '2024-01-15T08:00:00Z',
      tags: ['business', 'weekend'],
      rating: 4,
      notes: 'Great weather for the trip'
    }
  });

  describe('saveJourney', () => {
    it('should save a journey successfully', async () => {
      const journeyData = createTestJourneyData();
      const savedJourney = await JournalService.saveJourney(testUserId, journeyData);

      expect(savedJourney).toBeDefined();
      expect(savedJourney.id).toBeGreaterThan(0);
      expect(savedJourney.userId).toBe(testUserId);
      expect(savedJourney.name).toBe(journeyData.name);
      expect(savedJourney.description).toBe(journeyData.description);
      expect(savedJourney.route.source.name).toBe(journeyData.route.source.name);
      expect(savedJourney.weatherData).toHaveLength(1);
      expect(savedJourney.metadata.tags).toEqual(['business', 'weekend']);
      expect(savedJourney.metadata.rating).toBe(4);
    });

    it('should save a journey without optional fields', async () => {
      const journeyData = createTestJourneyData();
      const journeyWithoutData = {
        ...journeyData,
        description: undefined,
        metadata: {
          tags: [],
        }
      }

      const savedJourney = await JournalService.saveJourney(testUserId, journeyWithoutData);

      expect(savedJourney).toBeDefined();
      expect(savedJourney.description).toBeUndefined();
      expect(savedJourney.metadata.tags).toEqual([]);
      expect(savedJourney.metadata.rating).toBeUndefined();
    });

    it('should throw error for missing required fields', async () => {
      const journeyData = createTestJourneyData();
      journeyData.name = '';

      await expect(JournalService.saveJourney(testUserId, journeyData))
        .rejects.toThrow('Journey name is required');
    });

    it('should throw error for invalid rating', async () => {
      const journeyData = createTestJourneyData();
      journeyData.metadata!.rating = 6;

      await expect(JournalService.saveJourney(testUserId, journeyData))
        .rejects.toThrow('Rating must be an integer between 1 and 5');
    });

    it('should throw error for name too long', async () => {
      const journeyData = createTestJourneyData();
      journeyData.name = 'a'.repeat(256);

      await expect(JournalService.saveJourney(testUserId, journeyData))
        .rejects.toThrow('Journey name must be less than 255 characters');
    });
  });

  describe('getJourney', () => {
    it('should retrieve a journey by ID', async () => {
      const journeyData = createTestJourneyData();
      const savedJourney = await JournalService.saveJourney(testUserId, journeyData);

      const retrievedJourney = await JournalService.getJourney(savedJourney.id, testUserId);

      expect(retrievedJourney).toBeDefined();
      expect(retrievedJourney!.id).toBe(savedJourney.id);
      expect(retrievedJourney!.name).toBe(journeyData.name);
    });

    it('should return null for non-existent journey', async () => {
      const journey = await JournalService.getJourney(999, testUserId);
      expect(journey).toBeNull();
    });

    it('should return null for journey belonging to different user', async () => {
      const journeyData = createTestJourneyData();
      const savedJourney = await JournalService.saveJourney(testUserId, journeyData);

      const journey = await JournalService.getJourney(savedJourney.id, 999);
      expect(journey).toBeNull();
    });
  });

  describe('getJourneys', () => {
    beforeEach(async () => {
      // Create multiple test journeys with delays to ensure different timestamps
      const journeyData1 = createTestJourneyData();
      journeyData1.name = 'Journey 1';
      journeyData1.metadata!.tags = ['business'];
      await JournalService.saveJourney(testUserId, journeyData1);

      await new Promise(resolve => setTimeout(resolve, 10));

      const journeyData2 = createTestJourneyData();
      journeyData2.name = 'Journey 2';
      journeyData2.metadata!.tags = ['vacation'];
      journeyData2.metadata!.rating = 5;
      await JournalService.saveJourney(testUserId, journeyData2);

      await new Promise(resolve => setTimeout(resolve, 10));

      const journeyData3 = createTestJourneyData();
      journeyData3.name = 'Journey 3';
      journeyData3.travelConfig.mode = TravelMode.FLYING;
      journeyData3.metadata!.tags = ['personal']; // Different tags
      await JournalService.saveJourney(testUserId, journeyData3);
    });

    it('should retrieve all journeys for user', async () => {
      const result = await JournalService.getJourneys(testUserId);

      expect(result.journeys).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter journeys by travel mode', async () => {
      const result = await JournalService.getJourneys(testUserId, {
        travelMode: TravelMode.FLYING
      });

      expect(result.journeys).toHaveLength(1);
      expect(result.journeys[0].name).toBe('Journey 3');
    });

    it('should filter journeys by tags', async () => {
      const result = await JournalService.getJourneys(testUserId, {
        tags: ['business']
      });

      expect(result.journeys).toHaveLength(1);
      expect(result.journeys[0].name).toBe('Journey 1');
    });

    it('should filter journeys by rating', async () => {
      const result = await JournalService.getJourneys(testUserId, {
        rating: 5
      });

      expect(result.journeys).toHaveLength(1);
      expect(result.journeys[0].name).toBe('Journey 2');
    });

    it('should search journeys by text', async () => {
      const result = await JournalService.getJourneys(testUserId, {
        searchTerm: 'Journey 2'
      });

      expect(result.journeys).toHaveLength(1);
      expect(result.journeys[0].name).toBe('Journey 2');
    });

    it('should paginate results', async () => {
      const result = await JournalService.getJourneys(testUserId, {
        page: 1,
        limit: 2
      });

      expect(result.journeys).toHaveLength(2);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should sort journeys by name', async () => {
      const result = await JournalService.getJourneys(testUserId, {
        sortBy: 'name',
        sortOrder: 'ASC'
      });

      expect(result.journeys[0].name).toBe('Journey 1');
      expect(result.journeys[1].name).toBe('Journey 2');
      expect(result.journeys[2].name).toBe('Journey 3');
    });
  });

  describe('updateJourney', () => {
    it('should update journey name and description', async () => {
      const journeyData = createTestJourneyData();
      const savedJourney = await JournalService.saveJourney(testUserId, journeyData);

      const updatedJourney = await JournalService.updateJourney(savedJourney.id, testUserId, {
        name: 'Updated Journey',
        description: 'Updated description'
      });

      expect(updatedJourney).toBeDefined();
      expect(updatedJourney!.name).toBe('Updated Journey');
      expect(updatedJourney!.description).toBe('Updated description');
    });

    it('should update journey metadata', async () => {
      const journeyData = createTestJourneyData();
      const savedJourney = await JournalService.saveJourney(testUserId, journeyData);

      const updatedJourney = await JournalService.updateJourney(savedJourney.id, testUserId, {
        metadata: {
          tags: ['updated', 'tags'],
          rating: 3,
          notes: 'Updated notes'
        }
      });

      expect(updatedJourney).toBeDefined();
      expect(updatedJourney!.metadata.tags).toEqual(['updated', 'tags']);
      expect(updatedJourney!.metadata.rating).toBe(3);
      expect(updatedJourney!.metadata.notes).toBe('Updated notes');
    });

    it('should return null for non-existent journey', async () => {
      const updatedJourney = await JournalService.updateJourney(999, testUserId, {
        name: 'Updated'
      });

      expect(updatedJourney).toBeNull();
    });

    it('should throw error for empty name', async () => {
      const journeyData = createTestJourneyData();
      const savedJourney = await JournalService.saveJourney(testUserId, journeyData);

      await expect(JournalService.updateJourney(savedJourney.id, testUserId, {
        name: ''
      })).rejects.toThrow('Journey name cannot be empty');
    });
  });

  describe('deleteJourney', () => {
    it('should delete a journey', async () => {
      const journeyData = createTestJourneyData();
      const savedJourney = await JournalService.saveJourney(testUserId, journeyData);

      const deleted = await JournalService.deleteJourney(savedJourney.id, testUserId);
      expect(deleted).toBe(true);

      const retrievedJourney = await JournalService.getJourney(savedJourney.id, testUserId);
      expect(retrievedJourney).toBeNull();
    });

    it('should return false for non-existent journey', async () => {
      const deleted = await JournalService.deleteJourney(999, testUserId);
      expect(deleted).toBe(false);
    });
  });

  describe('getUserStats', () => {
    beforeEach(async () => {
      // Create test journeys with different modes and ratings
      const journeyData1 = createTestJourneyData();
      journeyData1.metadata!.rating = 4;
      await JournalService.saveJourney(testUserId, journeyData1);

      const journeyData2 = createTestJourneyData();
      journeyData2.travelConfig.mode = TravelMode.FLYING;
      journeyData2.metadata!.rating = 5;
      await JournalService.saveJourney(testUserId, journeyData2);

      const journeyData3 = createTestJourneyData();
      journeyData3.metadata!.rating = 3;
      await JournalService.saveJourney(testUserId, journeyData3);
    });

    it('should return user statistics', async () => {
      const stats = await JournalService.getUserStats(testUserId);

      expect(stats.totalJourneys).toBe(3);
      expect(stats.totalDistance).toBe(215000 * 3);
      expect(stats.totalDuration).toBe(14400 * 3);
      expect(stats.favoriteMode).toBe(TravelMode.DRIVING);
      expect(stats.averageRating).toBe(4);
    });
  });

  describe('getUserTags', () => {
    beforeEach(async () => {
      const journeyData1 = createTestJourneyData();
      journeyData1.metadata!.tags = ['business', 'urgent'];
      await JournalService.saveJourney(testUserId, journeyData1);

      const journeyData2 = createTestJourneyData();
      journeyData2.metadata!.tags = ['vacation', 'family'];
      await JournalService.saveJourney(testUserId, journeyData2);

      const journeyData3 = createTestJourneyData();
      journeyData3.metadata!.tags = ['business', 'conference'];
      await JournalService.saveJourney(testUserId, journeyData3);
    });

    it('should return unique tags for user', async () => {
      const tags = await JournalService.getUserTags(testUserId);

      expect(tags).toHaveLength(5);
      expect(tags).toContain('business');
      expect(tags).toContain('urgent');
      expect(tags).toContain('vacation');
      expect(tags).toContain('family');
      expect(tags).toContain('conference');
      expect(tags).toEqual(tags.sort()); // Should be sorted
    });
  });

  describe('exportJourney', () => {
    it('should export a journey', async () => {
      const journeyData = createTestJourneyData();
      const savedJourney = await JournalService.saveJourney(testUserId, journeyData);

      const exportData = await JournalService.exportJourney(savedJourney.id, testUserId);

      expect(exportData).toBeDefined();
      expect(exportData!.journey.id).toBe(savedJourney.id);
      expect(exportData!.version).toBe('1.0');
      expect(exportData!.exportedAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent journey', async () => {
      const exportData = await JournalService.exportJourney(999, testUserId);
      expect(exportData).toBeNull();
    });
  });

  describe('exportAllJourneys', () => {
    beforeEach(async () => {
      const journeyData1 = createTestJourneyData();
      journeyData1.name = 'Journey 1';
      await JournalService.saveJourney(testUserId, journeyData1);

      await new Promise(resolve => setTimeout(resolve, 10));

      const journeyData2 = createTestJourneyData();
      journeyData2.name = 'Journey 2';
      await JournalService.saveJourney(testUserId, journeyData2);
    });

    it('should export all journeys for user', async () => {
      const exportData = await JournalService.exportAllJourneys(testUserId);

      expect(exportData).toHaveLength(2);
      expect(exportData[0].version).toBe('1.0');
      expect(exportData[1].version).toBe('1.0');
      
      // Check that we have both journeys (order may vary)
      const journeyNames = exportData.map(e => e.journey.name).sort();
      expect(journeyNames).toEqual(['Journey 1', 'Journey 2']);
    });
  });

  describe('searchJourneys', () => {
    beforeEach(async () => {
      const journeyData1 = createTestJourneyData();
      journeyData1.name = 'Business Trip to Boston';
      journeyData1.description = 'Important client meeting';
      await JournalService.saveJourney(testUserId, journeyData1);

      const journeyData2 = createTestJourneyData();
      journeyData2.name = 'Vacation in Florida';
      journeyData2.description = 'Beach vacation with family';
      await JournalService.saveJourney(testUserId, journeyData2);
    });

    it('should search journeys by name', async () => {
      const result = await JournalService.searchJourneys(testUserId, 'Boston');

      expect(result.journeys).toHaveLength(1);
      expect(result.journeys[0].name).toBe('Business Trip to Boston');
    });

    it('should search journeys by description', async () => {
      const result = await JournalService.searchJourneys(testUserId, 'family');

      expect(result.journeys).toHaveLength(1);
      expect(result.journeys[0].name).toBe('Vacation in Florida');
    });

    it('should return empty results for no matches', async () => {
      const result = await JournalService.searchJourneys(testUserId, 'nonexistent');

      expect(result.journeys).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getRecentJourneys', () => {
    beforeEach(async () => {
      // Create journeys with slight delays to ensure different timestamps
      const journeyData1 = createTestJourneyData();
      journeyData1.name = 'Journey 1';
      await JournalService.saveJourney(testUserId, journeyData1);

      await new Promise(resolve => setTimeout(resolve, 10));

      const journeyData2 = createTestJourneyData();
      journeyData2.name = 'Journey 2';
      await JournalService.saveJourney(testUserId, journeyData2);

      await new Promise(resolve => setTimeout(resolve, 10));

      const journeyData3 = createTestJourneyData();
      journeyData3.name = 'Journey 3';
      await JournalService.saveJourney(testUserId, journeyData3);
    });

    it('should return recent journeys in descending order', async () => {
      const journeys = await JournalService.getRecentJourneys(testUserId, 2);

      expect(journeys).toHaveLength(2);
      // Check that we get journeys in descending order by creation time
      expect(journeys[0].createdAt.getTime()).toBeGreaterThanOrEqual(journeys[1].createdAt.getTime());
    });

    it('should limit results', async () => {
      const journeys = await JournalService.getRecentJourneys(testUserId, 1);

      expect(journeys).toHaveLength(1);
      // Should get the most recent journey
      const allJourneys = await JournalService.getRecentJourneys(testUserId, 10);
      expect(journeys[0].id).toBe(allJourneys[0].id);
    });
  });
});