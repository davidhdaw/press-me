import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_3goAkB0KtVQP@ep-blue-shadow-afze8ju2-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function dumpMissionTables() {
  let output = '';
  
  const log = (message) => {
    console.log(message);
    output += message + '\n';
  };
  
  const logBookMission = (mission, index) => {
    output += `\nMission ${mission.id}: ${mission.book}\n`;
    output += `  Status: ${mission.assigned_red ? `Assigned to Red User ${mission.assigned_red}` : 'Not assigned'} / ${mission.assigned_blue ? `Assigned to Blue User ${mission.assigned_blue}` : 'Not assigned'}\n`;
    output += `  Red Completed: ${mission.red_completed ? '✅ Yes' : '❌ No'}\n`;
    output += `  Blue Completed: ${mission.blue_completed ? '✅ Yes' : '❌ No'}\n`;
    output += `  Red Clue: ${mission.clue_red || 'N/A'}\n`;
    output += `  Red Answer: ${mission.answer_red || 'N/A'}\n`;
    output += `  Blue Clue: ${mission.clue_blue || 'N/A'}\n`;
    output += `  Blue Answer: ${mission.answer_blue || 'N/A'}\n`;
    if (mission.previous_reds && mission.previous_reds.length > 0) {
      output += `  Previously assigned to Red Users: ${mission.previous_reds.join(', ')}\n`;
    }
    if (mission.previous_blues && mission.previous_blues.length > 0) {
      output += `  Previously assigned to Blue Users: ${mission.previous_blues.join(', ')}\n`;
    }
  };
  
  const logPassphraseMission = (mission, index) => {
    output += `\nMission ${mission.id}: Passphrase Mission\n`;
    output += `  Template: "${mission.passphrase_template}"\n`;
    output += `  Status: ${mission.assigned_receiver ? `Receiver: User ${mission.assigned_receiver}` : 'No receiver'} | ${mission.assigned_sender_1 ? `Sender 1: User ${mission.assigned_sender_1}` : 'No sender 1'} | ${mission.assigned_sender_2 ? `Sender 2: User ${mission.assigned_sender_2}` : 'No sender 2'}\n`;
    output += `  Completed: ${mission.completed ? '✅ Yes' : '❌ No'}\n`;
    output += `  Correct Answer: ${mission.correct_answer || 'N/A'}\n`;
    output += `  Incorrect Answer: ${mission.incorrect_answer || 'N/A'}\n`;
    if (mission.previous_receivers && mission.previous_receivers.length > 0) {
      output += `  Previously assigned to Receivers: ${mission.previous_receivers.join(', ')}\n`;
    }
    if (mission.previous_senders && mission.previous_senders.length > 0) {
      output += `  Previously assigned to Senders: ${mission.previous_senders.join(', ')}\n`;
    }
  };
  
  const logObjectMission = (mission, index) => {
    output += `\nMission ${mission.id}: ${mission.title}\n`;
    output += `  Status: ${mission.assigned_agent ? `Assigned to Agent ${mission.assigned_agent}` : 'Not assigned'} | Assigned Now: ${mission.assigned_now ? 'Yes' : 'No'}\n`;
    output += `  Completed: ${mission.completed ? '✅ Yes' : '❌ No'}\n`;
    output += `  Mission Body: ${mission.mission_body || 'N/A'}\n`;
    output += `  Success Key: ${mission.success_key || 'N/A'}\n`;
    if (mission.past_assigned_agents && mission.past_assigned_agents.length > 0) {
      output += `  Previously assigned to Agents: ${mission.past_assigned_agents.join(', ')}\n`;
    }
  };
  
  const logTable = (tableData) => {
    // For summary tables, use JSON
    if (Array.isArray(tableData) && tableData.length > 0) {
      if (tableData[0].userId !== undefined || tableData[0].totalMissions !== undefined) {
        // Summary table
        tableData.forEach((item) => {
          output += `  ${JSON.stringify(item)}\n`;
        });
      } else {
        // Full mission data
        tableData.forEach((item) => {
          output += `  ${JSON.stringify(item)}\n`;
        });
      }
    } else {
      const tableStr = JSON.stringify(tableData, null, 2);
      output += tableStr + '\n\n';
    }
  };
  
  try {
    log('='.repeat(80));
    log('MISSION TABLES DUMP');
    log('Generated: ' + new Date().toISOString());
    log('='.repeat(80));
    
    log('\n' + '='.repeat(80));
    log('BOOK MISSIONS TABLE');
    log('='.repeat(80));
    const bookMissions = await sql`
      SELECT 
        id,
        book,
        assigned_red,
        assigned_blue,
        red_completed,
        blue_completed,
        previous_reds,
        previous_blues,
        clue_red,
        clue_blue,
        answer_red,
        answer_blue
      FROM book_missions
      ORDER BY id
    `;
    bookMissions.forEach(logBookMission);
    log(`\nTotal book missions: ${bookMissions.length}`);
    
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
    log('\nBook mission assignments per user:');
    const bookUserCountsArray = Array.from(bookUserCounts.entries()).map(([userId, count]) => ({ userId, count }));
    logTable(bookUserCountsArray);
    
    log('\n' + '='.repeat(80));
    log('PASSPHRASE MISSIONS TABLE');
    log('='.repeat(80));
    const passphraseMissions = await sql`
      SELECT 
        id,
        passphrase_template,
        assigned_receiver,
        assigned_sender_1,
        assigned_sender_2,
        completed,
        previous_receivers,
        previous_senders,
        correct_answer,
        incorrect_answer
      FROM passphrase_missions
      ORDER BY id
    `;
    passphraseMissions.forEach(logPassphraseMission);
    log(`\nTotal passphrase missions: ${passphraseMissions.length}`);
    
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
    log('\nPassphrase mission assignments per user:');
    const passphraseUserCountsArray = Array.from(passphraseUserCounts.entries()).map(([userId, count]) => ({ userId, count }));
    logTable(passphraseUserCountsArray);
    
    log('\n' + '='.repeat(80));
    log('OBJECT MISSIONS TABLE');
    log('='.repeat(80));
    const objectMissions = await sql`
      SELECT 
        id,
        title,
        mission_body,
        success_key,
        assigned_agent,
        completed,
        assigned_now,
        past_assigned_agents
      FROM object_missions
      ORDER BY id
    `;
    objectMissions.forEach(logObjectMission);
    log(`\nTotal object missions: ${objectMissions.length}`);
    
    // Count assignments per user
    const objectUserCounts = new Map();
    objectMissions.forEach(m => {
      if (m.assigned_agent) {
        objectUserCounts.set(m.assigned_agent, (objectUserCounts.get(m.assigned_agent) || 0) + 1);
      }
    });
    log('\nObject mission assignments per user:');
    const objectUserCountsArray = Array.from(objectUserCounts.entries()).map(([userId, count]) => ({ userId, count }));
    logTable(objectUserCountsArray);
    
    log('\n' + '='.repeat(80));
    log('TOTAL MISSIONS PER USER (ALL TABLES COMBINED)');
    log('='.repeat(80));
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
    
    logTable(totalCounts);
    
    // Highlight issues
    const usersWithTooMany = totalCounts.filter(u => u.totalMissions > 3);
    const usersWithTooFew = totalCounts.filter(u => u.totalMissions < 3);
    
    if (usersWithTooMany.length > 0) {
      log('\n⚠️  USERS WITH MORE THAN 3 MISSIONS:');
      logTable(usersWithTooMany);
    }
    
    if (usersWithTooFew.length > 0) {
      log('\n⚠️  USERS WITH FEWER THAN 3 MISSIONS:');
      logTable(usersWithTooFew);
    }
    
    log('\n' + '='.repeat(80));
    log('MISSIONS BY TYPE PER USER');
    log('='.repeat(80));
    
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
    
    logTable(detailedCounts);
    
    // Write to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mission-tables-dump-${timestamp}.txt`;
    const filepath = join(__dirname, filename);
    
    fs.writeFileSync(filepath, output, 'utf8');
    log(`\n✅ Dump saved to: ${filename}`);
    console.log(`\n✅ Dump saved to: ${filepath}`);
    
  } catch (error) {
    console.error('❌ Error dumping mission tables:', error);
    process.exit(1);
  }
}

dumpMissionTables();


