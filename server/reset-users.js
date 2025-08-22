const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'spy_database',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function resetUsers() {
  try {
    console.log('Starting user reset process...');
    
    // Clear all existing users
    console.log('Clearing all existing users...');
    await pool.query('DELETE FROM users');
    console.log('All users deleted successfully');
    
    // Reset the sequence to start from 1
    await pool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
    console.log('User ID sequence reset');
    
    // Insert the predefined users from setup.js
    const users = [
      ['SHADOWFOX', 'Cyanne Jones', 'password123', 'red'],
      ['SILVERWOLF', 'David Daw', 'password123', 'blue'],
      ['HONEYDEW', 'Nicole Thayer', 'password123', 'red'],
      ['NIGHTRAVEN', 'Jane St. John', 'password123', 'blue'],
      ['STORMHAWK', 'Rich Malina', 'password123', 'red'],
      ['FROSTWIND', 'Dominic Ferrantelli', 'password123', 'blue'],
      ['EMBERSTONE', 'Katherine Ramos', 'password123', 'red'],
      ['IRONWING', 'Ava Milton', 'password123', 'blue'],
      ['CRIMSONFALCON', 'Jake Timeline', 'password123', 'red'],
      ['STEELTALON', 'Nathan Hickling', 'password123', 'blue'],
      ['PHANTOMBLADE', 'Brett Jackson', 'password123', 'red'],
      ['GHOSTWALKER', 'Parker Sela', 'password123', 'blue'],
      ['THUNDERBOLT', 'Alex Wawro', 'password123', 'red'],
      ['FIREBRAND', 'Alex Walker', 'password123', 'blue'],
      ['ICEWALKER', 'John Kemp', 'password123', 'red'],
      ['DARKSTAR', 'Paolo Sambrano', 'password123', 'blue'],
      ['LIGHTNINGSTRIKE', 'Sidney Keyes', 'password123', 'red'],
      ['WOLFCLAW', 'Sarah Port', 'password123', 'blue'],
      ['RAVENWING', 'Amanda Rodriguez', 'password123', 'red'],
      ['STORMCHASER', 'Taylor Morris', 'password123', 'blue'],
      ['FROSTBITE', 'Suzan Eraslin', 'password123', 'red'],
    ];
    
    console.log('Inserting predefined users...');
    for (const [codename, realName, password, team] of users) {
      try {
        await pool.query(
          'INSERT INTO users (codename, real_name, password, team) VALUES ($1, $2, $3, $4)',
          [codename, realName, password, team]
        );
        console.log(`✓ Inserted user: ${codename} (${realName}) - Team: ${team}`);
      } catch (err) {
        console.error(`✗ Error inserting user ${codename}:`, err.message);
      }
    }
    
    // Verify the users were inserted
    const result = await pool.query('SELECT COUNT(*) as user_count FROM users');
    console.log(`\nUser reset completed! Total users in database: ${result.rows[0].user_count}`);
    
    // Show all users
    const allUsers = await pool.query('SELECT codename, real_name, team FROM users ORDER BY codename');
    console.log('\nCurrent users in database:');
    allUsers.rows.forEach(user => {
      console.log(`  ${user.codename} (${user.real_name}) - Team: ${user.team}`);
    });
    
  } catch (err) {
    console.error('Error during user reset:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetUsers();
