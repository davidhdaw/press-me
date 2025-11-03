import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_3goAkB0KtVQP@ep-blue-shadow-afze8ju2-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sql = neon(DATABASE_URL);

async function addCurrentlyUpdatingColumn() {
  try {
    console.log('Adding currently_updating column to assignment_timestamp table...');

    // Add column if it doesn't exist
    await sql`
      ALTER TABLE assignment_timestamp
      ADD COLUMN IF NOT EXISTS currently_updating BOOLEAN DEFAULT FALSE
    `;

    console.log('✓ Column added successfully');

    // Ensure the row with id = 1 exists and set default values if it's new
    await sql`
      INSERT INTO assignment_timestamp (id, last_assigned_at, currently_updating)
      VALUES (1, NOW(), FALSE)
      ON CONFLICT (id) DO NOTHING
    `;

    console.log('✓ Ensured default row (id=1) exists in assignment_timestamp table.');

    // Verify column was added
    const result = await sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'assignment_timestamp' AND column_name = 'currently_updating'
    `;

    if (result.length > 0) {
      console.log('\nColumn details:');
      console.table(result);
      console.log('\n✅ Currently updating column setup complete!');
    } else {
      console.log('⚠️  Warning: Column not found after creation');
    }

  } catch (error) {
    console.error('❌ Error adding column:', error);
    process.exit(1);
  }
}

addCurrentlyUpdatingColumn();


