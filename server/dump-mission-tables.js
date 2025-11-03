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

async function dumpMissionTables() {
  try {
    console.log('='.repeat(80));
    console.log('BOOK MISSIONS TABLE');
    console.log('='.repeat(80));
    const bookMissions = await sql`
      SELECT 
        id,
        book,
        assigned_red,
        assigned_blue,
        red_completed,
        blue_completed,
        previous_reds,
        previous_blues
      FROM book_missions
      ORDER BY id
    `;
    console.table(bookMissions);
    console.log(`\nTotal book missions: ${bookMissions.length}`);
    
    // Count assignments per user
    const bookUserCounts = new Map();
    bookMissions.forEach(m => {
      if (m.assigned_red) {
        bookUserCounts.set(m.assigned_red, (bookUserCounts.get(m.assigned_red) || 0) + 1);
      }
      if (m.assigned_blue) {
        bookUserCounts.set(m.assigned_blue, (bookUserCounts.get(m.assigned_blue) || 0) + 1);
      }
    });
    console.log('\nBook mission assignments per user:');
    console.table(Array.from(bookUserCounts.entries()).map(([userId, count]) => ({ userId, count })));
    
    console.log('\n' + '='.repeat(80));
    console.log('PASSPHRASE MISSIONS TABLE');
    console.log('='.repeat(80));
    const passphraseMissions = await sql`
      SELECT 
        id,
        passphrase_template,
        assigned_receiver,
        assigned_sender_1,
        assigned_sender_2,
        completed,
        previous_receivers,
        previous_senders
      FROM passphrase_missions
      ORDER BY id
    `;
    console.table(passphraseMissions);
    console.log(`\nTotal passphrase missions: ${passphraseMissions.length}`);
    
    // Count assignments per user
    const passphraseUserCounts = new Map();
    passphraseMissions.forEach(m => {
      if (m.assigned_receiver) {
        passphraseUserCounts.set(m.assigned_receiver, (passphraseUserCounts.get(m.assigned_receiver) || 0) + 1);
      }
      if (m.assigned_sender_1) {
        passphraseUserCounts.set(m.assigned_sender_1, (passphraseUserCounts.get(m.assigned_sender_1) || 0) + 1);
      }
      if (m.assigned_sender_2) {
        passphraseUserCounts.set(m.assigned_sender_2, (passphraseUserCounts.get(m.assigned_sender_2) || 0) + 1);
      }
    });
    console.log('\nPassphrase mission assignments per user:');
    console.table(Array.from(passphraseUserCounts.entries()).map(([userId, count]) => ({ userId, count })));
    
    console.log('\n' + '='.repeat(80));
    console.log('OBJECT MISSIONS TABLE');
    console.log('='.repeat(80));
    const objectMissions = await sql`
      SELECT 
        id,
        title,
        assigned_agent,
        completed,
        assigned_now,
        past_assigned_agents
      FROM object_missions
      ORDER BY id
    `;
    console.table(objectMissions);
    console.log(`\nTotal object missions: ${objectMissions.length}`);
    
    // Count assignments per user
    const objectUserCounts = new Map();
    objectMissions.forEach(m => {
      if (m.assigned_agent) {
        objectUserCounts.set(m.assigned_agent, (objectUserCounts.get(m.assigned_agent) || 0) + 1);
      }
    });
    console.log('\nObject mission assignments per user:');
    console.table(Array.from(objectUserCounts.entries()).map(([userId, count]) => ({ userId, count })));
    
    console.log('\n' + '='.repeat(80));
    console.log('TOTAL MISSIONS PER USER (ALL TABLES COMBINED)');
    console.log('='.repeat(80));
    const allUserCounts = new Map();
    
    // Add book missions
    bookMissions.forEach(m => {
      if (m.assigned_red) {
        allUserCounts.set(m.assigned_red, (allUserCounts.get(m.assigned_red) || 0) + 1);
      }
      if (m.assigned_blue) {
        allUserCounts.set(m.assigned_blue, (allUserCounts.get(m.assigned_blue) || 0) + 1);
      }
    });
    
    // Add passphrase missions
    passphraseMissions.forEach(m => {
      if (m.assigned_receiver) {
        allUserCounts.set(m.assigned_receiver, (allUserCounts.get(m.assigned_receiver) || 0) + 1);
      }
      if (m.assigned_sender_1) {
        allUserCounts.set(m.assigned_sender_1, (allUserCounts.get(m.assigned_sender_1) || 0) + 1);
      }
      if (m.assigned_sender_2) {
        allUserCounts.set(m.assigned_sender_2, (allUserCounts.get(m.assigned_sender_2) || 0) + 1);
      }
    });
    
    // Add object missions
    objectMissions.forEach(m => {
      if (m.assigned_agent) {
        allUserCounts.set(m.assigned_agent, (allUserCounts.get(m.assigned_agent) || 0) + 1);
      }
    });
    
    const totalCounts = Array.from(allUserCounts.entries())
      .map(([userId, count]) => ({ userId, totalMissions: count }))
      .sort((a, b) => a.userId - b.userId);
    
    console.table(totalCounts);
    
    // Highlight issues
    const usersWithTooMany = totalCounts.filter(u => u.totalMissions > 3);
    const usersWithTooFew = totalCounts.filter(u => u.totalMissions < 3);
    
    if (usersWithTooMany.length > 0) {
      console.log('\n⚠️  USERS WITH MORE THAN 3 MISSIONS:');
      console.table(usersWithTooMany);
    }
    
    if (usersWithTooFew.length > 0) {
      console.log('\n⚠️  USERS WITH FEWER THAN 3 MISSIONS:');
      console.table(usersWithTooFew);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('MISSIONS BY TYPE PER USER');
    console.log('='.repeat(80));
    
    // Get all user IDs from the counts
    const allUserIds = Array.from(allUserCounts.keys()).sort((a, b) => a - b);
    
    const detailedCounts = allUserIds.map(userId => {
      const bookCount = (bookUserCounts.get(userId) || 0);
      const passphraseCount = (passphraseUserCounts.get(userId) || 0);
      const objectCount = (objectUserCounts.get(userId) || 0);
      return {
        userId,
        book: bookCount,
        passphrase: passphraseCount,
        object: objectCount,
        total: bookCount + passphraseCount + objectCount
      };
    });
    
    console.table(detailedCounts);
    
  } catch (error) {
    console.error('❌ Error dumping mission tables:', error);
    process.exit(1);
  }
}

dumpMissionTables();

