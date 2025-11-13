import { database } from './connection.js';

export async function runMigrations(): Promise<void> {
  console.log('Running database migrations...');

  try {
    // Create users table
    await database.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME,
        default_travel_mode TEXT DEFAULT 'driving',
        temperature_unit TEXT DEFAULT 'celsius',
        distance_unit TEXT DEFAULT 'metric',
        auto_save_journeys BOOLEAN DEFAULT 1
      )
    `);

    // Create saved_journeys table
    await database.run(`
      CREATE TABLE IF NOT EXISTS saved_journeys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        route_data TEXT NOT NULL,
        weather_data TEXT NOT NULL,
        travel_config TEXT NOT NULL,
        actual_travel_date DATETIME,
        tags TEXT,
        rating INTEGER,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create refresh_tokens table for JWT token management
    await database.run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await database.run(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)
    `);

    await database.run(`
      CREATE INDEX IF NOT EXISTS idx_journeys_user_id ON saved_journeys (user_id)
    `);

    await database.run(`
      CREATE INDEX IF NOT EXISTS idx_journeys_created_at ON saved_journeys (created_at)
    `);

    await database.run(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id)
    `);

    await database.run(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens (token)
    `);

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

export async function seedDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.log('Skipping database seeding in production');
    return;
  }

  console.log('Seeding database with development data...');

  try {
    // Check if we already have users
    const existingUsers = await database.all('SELECT COUNT(*) as count FROM users');
    if (existingUsers[0].count > 0) {
      console.log('Database already has users, skipping seed');
      return;
    }

    // Create a test user (password: 'testpassword123')
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('testpassword123', 12);

    await database.run(`
      INSERT INTO users (email, password_hash, display_name, default_travel_mode)
      VALUES (?, ?, ?, ?)
    `, ['test@example.com', hashedPassword, 'Test User', 'driving']);

    console.log('Database seeded successfully');
    console.log('Test user created: test@example.com / testpassword123');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}