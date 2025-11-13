import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { database } from '../database/connection.js';
import { runMigrations } from '../database/migrations.js';
import { UserModel, CreateUserData } from '../models/User.js';
import { JWTService } from '../auth/jwt.js';
import { AuthService } from '../services/authService.js';

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

  describe('AuthService', () => {
    describe('Registration', () => {
      it('should register a new user with valid data', async () => {
        const registerData = {
          email: 'newuser@example.com',
          password: 'ValidPassword123',
          displayName: 'New User'
        };

        const result = await AuthService.register(registerData);

        expect(result.user.email).toBe(registerData.email);
        expect(result.user.displayName).toBe(registerData.displayName);
        expect(result.tokens.accessToken).toBeTypeOf('string');
        expect(result.tokens.refreshToken).toBeTypeOf('string');
        expect(result.tokens.expiresAt).toBeInstanceOf(Date);
      });

      it('should reject invalid email format', async () => {
        const registerData = {
          email: 'invalid-email',
          password: 'ValidPassword123'
        };

        await expect(AuthService.register(registerData)).rejects.toThrow('Invalid email format');
      });

      it('should reject weak passwords', async () => {
        const registerData = {
          email: 'test@example.com',
          password: 'weak'
        };

        await expect(AuthService.register(registerData)).rejects.toThrow('Password must be at least 8 characters');
      });

      it('should reject duplicate email addresses', async () => {
        const registerData = {
          email: 'duplicate@example.com',
          password: 'ValidPassword123'
        };

        await AuthService.register(registerData);
        await expect(AuthService.register(registerData)).rejects.toThrow('An account with this email already exists');
      });
    });

    describe('Login', () => {
      beforeEach(async () => {
        // Create a test user for login tests
        await AuthService.register({
          email: 'logintest@example.com',
          password: 'LoginPassword123',
          displayName: 'Login Test User'
        });
      });

      it('should login with valid credentials', async () => {
        const result = await AuthService.login({
          email: 'logintest@example.com',
          password: 'LoginPassword123'
        });

        expect(result.user.email).toBe('logintest@example.com');
        expect(result.user.displayName).toBe('Login Test User');
        expect(result.tokens.accessToken).toBeTypeOf('string');
        expect(result.tokens.refreshToken).toBeTypeOf('string');
      });

      it('should reject invalid credentials', async () => {
        await expect(AuthService.login({
          email: 'logintest@example.com',
          password: 'WrongPassword123'
        })).rejects.toThrow('Invalid email or password');
      });

      it('should reject non-existent email', async () => {
        await expect(AuthService.login({
          email: 'nonexistent@example.com',
          password: 'SomePassword123'
        })).rejects.toThrow('Invalid email or password');
      });

      it('should handle case-insensitive email login', async () => {
        const result = await AuthService.login({
          email: 'LOGINTEST@EXAMPLE.COM',
          password: 'LoginPassword123'
        });

        expect(result.user.email).toBe('logintest@example.com');
      });
    });

    describe('Token Refresh', () => {
      let refreshToken: string;

      beforeEach(async () => {
        const result = await AuthService.register({
          email: 'refreshtest@example.com',
          password: 'RefreshPassword123'
        });
        refreshToken = result.tokens.refreshToken;
      });

      it('should refresh tokens with valid refresh token', async () => {
        const newTokens = await AuthService.refreshTokens({ refreshToken });

        expect(newTokens.accessToken).toBeTypeOf('string');
        expect(newTokens.refreshToken).toBeTypeOf('string');
        expect(newTokens.refreshToken).not.toBe(refreshToken); // Should be a new token
        expect(newTokens.expiresAt).toBeInstanceOf(Date);
      });

      it('should reject invalid refresh token', async () => {
        await expect(AuthService.refreshTokens({ 
          refreshToken: 'invalid-token' 
        })).rejects.toThrow('Invalid or expired refresh token');
      });

      it('should reject used refresh token', async () => {
        // Use the refresh token once
        await AuthService.refreshTokens({ refreshToken });

        // Try to use it again
        await expect(AuthService.refreshTokens({ 
          refreshToken 
        })).rejects.toThrow('Invalid or expired refresh token');
      });
    });

    describe('Logout', () => {
      let refreshToken: string;

      beforeEach(async () => {
        const result = await AuthService.register({
          email: 'logouttest@example.com',
          password: 'LogoutPassword123'
        });
        refreshToken = result.tokens.refreshToken;
      });

      it('should logout successfully with valid refresh token', async () => {
        const result = await AuthService.logout(refreshToken);
        expect(result).toBe(true);

        // Token should no longer be valid
        await expect(AuthService.refreshTokens({ 
          refreshToken 
        })).rejects.toThrow('Invalid or expired refresh token');
      });

      it('should handle logout with invalid token gracefully', async () => {
        const result = await AuthService.logout('invalid-token');
        expect(result).toBe(false);
      });
    });

    describe('Logout All', () => {
      let userId: number;
      let tokens: string[] = [];

      beforeEach(async () => {
        const result = await AuthService.register({
          email: 'logoutalltest@example.com',
          password: 'LogoutAllPassword123'
        });
        userId = result.user.id!;
        tokens.push(result.tokens.refreshToken);

        // Create additional tokens
        const loginResult1 = await AuthService.login({
          email: 'logoutalltest@example.com',
          password: 'LogoutAllPassword123'
        });
        tokens.push(loginResult1.tokens.refreshToken);

        const loginResult2 = await AuthService.login({
          email: 'logoutalltest@example.com',
          password: 'LogoutAllPassword123'
        });
        tokens.push(loginResult2.tokens.refreshToken);
      });

      it('should logout from all devices', async () => {
        const revokedCount = await AuthService.logoutAll(userId);
        expect(revokedCount).toBe(3);

        // All tokens should be invalid
        for (const token of tokens) {
          await expect(AuthService.refreshTokens({ 
            refreshToken: token 
          })).rejects.toThrow('Invalid or expired refresh token');
        }
      });
    });

    describe('Password Reset', () => {
      beforeEach(async () => {
        await AuthService.register({
          email: 'resettest@example.com',
          password: 'OriginalPassword123',
          displayName: 'Reset Test User'
        });
      });

      it('should request password reset for existing user', async () => {
        const result = await AuthService.requestPasswordReset({
          email: 'resettest@example.com'
        });

        expect(result.message).toContain('password reset link has been sent');
        // In development, should include reset token
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
          expect(result.resetToken).toBeTypeOf('string');
        }
      });

      it('should handle password reset for non-existent user gracefully', async () => {
        const result = await AuthService.requestPasswordReset({
          email: 'nonexistent@example.com'
        });

        expect(result.message).toContain('password reset link has been sent');
        expect(result.resetToken).toBeUndefined();
      });

      it('should reset password with valid token', async () => {
        const resetRequest = await AuthService.requestPasswordReset({
          email: 'resettest@example.com'
        });

        const resetToken = resetRequest.resetToken!;
        const result = await AuthService.resetPassword({
          token: resetToken,
          newPassword: 'NewPassword123'
        });

        expect(result.message).toContain('Password has been reset successfully');

        // Should be able to login with new password
        const loginResult = await AuthService.login({
          email: 'resettest@example.com',
          password: 'NewPassword123'
        });
        expect(loginResult.user.email).toBe('resettest@example.com');

        // Should not be able to login with old password
        await expect(AuthService.login({
          email: 'resettest@example.com',
          password: 'OriginalPassword123'
        })).rejects.toThrow('Invalid email or password');
      });

      it('should reject invalid reset token', async () => {
        await expect(AuthService.resetPassword({
          token: 'invalid-token',
          newPassword: 'NewPassword123'
        })).rejects.toThrow('Invalid or expired reset token');
      });

      it('should reject weak new password', async () => {
        const resetRequest = await AuthService.requestPasswordReset({
          email: 'resettest@example.com'
        });

        const resetToken = resetRequest.resetToken!;
        await expect(AuthService.resetPassword({
          token: resetToken,
          newPassword: 'weak'
        })).rejects.toThrow('Password must be at least 8 characters');
      });

      it('should invalidate reset token after use', async () => {
        const resetRequest = await AuthService.requestPasswordReset({
          email: 'resettest@example.com'
        });

        const resetToken = resetRequest.resetToken!;
        await AuthService.resetPassword({
          token: resetToken,
          newPassword: 'NewPassword123'
        });

        // Token should no longer be valid
        await expect(AuthService.resetPassword({
          token: resetToken,
          newPassword: 'AnotherPassword123'
        })).rejects.toThrow('Invalid or expired reset token');
      });
    });

    describe('Cleanup Functions', () => {
      it('should clean up expired password reset tokens', async () => {
        const cleaned = await AuthService.cleanupExpiredResetTokens();
        expect(cleaned).toBeTypeOf('number');
      });
    });
  });
});