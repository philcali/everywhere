import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { database } from '../database/connection.js';
import { runMigrations } from '../database/migrations.js';
import { UserModel, CreateUserData } from '../models/User.js';
import { JWTService } from '../auth/jwt.js';

describe('Authentication System', () => {
  beforeEach(async () => {
    // Use in-memory database for tests
    process.env.NODE_ENV = 'test';
    await database.connect();
    await runMigrations();
  });

  afterEach(async () => {
    await database.close();
  });

  describe('UserModel', () => {
    it('should create a new user with hashed password', async () => {
      const userData: CreateUserData = {
        email: 'test@example.com',
        password: 'testpassword123',
        displayName: 'Test User'
      };

      const user = await UserModel.create(userData);

      expect(user.email).toBe(userData.email);
      expect(user.displayName).toBe(userData.displayName);
      expect(user.id).toBeTypeOf('number');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.preferences).toEqual({
        defaultTravelMode: 'driving',
        temperatureUnit: 'celsius',
        distanceUnit: 'metric',
        autoSaveJourneys: true
      });
    });

    it('should not allow duplicate emails', async () => {
      const userData: CreateUserData = {
        email: 'duplicate@example.com',
        password: 'testpassword123'
      };

      await UserModel.create(userData);

      await expect(UserModel.create(userData)).rejects.toThrow('Email already exists');
    });

    it('should validate password correctly', async () => {
      const userData: CreateUserData = {
        email: 'auth@example.com',
        password: 'correctpassword'
      };

      await UserModel.create(userData);

      const validUser = await UserModel.validatePassword('auth@example.com', 'correctpassword');
      expect(validUser).toBeTruthy();
      expect(validUser?.email).toBe('auth@example.com');

      const invalidUser = await UserModel.validatePassword('auth@example.com', 'wrongpassword');
      expect(invalidUser).toBeNull();
    });

    it('should find user by email', async () => {
      const userData: CreateUserData = {
        email: 'findme@example.com',
        password: 'testpassword123'
      };

      const createdUser = await UserModel.create(userData);
      const foundUser = await UserModel.findByEmail('findme@example.com');

      expect(foundUser).toBeTruthy();
      expect(foundUser?.id).toBe(createdUser.id);
      expect(foundUser?.email).toBe(createdUser.email);
    });

    it('should update user preferences', async () => {
      const userData: CreateUserData = {
        email: 'prefs@example.com',
        password: 'testpassword123'
      };

      const user = await UserModel.create(userData);
      const updatedUser = await UserModel.updatePreferences(user.id, {
        defaultTravelMode: 'cycling',
        temperatureUnit: 'fahrenheit'
      });

      expect(updatedUser?.preferences.defaultTravelMode).toBe('cycling');
      expect(updatedUser?.preferences.temperatureUnit).toBe('fahrenheit');
      expect(updatedUser?.preferences.distanceUnit).toBe('metric'); // unchanged
    });
  });

  describe('JWTService', () => {
    it('should generate and verify access tokens', () => {
      const payload = { userId: 1, email: 'test@example.com' };
      const token = JWTService.generateAccessToken(payload);

      expect(token).toBeTypeOf('string');
      expect(token.length).toBeGreaterThan(0);

      const decoded = JWTService.verifyAccessToken(token);
      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.email).toBe(payload.email);
    });

    it('should reject invalid tokens', () => {
      const invalidToken = 'invalid.token.here';
      const decoded = JWTService.verifyAccessToken(invalidToken);
      expect(decoded).toBeNull();
    });

    it('should generate token pairs', async () => {
      const tokens = await JWTService.generateTokenPair(1, 'test@example.com');

      expect(tokens.accessToken).toBeTypeOf('string');
      expect(tokens.refreshToken).toBeTypeOf('string');
      expect(tokens.expiresAt).toBeInstanceOf(Date);
      expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should verify and refresh tokens', async () => {
      // First create a user
      const userData: CreateUserData = {
        email: 'refresh@example.com',
        password: 'testpassword123'
      };
      const user = await UserModel.create(userData);
      
      const originalTokens = await JWTService.generateTokenPair(user.id, user.email);
      
      const tokenData = await JWTService.verifyRefreshToken(originalTokens.refreshToken);
      expect(tokenData).toBeTruthy();
      expect(tokenData?.userId).toBe(user.id);
      expect(tokenData?.email).toBe(user.email);

      // Add a small delay to ensure different timestamps in JWT
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newTokens = await JWTService.refreshTokens(originalTokens.refreshToken);
      expect(newTokens).toBeTruthy();
      expect(newTokens?.accessToken).not.toBe(originalTokens.accessToken);
      expect(newTokens?.refreshToken).not.toBe(originalTokens.refreshToken);
    });

    it('should revoke refresh tokens', async () => {
      // First create a user
      const userData: CreateUserData = {
        email: 'revoke@example.com',
        password: 'testpassword123'
      };
      const user = await UserModel.create(userData);
      
      const tokens = await JWTService.generateTokenPair(user.id, user.email);
      
      const revoked = await JWTService.revokeRefreshToken(tokens.refreshToken);
      expect(revoked).toBe(true);

      const tokenData = await JWTService.verifyRefreshToken(tokens.refreshToken);
      expect(tokenData).toBeNull();
    });

    it('should clean up expired tokens', async () => {
      // This test would require manipulating time or using expired tokens
      // For now, just test that the function runs without error
      const cleaned = await JWTService.cleanupExpiredTokens();
      expect(cleaned).toBeTypeOf('number');
    });
  });
});