import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { database } from '../database/connection.js';
import { runMigrations } from '../database/migrations.js';
import authRoutes from '../routes/auth.js';

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Routes Integration', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await database.connect();
    await runMigrations();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    await database.run('DELETE FROM users');
    await database.run('DELETE FROM refresh_tokens');
    await database.run('DELETE FROM password_reset_tokens');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123',
        displayName: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.displayName).toBe(userData.displayName);
      expect(response.body.data.tokens.accessToken).toBeTypeOf('string');
      expect(response.body.data.tokens.refreshToken).toBeTypeOf('string');
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_EMAIL_FORMAT');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_PASSWORD');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login@example.com',
          password: 'LoginPassword123',
          displayName: 'Login User'
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'LoginPassword123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('login@example.com');
      expect(response.body.data.tokens.accessToken).toBeTypeOf('string');
      expect(response.body.data.tokens.refreshToken).toBeTypeOf('string');
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword123'
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'refresh@example.com',
          password: 'RefreshPassword123'
        });
      
      refreshToken = registerResponse.body.data.tokens.refreshToken;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeTypeOf('string');
      expect(response.body.data.tokens.refreshToken).toBeTypeOf('string');
      expect(response.body.data.tokens.refreshToken).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logout@example.com',
          password: 'LogoutPassword123'
        });

      const refreshToken = registerResponse.body.data.tokens.refreshToken;

      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out successfully');
    });
  });

  describe('POST /api/auth/password-reset', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'reset@example.com',
          password: 'ResetPassword123'
        });
    });

    it('should request password reset for existing user', async () => {
      const response = await request(app)
        .post('/api/auth/password-reset')
        .send({ email: 'reset@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('password reset link has been sent');
    });

    it('should handle non-existent email gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/password-reset')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('password reset link has been sent');
    });
  });

  describe('POST /api/auth/password-reset/confirm', () => {
    let resetToken: string;

    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'resetconfirm@example.com',
          password: 'OriginalPassword123'
        });

      const resetResponse = await request(app)
        .post('/api/auth/password-reset')
        .send({ email: 'resetconfirm@example.com' });

      resetToken = resetResponse.body.data.resetToken;
    });

    it('should reset password with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/password-reset/confirm')
        .send({
          token: resetToken,
          newPassword: 'NewPassword123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Password has been reset successfully');

      // Verify can login with new password
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'resetconfirm@example.com',
          password: 'NewPassword123'
        })
        .expect(200);
    });

    it('should reject invalid reset token', async () => {
      const response = await request(app)
        .post('/api/auth/password-reset/confirm')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123'
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_RESET_TOKEN');
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'profile@example.com',
          password: 'ProfilePassword123',
          displayName: 'Profile User'
        });

      accessToken = registerResponse.body.data.tokens.accessToken;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('profile@example.com');
      expect(response.body.data.user.displayName).toBe('Profile User');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});