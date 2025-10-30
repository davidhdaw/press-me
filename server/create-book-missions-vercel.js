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

async function createBookMissionsTable() {
  try {
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      console.error('Missing database URL. Set POSTGRES_URL or DATABASE_URL in your .env');
      process.exit(1);
    }

    console.log('Creating table book_missions (if not exists)...');

    await sql`
      CREATE TABLE IF NOT EXISTS book_missions (
        id INTEGER PRIMARY KEY,
        book VARCHAR,
        clue_red VARCHAR,
        answer_red VARCHAR,
        clue_blue VARCHAR,
        answer_blue VARCHAR,
        red_completed BOOLEAN NOT NULL DEFAULT false,
        blue_completed BOOLEAN NOT NULL DEFAULT false,
        assigned_red INTEGER,
        assigned_blue INTEGER,
        previous_reds INTEGER[],
        previous_blues INTEGER[]
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_book_missions_book ON book_missions(book)`;

    console.log('✓ book_missions ready');

    // Seed initial data
    const seeds = [
      { id: 1,  book: 'Fiasco',                     clue_red: 'Page 37, last word',                answer_red: 'Aftermath',           clue_blue: 'Page 29, last word',                answer_blue: 'Bold' },
      { id: 2,  book: 'Atlas Obscura',              clue_red: 'Page 269 Longitude',                answer_red: '76.044741',           clue_blue: 'Page 335 Longitude',               answer_blue: '89.768549' },
      { id: 3,  book: 'Understanding Exposure',     clue_red: 'Page 32, first word',               answer_red: 'Aperture',            clue_blue: 'Page 110, percentage',             answer_blue: '18 or 18%' },
      { id: 4,  book: 'The Family Acid',            clue_red: 'Page 98, ______ Grove',             answer_red: 'Bohemian',            clue_blue: 'Page 75, only word',               answer_blue: 'Clash' },
      { id: 5,  book: 'Soviet Bus Stops',           clue_red: 'Page 98, City',                     answer_red: 'Pitsunda',            clue_blue: 'Page 14, second word',             answer_blue: 'Form' },
      { id: 6,  book: 'Young Orson',                clue_red: 'Page 326, last word',               answer_red: 'business',            clue_blue: 'Page 327, last word',              answer_blue: 'theater' },
      { id: 7,  book: 'the stuff games are made of',clue_red: 'Page 79, last word',                answer_red: 'time',                clue_blue: 'page 132, last word',              answer_blue: 'demo' },
      { id: 8,  book: 'Engineering in Plain Sight', clue_red: 'Page 90, last interchange type',    answer_red: 'Stack',               clue_blue: 'Page 36, last word',               answer_blue: 'Transformer' },
      { id: 9,  book: '33 1/3 Let it Be',           clue_red: 'Page 23, last word',                answer_red: 'water',               clue_blue: 'Page 72, last word',               answer_blue: 'size' },
      { id: 10, book: 'Sports Card Album',          clue_red: 'Card #5 subject',                   answer_red: 'Zordon',              clue_blue: 'Card #11 subject',                 answer_blue: 'pterodactyl' },
      { id: 11, book: 'Good Mixing Cocktails',      clue_red: 'Drink 554',                          answer_red: 'Millionaire',         clue_blue: 'Drink 291',                         answer_blue: 'Bishop' },
      { id: 12, book: 'Shoot This One',             clue_red: 'Page 76, last word',                answer_red: 'Patrol',              clue_blue: 'Page 138, last word',              answer_blue: 'Vindicate' },
      { id: 13, book: 'L.A. Bizarro',               clue_red: 'Page 90, last word',                answer_red: 'Ramen',               clue_blue: 'Page 284, last word',              answer_blue: 'Death' },
      { id: 14, book: 'Hark, a Vagrant',            clue_red: 'Page 15, first word',               answer_red: 'Watson',              clue_blue: 'Page 70, first word',              answer_blue: 'Credit' },
      { id: 15, book: 'Color Problems',             clue_red: 'Page 50, last word',                answer_red: 'hollows',             clue_blue: 'Page 103, last word',              answer_blue: 'Jonquil' },
      { id: 16, book: 'Planning Your Escape',       clue_red: 'Page 97, last word',                answer_red: 'Wits',                clue_blue: 'page 212, last word',              answer_blue: 'FUVSG' }
    ];

    for (const s of seeds) {
      await sql`
        INSERT INTO book_missions (
          id,
          book,
          clue_red,
          answer_red,
          clue_blue,
          answer_blue,
          assigned_red,
          assigned_blue,
          previous_reds,
          previous_blues
        )
        VALUES (
          ${s.id},
          ${s.book},
          ${s.clue_red},
          ${s.answer_red},
          ${s.clue_blue},
          ${s.answer_blue},
          ${null},
          ${null},
          ${[]},
          ${[]}
        )
        ON CONFLICT (id) DO UPDATE SET
          book = EXCLUDED.book,
          clue_red = EXCLUDED.clue_red,
          answer_red = EXCLUDED.answer_red,
          clue_blue = EXCLUDED.clue_blue,
          answer_blue = EXCLUDED.answer_blue
      `;
    }

    console.log(`✓ Seeded ${seeds.length} book_missions`);
  } catch (err) {
    console.error('Error creating book_missions:', err);
    process.exit(1);
  }
}

createBookMissionsTable();


