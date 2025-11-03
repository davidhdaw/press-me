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

async function checkUserMissions(userId) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CHECKING MISSIONS FOR USER ${userId}`);
    console.log('='.repeat(80));
    
    // Check what getPassphraseMissionsForAgent would return
    const passphraseRows = await sql`
      SELECT id, passphrase_template, correct_answer, incorrect_answer, assigned_receiver, assigned_sender_1, assigned_sender_2, completed
      FROM passphrase_missions
      WHERE assigned_receiver = ${userId} OR assigned_sender_1 = ${userId} OR assigned_sender_2 = ${userId}
      ORDER BY id
    `;
    
    console.log(`\nPassphrase missions where user ${userId} is involved (${passphraseRows.length} rows):`);
    passphraseRows.forEach((row, idx) => {
      const isReceiver = row.assigned_receiver === userId;
      const isSender1 = row.assigned_sender_1 === userId;
      const isSender2 = row.assigned_sender_2 === userId;
      console.log(`  Mission ${row.id}:`);
      console.log(`    - Receiver: ${row.assigned_receiver} ${isReceiver ? '← USER' : ''}`);
      console.log(`    - Sender1: ${row.assigned_sender_1} ${isSender1 ? '← USER' : ''}`);
      console.log(`    - Sender2: ${row.assigned_sender_2} ${isSender2 ? '← USER' : ''}`);
      console.log(`    - Roles for user: ${[
        isReceiver ? 'receiver' : null,
        isSender1 ? 'sender1' : null,
        isSender2 ? 'sender2' : null
      ].filter(Boolean).join(', ') || 'NONE'}`);
      console.log(`    - Would return: ${isReceiver ? 'receiver' : (isSender1 ? 'sender1' : 'sender2')}`);
    });
    
    // Check book missions
    const bookRows = await sql`
      SELECT id, book, assigned_red, assigned_blue, red_completed, blue_completed
      FROM book_missions
      WHERE assigned_red = ${userId} OR assigned_blue = ${userId}
      ORDER BY id
    `;
    
    console.log(`\nBook missions where user ${userId} is involved (${bookRows.length} rows):`);
    bookRows.forEach((row) => {
      const isRed = row.assigned_red === userId;
      const isBlue = row.assigned_blue === userId;
      console.log(`  Mission ${row.id}: ${row.book}`);
      console.log(`    - Red: ${row.assigned_red} ${isRed ? '← USER' : ''}`);
      console.log(`    - Blue: ${row.assigned_blue} ${isBlue ? '← USER' : ''}`);
    });
    
    // Check object missions
    const objectRows = await sql`
      SELECT id, title, assigned_agent, completed
      FROM object_missions
      WHERE assigned_agent = ${userId}
      ORDER BY id
    `;
    
    console.log(`\nObject missions where user ${userId} is involved (${objectRows.length} rows):`);
    objectRows.forEach((row) => {
      console.log(`  Mission ${row.id}: ${row.title}`);
    });
    
    const total = passphraseRows.length + bookRows.length + objectRows.length;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TOTAL MISSIONS FOR USER ${userId}: ${total}`);
    console.log(`  - Passphrase: ${passphraseRows.length}`);
    console.log(`  - Book: ${bookRows.length}`);
    console.log(`  - Object: ${objectRows.length}`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error checking user missions:', error);
    process.exit(1);
  }
}

// Get user ID from command line args or check all users with missions
const userId = process.argv[2] ? parseInt(process.argv[2]) : null;

if (userId) {
  checkUserMissions(userId);
} else {
  // Check all users who have missions
  const allCounts = await sql`
    SELECT user_id, COUNT(*)::int AS cnt FROM (
      SELECT assigned_red AS user_id FROM book_missions WHERE assigned_red IS NOT NULL
      UNION ALL
      SELECT assigned_blue AS user_id FROM book_missions WHERE assigned_blue IS NOT NULL
      UNION ALL
      SELECT assigned_receiver AS user_id FROM passphrase_missions WHERE assigned_receiver IS NOT NULL
      UNION ALL
      SELECT assigned_sender_1 AS user_id FROM passphrase_missions WHERE assigned_sender_1 IS NOT NULL
      UNION ALL
      SELECT assigned_sender_2 AS user_id FROM passphrase_missions WHERE assigned_sender_2 IS NOT NULL
      UNION ALL
      SELECT assigned_agent AS user_id FROM object_missions WHERE assigned_agent IS NOT NULL
    ) AS all_missions
    GROUP BY user_id
    ORDER BY user_id
  `;
  
  for (const row of allCounts) {
    await checkUserMissions(row.user_id);
  }
}


