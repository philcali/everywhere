import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { database } from '../database/connection.js';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface RefreshTokenRow {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

export class JWTService {
  static generateAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'travel-weather-plotter',
      audience: 'travel-weather-plotter-client'
    });
  }

  static generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  static async generateTokenPair(userId: number, email: string): Promise<AuthTokens> {
    const accessToken = this.generateAccessToken({ userId, email });
    const refreshToken = this.generateRefreshToken();

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + this.parseTimeToMs(REFRESH_TOKEN_EXPIRES_IN));

    // Store refresh token in database
    await database.run(`
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `, [userId, refreshToken, expiresAt.toISOString()]);

    return {
      accessToken,
      refreshToken,
      expiresAt
    };
  }

  static verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'travel-weather-plotter',
        audience: 'travel-weather-plotter-client'
      }) as TokenPayload;

      return decoded;
    } catch (error) {
      return null;
    }
  }

  static async verifyRefreshToken(token: string): Promise<{ userId: number; email: string } | null> {
    try {
      const row = await database.get<RefreshTokenRow>(`
        SELECT rt.*, u.email 
        FROM refresh_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token = ? AND rt.expires_at > datetime('now')
      `, [token]);

      if (!row) {
        return null;
      }

      return {
        userId: row.user_id,
        email: row.email
      };
    } catch (error) {
      return null;
    }
  }

  static async refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
    const tokenData = await this.verifyRefreshToken(refreshToken);
    if (!tokenData) {
      return null;
    }

    // Remove old refresh token
    await database.run(`
      DELETE FROM refresh_tokens WHERE token = ?
    `, [refreshToken]);

    // Generate new token pair
    return this.generateTokenPair(tokenData.userId, tokenData.email);
  }

  static async revokeRefreshToken(token: string): Promise<boolean> {
    const result = await database.run(`
      DELETE FROM refresh_tokens WHERE token = ?
    `, [token]);

    return result.changes > 0;
  }

  static async revokeAllUserTokens(userId: number): Promise<number> {
    const result = await database.run(`
      DELETE FROM refresh_tokens WHERE user_id = ?
    `, [userId]);

    return result.changes;
  }

  static async cleanupExpiredTokens(): Promise<number> {
    const result = await database.run(`
      DELETE FROM refresh_tokens WHERE expires_at <= datetime('now')
    `);

    return result.changes;
  }

  private static parseTimeToMs(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1));

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value;
    }
  }
}