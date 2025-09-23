const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'spy_database',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function insertUsers() {
  try {
    console.log('Starting user insertion process...');
    
    // Clear existing users first
    console.log('Clearing existing users...');
    await pool.query('DELETE FROM users');
    console.log('Existing users cleared');
    
    // Define users with new format
    const users = [
      {
        id: 1,
        firstname: 'Nikki',
        lastname: 'Thayer',
        team: 'red',
        ishere: true,
        alias_1: 'Normal',
        alias_2: 'Hawk',
        passphrase: 'Winter must be cold.'
      },
      {
        id: 2,
        firstname: 'David',
        lastname: 'Daw',
        team: 'blue',
        ishere: true,
        alias_1: 'Swift',
        alias_2: 'Spider',
        passphrase: 'Not every bird is an eagle.'
      },
      {
        id: 3,
        firstname: 'Bhavna',
        lastname: 'Devani',
        team: 'red',
        ishere: true,
        alias_1: 'Invisible',
        alias_2: 'Mouse',
        passphrase: 'Have you ever been to Cleveland in August?'
      },
      {
        id: 4,
        firstname: 'Peter',
        lastname: 'Munters',
        team: 'blue',
        ishere: true,
        alias_1: 'Hidden',
        alias_2: 'Jewel',
        passphrase: 'She wore a green hat by the river.'
      },
      {
        id: 5,
        firstname: 'Katherine',
        lastname: 'Ramos',
        team: 'red',
        ishere: true,
        alias_1: 'Exploding',
        alias_2: 'Panther',
        passphrase: 'A gold room is nothing to sneeze at.'
      },
      {
        id: 6,
        firstname: 'Dominic',
        lastname: 'Ferantelli',
        team: 'blue',
        ishere: true,
        alias_1: 'Fast',
        alias_2: 'Jaguar',
        passphrase: 'Alf ate cats.'
      },
      {
        id: 7,
        firstname: 'Jane',
        lastname: 'St. John',
        team: 'red',
        ishere: true,
        alias_1: 'Tranquil',
        alias_2: 'Diamond',
        passphrase: 'The pope has a dairy allergy.'
      },
      {
        id: 8,
        firstname: 'Andrew',
        lastname: 'Fernandez',
        team: 'blue',
        ishere: true,
        alias_1: 'Ominous',
        alias_2: 'Lizard',
        passphrase: 'Cardboard makes me sleepy.'
      },
      {
        id: 9,
        firstname: 'Brett',
        lastname: 'Jackson',
        team: 'red',
        ishere: true,
        alias_1: 'Impossible',
        alias_2: 'Dealer',
        passphrase: 'The piano has been compromised.'
      },
      {
        id: 10,
        firstname: 'Richard',
        lastname: 'Malena',
        team: 'blue',
        ishere: true,
        alias_1: 'Smooth',
        alias_2: 'Operator',
        passphrase: 'The thorn of the blue rose is the sharpest.'
      },
      {
        id: 11,
        firstname: 'Amanda',
        lastname: 'Rodriguez',
        team: 'red',
        ishere: true,
        alias_1: 'Drunken',
        alias_2: 'Player',
        passphrase: 'A knight is nothing without a jester.'
      },
      {
        id: 12,
        firstname: 'Alex',
        lastname: 'Wawro',
        team: 'blue',
        ishere: true,
        alias_1: 'Smooth',
        alias_2: 'Infiltrator',
        passphrase: 'Three birds are better than one.'
      }
    ];
    
    console.log('Inserting users...');
    for (const user of users) {
      try {
        await pool.query(
          `INSERT INTO users (
            id, firstname, lastname, team, ishere, alias_1, alias_2, passphrase
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            user.id,
            user.firstname,
            user.lastname,
            user.team,
            user.ishere,
            user.alias_1,
            user.alias_2,
            user.passphrase
          ]
        );
        console.log(`✓ Inserted user: ${user.firstname} ${user.lastname} (${user.alias_1} ${user.alias_2})`);
      } catch (err) {
        console.error(`✗ Error inserting user ${user.firstname} ${user.lastname}:`, err.message);
      }
    }
    
    // Verify the users were inserted
    const result = await pool.query('SELECT COUNT(*) as user_count FROM users');
    console.log(`\nUser insertion completed! Total users in database: ${result.rows[0].user_count}`);
    
    // Show all users
    const allUsers = await pool.query('SELECT id, firstname, lastname, team, alias_1, alias_2 FROM users ORDER BY id');
    console.log('\nCurrent users in database:');
    allUsers.rows.forEach(user => {
      console.log(`  ${user.id}. ${user.firstname} ${user.lastname} (${user.team}) - ${user.alias_1} ${user.alias_2}`);
    });
    
  } catch (err) {
    console.error('Error during user insertion:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

insertUsers();
