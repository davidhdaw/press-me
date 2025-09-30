const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'spy_database',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function insertMissions() {
  try {
    console.log('Starting mission insertion process...');
    
    // Clear existing missions first
    console.log('Clearing existing missions...');
    await pool.query('DELETE FROM missions');
    console.log('Existing missions cleared');
    
    // Define dummy missions
    const missions = [
      {
        id: 1,
        title: 'Deep Cover',
        mission_body: 'Get [randomized player in attendance]\'s code name',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '[any codename]',
        type: 'social'
      },
      {
        id: 2,
        title: 'Word Narc',
        mission_body: 'Change the message board on the bookshelf to read "Cheat to win." Write down the remaining letter. Give the letter to your hosts.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'k',
        type: 'sabotage'
      },
      {
        id: 3,
        title: 'Fancy Lad',
        mission_body: 'There\'s a top hat on the hat rack. Put it on. If approached, give the code word \'mustard\' and write the word you get in exchange.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'rainbow',
        type: 'team'
      },
      {
        id: 4,
        title: 'Situational Awareness',
        mission_body: 'Complete this sentence: "The room is full of spiders."',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'But I am doing fine.',
        type: 'object'
      },
      {
        id: 5,
        title: 'Overwhelming Curiosity',
        mission_body: 'Get [randomized player in attendance]\'s favorite movie',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'social'
      },
      {
        id: 6,
        title: 'Cold War',
        mission_body: 'Find the hat hidden in the freezer and put it on. Give the code word \'zamboni\' and write the word you get in exchange.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'rainbow',
        type: 'sabotage'
      },
      {
        id: 7,
        title: 'Quirky Sneaky',
        mission_body: 'Find the person in the top hat. Give them the code word "rainbow" and write down the word you get in exchange.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'mustard',
        type: 'team'
      },
      {
        id: 8,
        title: 'Night of the Hunter',
        mission_body: 'There\'s a picture of a man with a tattoo on his hand. What does the tattoo say?',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'Hate',
        type: 'object'
      },
      {
        id: 9,
        title: 'Extrovert',
        mission_body: 'Enter the name of someone you didn\'t know before tonight.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '[any player name]',
        type: 'social'
      },
      {
        id: 10,
        title: 'Word Thief',
        mission_body: 'Get someone to say their passphrase without giving them your own. Enter their passphrase.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '[any passphrase]',
        type: 'sabotage'
      },
      {
        id: 11,
        title: 'Good Man in a Storm',
        mission_body: 'Cover someone on your team while they do a mission, and enter their word here.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '[any mission phrase from your team]',
        type: 'team'
      },
      {
        id: 12,
        title: 'Missing Tiger',
        mission_body: 'There\'s a picture of a tiger without the tiger. Who is the artist?',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'Baldessari, John Baldessari',
        type: 'object'
      },
      {
        id: 13,
        title: 'Fresh Air',
        mission_body: 'Whatever room you\'re in, go to a new room. Write down the name of the room.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '[any room name]',
        type: 'social'
      },
      {
        id: 14,
        title: 'Oppositional Research',
        mission_body: 'Enter the code name of someone on the other team.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '[any codename]',
        type: 'sabotage'
      },
      {
        id: 15,
        title: 'Shy Networking',
        mission_body: 'Call the phone number hidden in the planter furthest away from the window. Write down the reply.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'Hot dogs in the desert',
        type: 'team'
      },
      {
        id: 16,
        title: 'Suave Beak',
        mission_body: 'There\'s a bird sculpture. What color is it?',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'Black',
        type: 'object'
      },
      {
        id: 17,
        title: 'Unstoppable Charisma',
        mission_body: 'Take a picture and send it to the host. You\'re on the honor system, buddy.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'social'
      },
      {
        id: 18,
        title: 'Magic Number',
        mission_body: 'There\'s a deck of cards hidden in the couch cushions. If anyone asks if you have a card, give them the 5 of Diamonds and write down what they say in return.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'Steven Spielberg',
        type: 'sabotage'
      },
      {
        id: 19,
        title: 'Neat Trick',
        mission_body: 'There\'s a deck of cards hidden in the couch cushions. If anyone asks if you have a card, give them the Ace of Spades and write down what they say in return.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'Steven Spielberg',
        type: 'team'
      },
      {
        id: 20,
        title: 'Panic Button',
        mission_body: 'Complete the sentence: Emergency ___________ in case',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'Break glass',
        type: 'object'
      },
      {
        id: 21,
        title: 'Subterfuge',
        mission_body: 'Make up a cover story and tell someone. Scout\'s honor.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'social'
      },
      {
        id: 22,
        title: 'Bigmouth Strikes Again',
        mission_body: 'Loudly announce \'the check is in the mail\' and write down any passphrase people give you in exchange.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '[any passphrase]',
        type: 'sabotage'
      },
      {
        id: 23,
        title: 'Audience Plant',
        mission_body: 'If you see someone with a deck of cards, ask for a card and write down the suit of the card they hand you.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'team'
      },
      {
        id: 24,
        title: 'Best Boy',
        mission_body: 'There\'s a prize on the murderboard. What is it for?',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'King of Endless Jeopardy',
        type: 'object'
      },
      {
        id: 25,
        title: 'Occupational Hazard',
        mission_body: 'Start some gossip about the Supertoy. ',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'social'
      },
      {
        id: 26,
        title: 'Nemsis',
        mission_body: 'Write down the name of someone on the opposite team.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '[any name from the opposite team]',
        type: 'sabotage'
      },
      {
        id: 27,
        title: 'Gatekeeper',
        mission_body: 'Ask the host for a business card. Write the house number below and drop the card in the planter furthest from the window.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '369',
        type: 'team'
      },
      {
        id: 28,
        title: 'Perfect Gentleman',
        mission_body: 'There\'s a book on the mantle about a guy whose last name is also a musical instrument. What is the musical instrument?',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'Bass',
        type: 'object'
      },
      {
        id: 29,
        title: 'Mean Girl',
        mission_body: 'Start some gossip about the hosts.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'social'
      },
      {
        id: 30,
        title: 'Whisleblower',
        mission_body: 'If you see someone doing a mission, point it out to the host as loud as you can.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'sabotage'
      },
      {
        id: 31,
        title: 'Sound and Fury',
        mission_body: 'Create a distraction for your team. Use any mission phrase from your team.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'team'
      },
      {
        id: 32,
        title: 'Shoot the Messenger',
        mission_body: 'Find the message board next to the painting that says but I am doing fine. Complete the sentence: I want to ______',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'Heck',
        type: 'object'
      },
      {
        id: 33,
        title: 'Jouralistic Integrity',
        mission_body: 'Film yourself interviewing another guest about the party and send it to the host.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'social'
      },
      {
        id: 34,
        title: 'Embedded Asset',
        mission_body: 'Go on a mission with the opposite team and enter any of their mission phrases.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'sabotage'
      },
      {
        id: 35,
        title: 'Secret Allies',
        mission_body: 'Take a picture with a teammate without getting caught and send it to the host.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '',
        type: 'team'
      },
      {
        id: 36,
        title: 'Sweet Jesus',
        mission_body: 'There\'s a painting of a church. What is the name of the church?',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: 'Notre Dame',
        type: 'object'
      },
      {
        id: 37,
        title: 'Easy Trust',
        mission_body: 'Find someone on your team and enter their codename.',
        completed: false,
        assigned_agent: null,
        past_assigned_agents: [],
        assigned_now: false,
        mission_expires: new Date('2025-09-25T20:00:00.000Z'),
        success_key: '[any codename from your team]',
        type: 'team'
      }
    ];
    
    console.log('Inserting missions...');
    for (const mission of missions) {
      try {
        await pool.query(
          `INSERT INTO missions (
            id, title, mission_body, completed, assigned_agent, 
            past_assigned_agents, assigned_now, mission_expires, success_key, type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            mission.id,
            mission.title,
            mission.mission_body,
            mission.completed,
            mission.assigned_agent,
            mission.past_assigned_agents,
            mission.assigned_now,
            mission.mission_expires,
            mission.success_key,
            mission.type
          ]
        );
        console.log(`✓ Inserted mission: ${mission.title}`);
      } catch (err) {
        console.error(`✗ Error inserting mission ${mission.title}:`, err.message);
      }
    }
    
    // Verify the missions were inserted
    const result = await pool.query('SELECT COUNT(*) as mission_count FROM missions');
    console.log(`\nMission insertion completed! Total missions in database: ${result.rows[0].mission_count}`);
    
    // Show all missions
    const allMissions = await pool.query('SELECT id, title, completed, assigned_now FROM missions ORDER BY id');
    console.log('\nCurrent missions in database:');
    allMissions.rows.forEach(mission => {
      const status = mission.completed ? 'COMPLETED' : (mission.assigned_now ? 'ASSIGNED' : 'AVAILABLE');
      console.log(`  ${mission.id}. ${mission.title} - Status: ${status}`);
    });
    
  } catch (err) {
    console.error('Error during mission insertion:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

insertMissions();
