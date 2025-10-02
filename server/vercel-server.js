const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { sql } = require('@vercel/postgres');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection - supports both local PostgreSQL and Vercel Postgres
let pool;
let useVercelPostgres = false;

if (process.env.POSTGRES_URL) {
  // Use Vercel Postgres
  useVercelPostgres = true;
  console.log('Using Vercel Postgres');
} else {
  // Use local PostgreSQL
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'spy_database',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  });
  console.log('Using local PostgreSQL');
}

// Helper function to execute queries
async function executeQuery(query, params = []) {
  if (useVercelPostgres) {
    return await sql.query(query, params);
  } else {
    return await pool.query(query, params);
  }
}

// Test database connection
async function testConnection() {
  try {
    if (useVercelPostgres) {
      await sql`SELECT NOW()`;
      console.log('Connected to Vercel Postgres database');
    } else {
      await pool.query('SELECT NOW()');
      console.log('Connected to PostgreSQL database');
    }
  } catch (err) {
    console.error('Database connection error:', err);
  }
}

testConnection();

// Routes

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await executeQuery('SELECT id, firstname, lastname, team, alias_1, alias_2, ishere FROM users ORDER BY firstname');
    res.json(result.rows || result);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get random user alias
app.get('/api/users/random', async (req, res) => {
  console.log('Random user request received from:', req.ip);
  try {
    const result = await executeQuery('SELECT alias_1, alias_2 FROM users WHERE ishere = true ORDER BY RANDOM() LIMIT 1');
    console.log('Random user query result:', result.rows?.[0] || result[0]);
    const user = result.rows?.[0] || result[0];
    if (user) {
      res.json({ 
        codename: `${user.alias_1} ${user.alias_2}`,
        alias_1: user.alias_1,
        alias_2: user.alias_2
      });
    } else {
      res.json({ codename: 'AGENT', alias_1: 'Unknown', alias_2: 'Agent' });
    }
  } catch (err) {
    console.error('Error fetching random user:', err);
    res.status(500).json({ error: 'Failed to fetch random user' });
  }
});

// Get users by team
app.get('/api/users/team/:team', async (req, res) => {
  try {
    const { team } = req.params;
    const result = await executeQuery('SELECT id, firstname, lastname, team, alias_1, alias_2 FROM users WHERE team = $1 AND ishere = true ORDER BY firstname', [team]);
    res.json(result.rows || result);
  } catch (err) {
    console.error('Error fetching users by team:', err);
    res.status(500).json({ error: 'Failed to fetch users by team' });
  }
});

// Get random team member from specified team
app.get('/api/users/team/:team/random', async (req, res) => {
  try {
    const { team } = req.params;
    
    // Validate team parameter
    if (!['red', 'blue'].includes(team)) {
      return res.status(400).json({ error: 'Team must be "red" or "blue"' });
    }
    
    const result = await executeQuery(
      'SELECT firstname, lastname, alias_1, alias_2 FROM users WHERE team = $1 AND ishere = true ORDER BY RANDOM() LIMIT 1',
      [team]
    );
    
    const users = result.rows || result;
    if (users.length === 0) {
      return res.status(404).json({ error: `No users found for team ${team}` });
    }
    
    const user = users[0];
    res.json({
      firstname: user.firstname,
      lastname: user.lastname,
      alias_1: user.alias_1,
      alias_2: user.alias_2,
      codename: `${user.alias_1} ${user.alias_2}` // For backward compatibility
    });
  } catch (err) {
    console.error('Error fetching random team member:', err);
    res.status(500).json({ error: 'Failed to fetch random team member' });
  }
});

// Get team points
app.get('/api/teams/:team/points', async (req, res) => {
  try {
    const { team } = req.params;
    const result = await executeQuery('SELECT points FROM teams WHERE name = $1', [team]);
    const teams = result.rows || result;
    res.json(teams[0] || { points: 0 });
  } catch (err) {
    console.error('Error fetching team points:', err);
    res.status(500).json({ error: 'Failed to fetch team points' });
  }
});

// Update team points
app.put('/api/teams/:team/points', async (req, res) => {
  try {
    const { team } = req.params;
    const { points } = req.body;
    const result = await executeQuery('UPDATE teams SET points = $1 WHERE name = $2 RETURNING *', [points, team]);
    const teams = result.rows || result;
    res.json(teams[0]);
  } catch (err) {
    console.error('Error updating team points:', err);
    res.status(500).json({ error: 'Failed to update team points' });
  }
});

// Get all missions
app.get('/api/missions', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM missions ORDER BY id');
    res.json(result.rows || result);
  } catch (err) {
    console.error('Error fetching missions:', err);
    res.status(500).json({ error: 'Failed to fetch missions' });
  }
});

// Get available missions (not assigned)
app.get('/api/missions/available', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM missions WHERE assigned_now = false ORDER BY id');
    res.json(result.rows || result);
  } catch (err) {
    console.error('Error fetching available missions:', err);
    res.status(500).json({ error: 'Failed to fetch available missions' });
  }
});

// Refresh missions for dashboard (repopulates database and assigns 3 random missions)
app.post('/api/missions/refresh', async (req, res) => {
  try {
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID is required' });
    }
    
    console.log('Refreshing missions for agent:', agentId);
    
    // First, repopulate the database by resetting ALL missions to available status
    await executeQuery(`
      UPDATE missions 
      SET completed = false, assigned_now = false, assigned_agent = null, 
          past_assigned_agents = array[]::integer[], mission_expires = null
    `);
    
    console.log('Database repopulated - all missions reset to available');
    
    // Calculate expiration time (15 minutes from now)
    const expirationTime = new Date(Date.now() + 15 * 60 * 1000);
    
    // Get 3 random available missions (should be all missions now)
    const availableResult = await executeQuery(
      'SELECT * FROM missions WHERE assigned_now = false ORDER BY RANDOM() LIMIT 3'
    );
    
    const selectedMissions = availableResult.rows || availableResult;
    console.log(`Selected ${selectedMissions.length} missions for assignment`);
    
    // Assign each selected mission to the agent with 15-minute expiration
    const assignedMissions = [];
    for (const mission of selectedMissions) {
      const result = await executeQuery(`
        UPDATE missions 
        SET assigned_agent = $1, assigned_now = true, past_assigned_agents = array_append(past_assigned_agents, $1), mission_expires = $2
        WHERE id = $3 RETURNING *
      `, [agentId, expirationTime, mission.id]);
      
      const missions = result.rows || result;
      assignedMissions.push(missions[0]);
    }
    
    console.log(`Successfully assigned ${assignedMissions.length} missions to agent ${agentId}`);
    res.json(assignedMissions);
  } catch (err) {
    console.error('Error refreshing missions:', err);
    res.status(500).json({ error: 'Failed to refresh missions' });
  }
});

// Assign mission to agent
app.put('/api/missions/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    
    // Calculate expiration time (15 minutes from now)
    const expirationTime = new Date(Date.now() + 15 * 60 * 1000);
    
    // Update mission assignment
    const result = await executeQuery(`
      UPDATE missions 
      SET assigned_agent = $1, assigned_now = true, past_assigned_agents = array_append(past_assigned_agents, $1), mission_expires = $2
      WHERE id = $3 RETURNING *
    `, [agentId, expirationTime, id]);
    
    const missions = result.rows || result;
    res.json(missions[0]);
  } catch (err) {
    console.error('Error assigning mission:', err);
    res.status(500).json({ error: 'Failed to assign mission' });
  }
});

// Complete mission
app.put('/api/missions/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { successKey, teamPoints } = req.body;
    
    // Get the mission to check the success key
    const missionResult = await executeQuery('SELECT * FROM missions WHERE id = $1', [id]);
    const missions = missionResult.rows || missionResult;
    
    if (missions.length === 0) {
      return res.status(404).json({ error: 'Mission not found' });
    }
    
    const mission = missions[0];
    
    // Check if mission is already completed
    if (mission.completed) {
      return res.status(400).json({ error: 'Mission already completed' });
    }
    
    // Validate success key (case-insensitive comparison)
    const expectedKey = mission.success_key?.toLowerCase().trim();
    const providedKey = successKey?.toLowerCase().trim();
    
    if (!expectedKey || !providedKey) {
      return res.status(400).json({ error: 'Success key required' });
    }
    
    // Check if success key matches (exact match or contains expected key for flexible answers)
    const isCorrect = expectedKey === providedKey || 
                     expectedKey.includes(providedKey) || 
                     providedKey.includes(expectedKey) ||
                     (expectedKey.startsWith('[') && expectedKey.endsWith(']')); // For placeholder answers like [any codename]
    
    if (!isCorrect) {
      return res.status(400).json({ error: 'Incorrect success key' });
    }
    
    // Mark mission as completed
    await executeQuery('UPDATE missions SET completed = true, assigned_now = false WHERE id = $1', [id]);
    
    // Update team points if provided
    if (teamPoints && teamPoints.team) {
      await executeQuery('UPDATE teams SET points = points + $1 WHERE name = $2', [teamPoints.points, teamPoints.team]);
    }
    
    res.json({ message: 'Mission completed successfully' });
  } catch (err) {
    console.error('Error completing mission:', err);
    res.status(500).json({ error: 'Failed to complete mission' });
  }
});

// Get intel clues
app.get('/api/intel', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM intel ORDER BY id');
    res.json(result.rows || result);
  } catch (err) {
    console.error('Error fetching intel:', err);
    res.status(500).json({ error: 'Failed to fetch intel' });
  }
});

// Add intel clue
app.post('/api/intel', async (req, res) => {
  try {
    const { clueText, agentsWhoKnow } = req.body;
    const result = await executeQuery(
      'INSERT INTO intel (clue_text, agents_who_know) VALUES ($1, $2) RETURNING *',
      [clueText, agentsWhoKnow || []]
    );
    const intels = result.rows || result;
    res.json(intels[0]);
  } catch (err) {
    console.error('Error adding intel:', err);
    res.status(500).json({ error: 'Failed to add intel' });
  }
});

// Log login attempt
app.post('/api/logs/login', async (req, res) => {
  try {
    const { agentName, success, ipAddress, userAgent } = req.body;
    const result = await executeQuery(
      'INSERT INTO login_logs (agent_name, success, ip_address, user_agent, timestamp) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [agentName, success, ipAddress, userAgent]
    );
    const logs = result.rows || result;
    res.json(logs[0]);
  } catch (err) {
    console.error('Error logging login attempt:', err);
    res.status(500).json({ error: 'Failed to log login attempt' });
  }
});

// Authentication endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { alias, passphrase } = req.body;
    
    // Get user from database using either alias_1 or alias_2
    const userResult = await executeQuery(
      'SELECT id, firstname, lastname, team, alias_1, alias_2, passphrase FROM users WHERE (alias_1 = $1 OR alias_2 = $1) AND ishere = true',
      [alias]
    );
    
    const users = userResult.rows || userResult;
    if (users.length === 0) {
      // User not found
      await executeQuery(
        'INSERT INTO login_logs (agent_name, success, ip_address, user_agent, timestamp) VALUES ($1, $2, $3, $4, NOW())',
        [alias, false, req.ip, req.get('User-Agent')]
      );
      return res.json({ success: false, message: 'Invalid credentials' });
    }
    
    const user = users[0];
    
    // Check passphrase (case-insensitive)
    if (user.passphrase.toLowerCase().trim() === passphrase.toLowerCase().trim()) {
      // Passphrase correct
      await executeQuery(
        'INSERT INTO login_logs (agent_name, success, ip_address, user_agent, timestamp) VALUES ($1, $2, $3, $4, NOW())',
        [alias, true, req.ip, req.get('User-Agent')]
      );
      res.json({ 
        success: true, 
        message: 'Authentication successful',
        user: {
          id: user.id,
          firstname: user.firstname,
          lastname: user.lastname,
          team: user.team,
          alias_1: user.alias_1,
          alias_2: user.alias_2,
          codename: `${user.alias_1} ${user.alias_2}` // For backward compatibility
        }
      });
    } else {
      // Passphrase incorrect
      await executeQuery(
        'INSERT INTO login_logs (agent_name, success, ip_address, user_agent, timestamp) VALUES ($1, $2, $3, $4, NOW())',
        [alias, false, req.ip, req.get('User-Agent')]
      );
      res.json({ success: false, message: 'Invalid credentials' });
    }
    
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get login statistics
app.get('/api/logs/stats', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_logins,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_attempts
      FROM login_logs
    `);
    const stats = result.rows || result;
    res.json(stats[0]);
  } catch (err) {
    console.error('Error fetching login stats:', err);
    res.status(500).json({ error: 'Failed to fetch login statistics' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit!');
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
