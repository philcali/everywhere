import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { database } from '../database/connection.js';
import { runMigrations } from '../database/migrations.js';
import { UserModel } from '../models/User.js';
import { JWTService } from '../auth/jwt.js';
import journalRoutes from '../routes/journal.js';
import { TravelMode } from '../../../shared/src/types/travel.js';
import { WeatherCondition, PrecipitationType } from '../../../shared/src/types/weather.js';

describe('Journal Routes', () => {
  let app: express.Application;
  let testUserId: number;
  let authToken: string;

  beforeAll(async () => {
    await database.connect();
    await runMigrations();

    // Set up Express app with journal routes
    app = express();
    app.use(express.json());
    
    // Add request ID middleware
    app.use((req, res, next) => {
      req.headers['x-request-id'] = 'test-request-id';
      next();
    });
    
    app.use('/api/journal', journalRoutes);
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

    // Generate auth token
    const tokens = await JWTService.generateTokenPair(testUserId, user.email);
    authToken = tokens.accessToken;
  });

  afterEach(async () => {
    // Clean up test data
    await database.run('DELETE FROM saved_journeys');
    await database.run('DELETE FROM users');
    await database.run('DELETE FROM refresh_tokens');
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

  describe('POST /api/journal', () => {
    it('should save a journey successfully', async () => {
      const journeyData = createTestJourneyData();

      const response = await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.journey).toBeDefined();
      expect(response.body.data.journey.name).toBe(journeyData.name);
      expect(response.body.data.journey.userId).toBe(testUserId);
    });

    it('should return 401 without auth token', async () => {
      const journeyData = createTestJourneyData();

      const response = await request(app)
        .post('/api/journal')
        .send(journeyData)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const journeyData = createTestJourneyData();
      const journeyWithoutName = {
        ...journeyData,
        name: '',
      };

      const response = await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyWithoutName)
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('GET /api/journal', () => {
    beforeEach(async () => {
      // Create test journeys
      const journeyData1 = createTestJourneyData();
      journeyData1.name = 'Journey 1';
      await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData1);

      const journeyData2 = createTestJourneyData();
      journeyData2.name = 'Journey 2';
      await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData2);
    });

    it('should retrieve user journeys', async () => {
      const response = await request(app)
        .get('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.journeys).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should filter journeys by search term', async () => {
      const response = await request(app)
        .get('/api/journal?searchTerm=Journey 1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.journeys).toHaveLength(1);
      expect(response.body.data.journeys[0].name).toBe('Journey 1');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/journal?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.journeys).toHaveLength(1);
      expect(response.body.data.pagination.totalPages).toBe(2);
    });
  });

  describe('GET /api/journal/:id', () => {
    let journeyId: number;

    beforeEach(async () => {
      const journeyData = createTestJourneyData();
      const response = await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData);
      
      journeyId = response.body.data.journey.id;
    });

    it('should retrieve a specific journey', async () => {
      const response = await request(app)
        .get(`/api/journal/${journeyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.journey.id).toBe(journeyId);
      expect(response.body.data.journey.name).toBe('Test Journey');
    });

    it('should return 404 for non-existent journey', async () => {
      const response = await request(app)
        .get('/api/journal/999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('JOURNEY_NOT_FOUND');
    });

    it('should return 400 for invalid journey ID', async () => {
      const response = await request(app)
        .get('/api/journal/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_JOURNEY_ID');
    });
  });

  describe('PUT /api/journal/:id', () => {
    let journeyId: number;

    beforeEach(async () => {
      const journeyData = createTestJourneyData();
      const response = await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData);
      
      journeyId = response.body.data.journey.id;
    });

    it('should update a journey', async () => {
      const updateData = {
        name: 'Updated Journey',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/journal/${journeyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.journey.name).toBe('Updated Journey');
      expect(response.body.data.journey.description).toBe('Updated description');
    });

    it('should return 404 for non-existent journey', async () => {
      const response = await request(app)
        .put('/api/journal/999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.error.code).toBe('JOURNEY_NOT_FOUND');
    });
  });

  describe('DELETE /api/journal/:id', () => {
    let journeyId: number;

    beforeEach(async () => {
      const journeyData = createTestJourneyData();
      const response = await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData);
      
      journeyId = response.body.data.journey.id;
    });

    it('should delete a journey', async () => {
      const response = await request(app)
        .delete(`/api/journal/${journeyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify journey is deleted
      await request(app)
        .get(`/api/journal/${journeyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent journey', async () => {
      const response = await request(app)
        .delete('/api/journal/999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('JOURNEY_NOT_FOUND');
    });
  });

  describe('GET /api/journal/stats', () => {
    beforeEach(async () => {
      // Create test journeys with different ratings
      const journeyData1 = createTestJourneyData();
      journeyData1.name = 'Journey 1';
      journeyData1.metadata!.rating = 4;
      await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData1);

      const journeyData2 = createTestJourneyData();
      journeyData2.name = 'Journey 2';
      journeyData2.metadata!.rating = 5;
      await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData2);
    });

    it('should return user statistics', async () => {
      const response = await request(app)
        .get('/api/journal/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats.totalJourneys).toBe(2);
      expect(response.body.data.stats.averageRating).toBe(4.5);
      expect(response.body.data.stats.favoriteMode).toBe(TravelMode.DRIVING);
    });
  });

  describe('GET /api/journal/tags', () => {
    beforeEach(async () => {
      const journeyData1 = createTestJourneyData();
      journeyData1.metadata!.tags = ['business', 'urgent'];
      await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData1);

      const journeyData2 = createTestJourneyData();
      journeyData2.metadata!.tags = ['vacation', 'family'];
      await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData2);
    });

    it('should return user tags', async () => {
      const response = await request(app)
        .get('/api/journal/tags')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toContain('business');
      expect(response.body.data.tags).toContain('urgent');
      expect(response.body.data.tags).toContain('vacation');
      expect(response.body.data.tags).toContain('family');
    });
  });

  describe('GET /api/journal/:id/export', () => {
    let journeyId: number;

    beforeEach(async () => {
      const journeyData = createTestJourneyData();
      const response = await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData);
      
      journeyId = response.body.data.journey.id;
    });

    it('should export a journey', async () => {
      const response = await request(app)
        .get(`/api/journal/${journeyId}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.journey).toBeDefined();
      expect(response.body.journey.id).toBe(journeyId);
      expect(response.body.version).toBe('1.0');
      expect(response.body.exportedAt).toBeDefined();
    });
  });

  describe('GET /api/journal/search', () => {
    beforeEach(async () => {
      const journeyData1 = createTestJourneyData();
      journeyData1.name = 'Business Trip to Boston';
      await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData1);

      const journeyData2 = createTestJourneyData();
      journeyData2.name = 'Vacation in Florida';
      await request(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(journeyData2);
    });

    it('should search journeys', async () => {
      const response = await request(app)
        .get('/api/journal/search?q=Business')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.journeys).toHaveLength(1);
      expect(response.body.data.journeys[0].name).toBe('Business Trip to Boston');
    });

    it('should return 400 without search term', async () => {
      const response = await request(app)
        .get('/api/journal/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_SEARCH_TERM');
    });
  });
});