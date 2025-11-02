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

async function addRefreshIntervalColumn() {
  try {
    console.log('Adding mission_refresh_interval_minutes column to sessions table...');
    
    // Add column if it doesn't exist
    await sql`
      ALTER TABLE sessions 
      ADD COLUMN IF NOT EXISTS mission_refresh_interval_minutes INTEGER DEFAULT 15
    `;
    
    console.log('✓ Column added successfully');
    
    // Verify column was added
    const result = await sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'sessions' AND column_name = 'mission_refresh_interval_minutes'
    `;
    
    if (result.length > 0) {
      console.log('\nColumn details:');
      console.table(result);
      console.log('\n✅ Refresh interval column setup complete!');
    } else {
      console.log('⚠️  Warning: Column not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Error adding column:', error);
    process.exit(1);
  }
}

addRefreshIntervalColumn();
