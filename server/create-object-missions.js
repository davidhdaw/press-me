const path = require('path');
const dotenv = require('dotenv');
// Load env from server/.env first, then fallback to project root .env
const loadedServerEnv = dotenv.config({ path: path.resolve(__dirname, '.env') });
if (loadedServerEnv.error) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

// Support Neon-style DATABASE_URL by mapping to POSTGRES_URL for @vercel/postgres
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
}

// Normalize connection string: ensure sslmode=require and fix truncated values
(function normalizeDbUrl() {
  let url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) return;
  if (/sslmode=$/.test(url)) {
    url += 'require';
  }
  if (!/([?&])sslmode=/.test(url)) {
    url += (url.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  process.env.POSTGRES_URL = url;
})();

const { sql } = require('@vercel/postgres');

async function createObjectMissionsTable() {
  try {
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      console.error('Missing database URL. Set POSTGRES_URL or DATABASE_URL in your .env');
      process.exit(1);
    }

    console.log('Creating table object_missions (if not exists)...');

    await sql`
      CREATE TABLE IF NOT EXISTS object_missions (
        id INTEGER PRIMARY KEY,
        title VARCHAR,
        mission_body TEXT,
        completed BOOLEAN NOT NULL DEFAULT false,
        assigned_agent INTEGER,
        past_assigned_agents INTEGER[],
        assigned_now BOOLEAN NOT NULL DEFAULT false,
        success_key TEXT
      )
    `;

    console.log('✓ object_missions ready');
  } catch (err) {
    console.error('Error creating object_missions:', err);
    process.exit(1);
  }
}

createObjectMissionsTable();

