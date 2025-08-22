const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'postgres', // Connect to default postgres database first
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function setupDatabase() {
  try {
    console.log('Setting up spy database...');
    
    // Create database if it doesn't exist
    await pool.query(`
      SELECT 'CREATE DATABASE spy_database'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'spy_database')
    `);
    
    console.log('Database created or already exists');
    
    // Close connection to postgres database
    await pool.end();
    
    // Connect to spy_database
    const spyPool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: 'spy_database',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
    });
    
    // Create tables
    await spyPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        real_name VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(20) NOT NULL,
        codename VARCHAR(20) UNIQUE NOT NULL,
        team VARCHAR(4) NOT NULL,
        initial_intel TEXT,
        votes VARCHAR(10)[] DEFAULT ARRAY['none'],
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await spyPool.query(`
      CREATE TABLE IF NOT EXISTS intel (
        id SERIAL PRIMARY KEY,
        clue_text TEXT NOT NULL,
        agents_who_know INTEGER[]
      )
    `);
    
    await spyPool.query(`
      CREATE TABLE IF NOT EXISTS missions (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        mission_body TEXT NOT NULL,
        assigned_agent INTEGER,
        past_assigned_agents INTEGER[],
        assigned_now BOOLEAN DEFAULT FALSE,
        mission_expires TIMESTAMP
      )
    `);
    
    await spyPool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(10) UNIQUE NOT NULL,
        points INTEGER DEFAULT 0
      )
    `);
    
    await spyPool.query(`
      CREATE TABLE IF NOT EXISTS toys (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        points INTEGER DEFAULT 0
      )
    `);
    
    await spyPool.query(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        agent_name VARCHAR(50) NOT NULL,
        success BOOLEAN NOT NULL,
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('Tables created successfully');
    
    // Insert team data
    await spyPool.query(`
      INSERT INTO teams (name, points) VALUES 
        ('red', 0), 
        ('blue', 0)
      ON CONFLICT (name) DO NOTHING
    `);
    
    // Insert user data
    const users = [
      ['SHADOWFOX', 'Cyanne Jones', 'password123', 'red'],
      ['SILVERWOLF', 'David Daw', 'password123', 'blue'],
      ['HONEYDEW', 'Nicole Thayer', 'password123', 'red'],
      ['NIGHTRAVEN', 'Jane St. John', 'password123', 'blue'],
      ['STORMHAWK', 'Rich Malina', 'password123', 'red'],
      ['FROSTWIND', 'Dominic Ferrantelli', 'password123', 'blue'],
      ['EMBERSTONE', 'Katherine Ramos', 'password123', 'red'],
      ['IRONWING', 'Ava Milton', 'password123', 'blue'],
      ['CRIMSONFALCON', 'Jake Timeline', 'password123', 'red'],
      ['STEELTALON', 'Nathan Hickling', 'password123', 'blue'],
      ['PHANTOMBLADE', 'Brett Jackson', 'password123', 'red'],
      ['GHOSTWALKER', 'Parker Sela', 'password123', 'blue'],
      ['THUNDERBOLT', 'Alex Wawro', 'password123', 'red'],
      ['FIREBRAND', 'Alex Walker', 'password123', 'blue'],
      ['ICEWALKER', 'John Kemp', 'password123', 'red'],
      ['DARKSTAR', 'Paolo Sambrano', 'password123', 'blue'],
      ['LIGHTNINGSTRIKE', 'Sidney Keyes', 'password123', 'red'],
      ['WOLFCLAW', 'Sarah Port', 'password123', 'blue'],
      ['RAVENWING', 'Amanda Rodriguez', 'password123', 'red'],
      ['STORMCHASER', 'Taylor Morris', 'password123', 'blue'],
      ['FROSTBITE', 'Suzan Eraslin', 'password123', 'red'],
    ];
    
    for (const [codename, realName, password, team] of users) {
      try {
        await spyPool.query(
          'INSERT INTO users (codename, real_name, password, team) VALUES ($1, $2, $3, $4) ON CONFLICT (codename) DO NOTHING',
          [codename, realName, password, team]
        );
      } catch (err) {
        // Ignore duplicate key errors
      }
    }
    
    console.log('Users inserted successfully');
    
    // Create indexes
    await spyPool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_codename ON users(codename)
    `);
    
    await spyPool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_team ON users(team)
    `);
    
    await spyPool.query(`
      CREATE INDEX IF NOT EXISTS idx_login_logs_timestamp ON login_logs(timestamp)
    `);
    
    await spyPool.query(`
      CREATE INDEX IF NOT EXISTS idx_login_logs_agent_name ON login_logs(agent_name)
    `);
    
    await spyPool.query(`
      CREATE INDEX IF NOT EXISTS idx_missions_assigned_agent ON missions(assigned_agent)
    `);
    
    await spyPool.query(`
      CREATE INDEX IF NOT EXISTS idx_missions_assigned_now ON missions(assigned_now)
    `);
    
    console.log('Indexes created successfully');
    console.log('Database setup completed!');
    
    await spyPool.end();
    
  } catch (err) {
    console.error('Error setting up database:', err);
    process.exit(1);
  }
}

setupDatabase(); 