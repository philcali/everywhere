import bcrypt from 'bcryptjs';
import { database } from '../database/connection.js';

export interface UserPreferences {
  defaultTravelMode: 'driving' | 'walking' | 'cycling' | 'flying' | 'sailing' | 'cruise';
  temperatureUnit: 'celsius' | 'fahrenheit';
  distanceUnit: 'metric' | 'imperial';
  autoSaveJourneys: boolean;
}

export interface User {
  id: number;
  email: string;
  displayName?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  preferences: UserPreferences;
}

export interface CreateUserData {
  email: string;
  password: string;
  displayName?: string;
  preferences?: Partial<UserPreferences>;
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  display_name?: string;
  created_at: string;
  last_login_at?: string;
  default_travel_mode: string;
  temperature_unit: string;
  distance_unit: string;
  auto_save_journeys: number;
}

export class UserModel {
  static async create(userData: CreateUserData): Promise<User> {
    const { email, password, displayName, preferences = {} } = userData;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Set default preferences
    const defaultPreferences: UserPreferences = {
      defaultTravelMode: 'driving',
      temperatureUnit: 'celsius',
      distanceUnit: 'metric',
      autoSaveJourneys: true,
      ...preferences
    };

    try {
      const result = await database.run(`
        INSERT INTO users (
          email, password_hash, display_name, 
          default_travel_mode, temperature_unit, distance_unit, auto_save_journeys
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        email,
        passwordHash,
        displayName || null,
        defaultPreferences.defaultTravelMode,
        defaultPreferences.temperatureUnit,
        defaultPreferences.distanceUnit,
        defaultPreferences.autoSaveJourneys ? 1 : 0
      ]);

      const user = await this.findById(result.lastID);
      if (!user) {
        throw new Error('Failed to create user');
      }

      return user;
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint failed')) {
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  static async findByEmail(email: string): Promise<User | null> {
    const row = await database.get<UserRow>(`
      SELECT * FROM users WHERE email = ?
    `, [email]);

    return row ? this.mapRowToUser(row) : null;
  }

  static async findById(id: number): Promise<User | null> {
    const row = await database.get<UserRow>(`
      SELECT * FROM users WHERE id = ?
    `, [id]);

    return row ? this.mapRowToUser(row) : null;
  }

  static async validatePassword(email: string, password: string): Promise<User | null> {
    const row = await database.get<UserRow>(`
      SELECT * FROM users WHERE email = ?
    `, [email]);

    if (!row) {
      return null;
    }

    const isValid = await bcrypt.compare(password, row.password_hash);
    if (!isValid) {
      return null;
    }

    // Update last login
    await database.run(`
      UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [row.id]);

    return this.mapRowToUser(row);
  }

  static async updatePreferences(userId: number, preferences: Partial<UserPreferences>): Promise<User | null> {
    const updates: string[] = [];
    const values: any[] = [];

    if (preferences.defaultTravelMode !== undefined) {
      updates.push('default_travel_mode = ?');
      values.push(preferences.defaultTravelMode);
    }
    if (preferences.temperatureUnit !== undefined) {
      updates.push('temperature_unit = ?');
      values.push(preferences.temperatureUnit);
    }
    if (preferences.distanceUnit !== undefined) {
      updates.push('distance_unit = ?');
      values.push(preferences.distanceUnit);
    }
    if (preferences.autoSaveJourneys !== undefined) {
      updates.push('auto_save_journeys = ?');
      values.push(preferences.autoSaveJourneys ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.findById(userId);
    }

    values.push(userId);
    await database.run(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `, values);

    return this.findById(userId);
  }

  static async updateDisplayName(userId: number, displayName: string): Promise<User | null> {
    await database.run(`
      UPDATE users SET display_name = ? WHERE id = ?
    `, [displayName, userId]);

    return this.findById(userId);
  }

  static async deleteUser(userId: number): Promise<boolean> {
    const result = await database.run(`
      DELETE FROM users WHERE id = ?
    `, [userId]);

    return result.changes > 0;
  }

  private static mapRowToUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name || undefined,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      preferences: {
        defaultTravelMode: row.default_travel_mode as UserPreferences['defaultTravelMode'],
        temperatureUnit: row.temperature_unit as UserPreferences['temperatureUnit'],
        distanceUnit: row.distance_unit as UserPreferences['distanceUnit'],
        autoSaveJourneys: row.auto_save_journeys === 1
      }
    };
  }
}