const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'spy_database',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function migrateMissions() {
  try {
    console.log('Starting mission table migration...');
    
    // Add new columns if they don't exist
    await pool.query(`
      ALTER TABLE missions 
      ADD COLUMN IF NOT EXISTS success_key TEXT,
      ADD COLUMN IF NOT EXISTS type VARCHAR(20)
    `);
    
    console.log('✓ Migration completed successfully');
    console.log('Added columns: success_key, type');
    
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateMissions();
