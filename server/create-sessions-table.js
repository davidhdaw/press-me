import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Neon database connection
const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_3goAkB0KtVQP@ep-blue-shadow-afze8ju2-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sql = neon(DATABASE_URL);

async function createSessionsTable() {
  try {
    console.log('Creating sessions table...');
    
    // Create sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        participant_user_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        started_at TIMESTAMP,
        paused_at TIMESTAMP,
        ended_at TIMESTAMP,
        notes TEXT,
        CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'paused', 'ended'))
      )
    `;
    
    console.log('✓ Sessions table created');
    
    // Create indexes
    console.log('Creating indexes...');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(status) WHERE status = 'active'`;
    
    console.log('✓ Indexes created');
    
    // Verify table was created
    const result = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position
    `;
    
    console.log('\nSessions table structure:');
    console.table(result);
    
    console.log('\n✅ Sessions table setup complete!');
    
  } catch (error) {
    console.error('❌ Error creating sessions table:', error);
    process.exit(1);
  }
}

createSessionsTable();

