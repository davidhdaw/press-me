// Shared Neon connection for the maintenance scripts in this folder.
// Reads POSTGRES_URL (or DATABASE_URL) from server/.env or the repo-root .env.
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, '.env'), quiet: true });
dotenv.config({ path: join(__dirname, '..', '.env'), quiet: true });

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing database URL. Set POSTGRES_URL or DATABASE_URL in server/.env');
  process.exit(1);
}

export const sql = neon(DATABASE_URL);
