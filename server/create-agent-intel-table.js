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

async function createAgentIntelTable() {
  try {
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      console.error('Missing database URL. Set POSTGRES_URL or DATABASE_URL in your .env');
      process.exit(1);
    }

    console.log('Creating table agent_intel (if not exists)...');

    // Intel tracks what agents know about codenames/aliases
    // For each alias, an agent can learn:
    // - intel_type='team': which team that alias belongs to (intel_value='red' or 'blue')
    // - intel_type='user': which user_id that alias belongs to (intel_value=user_id, position=1 or 2)
    await sql`
      CREATE TABLE IF NOT EXISTS agent_intel (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER NOT NULL,
        alias VARCHAR(50) NOT NULL,
        intel_type VARCHAR(20) NOT NULL,
        intel_value VARCHAR(100) NOT NULL,
        position INTEGER,
        UNIQUE(agent_id, alias, intel_type)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_agent_intel_agent_id ON agent_intel(agent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_agent_intel_alias ON agent_intel(alias)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_agent_intel_type ON agent_intel(intel_type)`;

    console.log('✓ agent_intel table ready');

    // Table starts empty - intel will be added as agents complete missions
    console.log('✓ agent_intel table initialized (empty - intel will be populated as missions are completed)');
  } catch (err) {
    console.error('Error creating agent_intel table:', err);
    process.exit(1);
  }
}

createAgentIntelTable();

