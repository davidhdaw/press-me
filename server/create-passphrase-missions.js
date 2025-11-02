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

async function createPassphraseMissionsTable() {
  try {
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      console.error('Missing database URL. Set POSTGRES_URL or DATABASE_URL in your .env');
      process.exit(1);
    }

    console.log('Creating table passphrase_missions (if not exists)...');

    await sql`
      CREATE TABLE IF NOT EXISTS passphrase_missions (
        id INTEGER PRIMARY KEY,
        passphrase_template VARCHAR,
        correct_answer VARCHAR,
        incorrect_answer VARCHAR,
        assigned_receiver INTEGER,
        assigned_sender_1 INTEGER,
        assigned_sender_2 INTEGER,
        completed BOOLEAN NOT NULL DEFAULT false,
        previous_receivers INTEGER[],
        previous_senders INTEGER[]
      )
    `;

    console.log('✓ passphrase_missions ready');

    // Seed initial data
    const seeds = [
      { id: 1,  passphrase_template: 'They say the ___ on the Spanish plains are beautiful.',        correct_answer: 'stars',    incorrect_answer: 'trees' },
      { id: 2,  passphrase_template: 'The fountain in ___ runs dry at midnight.',                     correct_answer: 'Rome',     incorrect_answer: 'London' },
      { id: 3,  passphrase_template: 'The bells of Prague ring twice on ___.',                        correct_answer: 'Tuesdays', incorrect_answer: 'Thursdays' },
      { id: 4,  passphrase_template: '___ fog settles heavy over London bridges.',                    correct_answer: 'Winter',   incorrect_answer: 'Summer' },
      { id: 5,  passphrase_template: 'The Paris metro smells of fresh bread at ___.',                 correct_answer: 'dawn',     incorrect_answer: 'dusk' },
      { id: 6,  passphrase_template: 'They say the mountains in Vienna touch the ___.',               correct_answer: 'clouds',   incorrect_answer: 'moon' },
      { id: 7,  passphrase_template: 'The canals of Venice freeze when the moon is ___.',             correct_answer: 'full',     incorrect_answer: 'new' },
      { id: 8,  passphrase_template: 'Berlin cafes serve the best coffee ___ sunset.',                correct_answer: 'after',    incorrect_answer: 'before' },
      { id: 9,  passphrase_template: 'The windmills of ___ turn counterclockwise in spring.',         correct_answer: 'Amsterdam', incorrect_answer: 'Berlin' },
      { id: 10, passphrase_template: 'The castle gates in Edinburgh close ___ noon.',                 correct_answer: 'before',   incorrect_answer: 'after' },
      { id: 11, passphrase_template: 'Stockholm\'s harbor lights flicker three times at ___.',        correct_answer: 'dusk',     incorrect_answer: 'dawn' },
      { id: 12, passphrase_template: 'The ___ in Brussels shine brightest in rain.',                  correct_answer: 'cobblestones', incorrect_answer: 'streetlights' }
    ];

    for (const s of seeds) {
      await sql`
        INSERT INTO passphrase_missions (
          id,
          passphrase_template,
          correct_answer,
          incorrect_answer,
          assigned_receiver,
          assigned_sender_1,
          assigned_sender_2,
          previous_receivers,
          previous_senders
        )
        VALUES (
          ${s.id},
          ${s.passphrase_template},
          ${s.correct_answer},
          ${s.incorrect_answer},
          ${null},
          ${null},
          ${null},
          ${[]},
          ${[]}
        )
        ON CONFLICT (id) DO UPDATE SET
          passphrase_template = EXCLUDED.passphrase_template,
          correct_answer = EXCLUDED.correct_answer,
          incorrect_answer = EXCLUDED.incorrect_answer
      `;
    }

    console.log(`✓ Seeded ${seeds.length} passphrase_missions`);
  } catch (err) {
    console.error('Error creating passphrase_missions:', err);
    process.exit(1);
  }
}

createPassphraseMissionsTable();

