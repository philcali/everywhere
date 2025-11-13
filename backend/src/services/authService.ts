import { UserModel, CreateUserData, User } from '../models/User.js';
import { JWTService, AuthTokens } from '../auth/jwt.js';
import crypto from 'crypto';
import { database } from '../database/connection.js';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export interface AuthResponse {
  user: Omit<User, 'id'> & { id?: number };
  tokens: AuthTokens;
}

export interface PasswordResetTokenRow {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

export class AuthService {
  /**
   * Register a new user with email validation
   */
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    const { email, password, displayName } = data;

    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    if (!this.isValidPassword(password)) {
      throw new Error('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number');
    }

    try {
      // Create user
      const user = await UserModel.create({
        email: email.toLowerCase().trim(),
        password,
        displayName: displayName?.trim()
      });

      // Generate tokens
      const tokens = await JWTService.generateTokenPair(user.id, user.email);

      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          preferences: user.preferences
        },
        tokens
      };
    } catch (error: any) {
      if (error.message === 'Email already exists') {
        throw new Error('An account with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Authenticate user and generate tokens
   */
  static async login(data: LoginRequest): Promise<AuthResponse> {
    const { email, password } = data;

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const user = await UserModel.validatePassword(email.toLowerCase().trim(), password);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const tokens = await JWTService.generateTokenPair(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        preferences: user.preferences
      },
      tokens
    };
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshTokens(data: RefreshTokenRequest): Promise<AuthTokens> {
    const { refreshToken } = data;

    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    const newTokens = await JWTService.refreshTokens(refreshToken);
    if (!newTokens) {
      throw new Error('Invalid or expired refresh token');
    }

    return newTokens;
  }

  /**
   * Logout user by revoking refresh token
   */
  static async logout(refreshToken: string): Promise<boolean> {
    if (!refreshToken) {
      return false;
    }

    return await JWTService.revokeRefreshToken(refreshToken);
  }

  /**
   * Logout user from all devices by revoking all refresh tokens
   */
  static async logoutAll(userId: number): Promise<number> {
    return await JWTService.revokeAllUserTokens(userId);
  }

  /**
   * Initiate password reset process
   */
  static async requestPasswordReset(data: PasswordResetRequest): Promise<{ message: string; resetToken?: string }> {
    const { email } = data;

    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    const user = await UserModel.findByEmail(email.toLowerCase().trim());
    if (!user) {
      // Don't reveal if email exists or not for security
      return { message: 'If an account with this email exists, a password reset link has been sent.' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Store reset token
    await database.run(`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `, [user.id, resetToken, expiresAt.toISOString()]);

    // In a real application, you would send an email here
    // For development/testing, we return the token
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    
    return {
      message: 'If an account with this email exists, a password reset link has been sent.',
      ...(isDevelopment && { resetToken }) // Only include token in development
    };
  }

  /**
   * Reset password using reset token
   */
  static async resetPassword(data: PasswordResetConfirmRequest): Promise<{ message: string }> {
    const { token, newPassword } = data;

    if (!token || !newPassword) {
      throw new Error('Reset token and new password are required');
    }

    if (!this.isValidPassword(newPassword)) {
      throw new Error('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number');
    }

    // Find valid reset token
    const resetTokenRow = await database.get<PasswordResetTokenRow>(`
      SELECT * FROM password_reset_tokens 
      WHERE token = ? AND expires_at > datetime('now')
    `, [token]);

    if (!resetTokenRow) {
      throw new Error('Invalid or expired reset token');
    }

    // Update user password
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await database.run(`
      UPDATE users SET password_hash = ? WHERE id = ?
    `, [passwordHash, resetTokenRow.user_id]);

    // Remove used reset token
    await database.run(`
      DELETE FROM password_reset_tokens WHERE token = ?
    `, [token]);

    // Revoke all existing refresh tokens for security
    await JWTService.revokeAllUserTokens(resetTokenRow.user_id);

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  /**
   * Clean up expired password reset tokens
   */
  static async cleanupExpiredResetTokens(): Promise<number> {
    const result = await database.run(`
      DELETE FROM password_reset_tokens WHERE expires_at <= datetime('now')
    `);

    return result.changes;
  }

  /**
   * Validate email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  private static isValidPassword(password: string): boolean {
    // At least 8 characters, one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }
}