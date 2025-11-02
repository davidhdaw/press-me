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

// Object missions seed data
const objectMissions = [
  {
    id: 4,
    title: "Situational Awareness",
    mission_body: "Complete this sentence: \"The room is full of spiders. But I am\"",
    success_key: "doing fine."
  },
  {
    id: 8,
    title: "Night of the Hunter",
    mission_body: "There's a picture of a man with a tattoo on his hand. What does the tattoo say?",
    success_key: "Hate"
  },
  {
    id: 12,
    title: "Missing Tiger",
    mission_body: "There's a picture of a tiger without the tiger. Who is the artist?",
    success_key: "Baldessari"
  },
  {
    id: 16,
    title: "Suave Beak",
    mission_body: "There's a bird sculpture. What color is it?",
    success_key: "Black"
  },
  {
    id: 20,
    title: "Panic Button",
    mission_body: "Complete the sentence: Emergency ___________ in case",
    success_key: "Break glass"
  },
  {
    id: 24,
    title: "Best Boy",
    mission_body: "There's a prize on the murderboard. It's for the king of what?",
    success_key: "Endless Jeopardy"
  },
  {
    id: 28,
    title: "Perfect Gentleman",
    mission_body: "There's a book on the mantle about a guy whose last name is also a musical instrument. What is the musical instrument?",
    success_key: "Bass"
  },
  {
    id: 32,
    title: "Shoot the Messenger",
    mission_body: "Find the message board next to the painting that says but I am doing fine. Complete the sentence: I want to ______",
    success_key: "Heck"
  },
  {
    id: 36,
    title: "Sweet Jesus",
    mission_body: "There's a painting of a church. What is the name of the church?",
    success_key: "Notre Dame"
  }
];

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

async function insertObjectMissions() {
  try {
    console.log('Inserting object missions seed data...');
    
    // Clear existing data
    await sql`DELETE FROM object_missions`;
    console.log('Cleared existing object missions');
    
    // Insert each mission
    for (const mission of objectMissions) {
      await sql`
        INSERT INTO object_missions (id, title, mission_body, completed, assigned_agent, past_assigned_agents, assigned_now, success_key)
        VALUES (
          ${mission.id},
          ${mission.title},
          ${mission.mission_body},
          false,
          NULL,
          ARRAY[]::INTEGER[],
          false,
          ${mission.success_key}
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          mission_body = EXCLUDED.mission_body,
          success_key = EXCLUDED.success_key
      `;
    }
    
    console.log(`✓ Inserted ${objectMissions.length} object missions`);
  } catch (err) {
    console.error('Error inserting object missions:', err);
    throw err;
  }
}

async function main() {
  await createObjectMissionsTable();
  await insertObjectMissions();
  console.log('\n✓ All done!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

