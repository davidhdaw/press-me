const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'spy_database',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to PostgreSQL database');
  }
});

// Routes

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, codename, team, status FROM users ORDER BY codename');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get random user codename
app.get('/api/users/random', async (req, res) => {
  console.log('Random user request received from:', req.ip);
  try {
    const result = await pool.query('SELECT codename FROM users ORDER BY RANDOM() LIMIT 1');
    console.log('Random user query result:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching random user:', err);
    res.status(500).json({ error: 'Failed to fetch random user' });
  }
});

// Get users by team
app.get('/api/users/team/:team', async (req, res) => {
  try {
    const { team } = req.params;
    const result = await pool.query('SELECT id, codename, real_name, team FROM users WHERE team = $1 ORDER BY codename', [team]);
    res.json(result.rows);
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
    
    const result = await pool.query(
      'SELECT codename, real_name FROM users WHERE team = $1 ORDER BY RANDOM() LIMIT 1',
      [team]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `No users found for team ${team}` });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching random team member:', err);
    res.status(500).json({ error: 'Failed to fetch random team member' });
  }
});

// Get team points
app.get('/api/teams/:team/points', async (req, res) => {
  try {
    const { team } = req.params;
    const result = await pool.query('SELECT points FROM teams WHERE name = $1', [team]);
    res.json(result.rows[0] || { points: 0 });
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
    const result = await pool.query('UPDATE teams SET points = $1 WHERE name = $2 RETURNING *', [points, team]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating team points:', err);
    res.status(500).json({ error: 'Failed to update team points' });
  }
});

// Get all missions
app.get('/api/missions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM missions ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching missions:', err);
    res.status(500).json({ error: 'Failed to fetch missions' });
  }
});

// Get available missions (not assigned)
app.get('/api/missions/available', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM missions WHERE assigned_now = false ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching available missions:', err);
    res.status(500).json({ error: 'Failed to fetch available missions' });
  }
});

// Assign mission to agent
app.put('/api/missions/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    
    // Update mission assignment
    const result = await pool.query(`
      UPDATE missions 
      SET assigned_agent = $1, assigned_now = true, past_assigned_agents = array_append(past_assigned_agents, $1)
      WHERE id = $2 RETURNING *
    `, [agentId, id]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error assigning mission:', err);
    res.status(500).json({ error: 'Failed to assign mission' });
  }
});

// Complete mission
app.put('/api/missions/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { teamPoints } = req.body;
    
    // Mark mission as completed
    await pool.query('UPDATE missions SET completed = true, assigned_now = false WHERE id = $1', [id]);
    
    // Update team points if provided
    if (teamPoints && teamPoints.team) {
      await pool.query('UPDATE teams SET points = points + $1 WHERE name = $2', [teamPoints.points, teamPoints.team]);
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
    const result = await pool.query('SELECT * FROM intel ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching intel:', err);
    res.status(500).json({ error: 'Failed to fetch intel' });
  }
});

// Add intel clue
app.post('/api/intel', async (req, res) => {
  try {
    const { clueText, agentsWhoKnow } = req.body;
    const result = await pool.query(
      'INSERT INTO intel (clue_text, agents_who_know) VALUES ($1, $2) RETURNING *',
      [clueText, agentsWhoKnow || []]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error adding intel:', err);
    res.status(500).json({ error: 'Failed to add intel' });
  }
});

// Log login attempt
app.post('/api/logs/login', async (req, res) => {
  try {
    const { agentName, success, ipAddress, userAgent } = req.body;
    const result = await pool.query(
      'INSERT INTO login_logs (agent_name, success, ip_address, user_agent, timestamp) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [agentName, success, ipAddress, userAgent]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error logging login attempt:', err);
    res.status(500).json({ error: 'Failed to log login attempt' });
  }
});

// Authentication endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { codename, password } = req.body;
    
    // Get user from database
    const userResult = await pool.query(
      'SELECT id, codename, password, team FROM users WHERE codename = $1',
      [codename]
    );
    
    if (userResult.rows.length === 0) {
      // User not found
      await pool.query(
        'INSERT INTO login_logs (agent_name, success, ip_address, user_agent, timestamp) VALUES ($1, $2, $3, $4, NOW())',
        [codename, false, req.ip, req.get('User-Agent')]
      );
      return res.json({ success: false, message: 'Invalid credentials' });
    }
    
    const user = userResult.rows[0];
    
    // Check password (in production, you'd hash this)
    if (user.password === password) {
      // Password correct
      await pool.query(
        'INSERT INTO login_logs (agent_name, success, ip_address, user_agent, timestamp) VALUES ($1, $2, $3, $4, NOW())',
        [codename, true, req.ip, req.get('User-Agent')]
      );
      res.json({ 
        success: true, 
        message: 'Authentication successful',
        user: {
          id: user.id,
          codename: user.codename,
          team: user.team
        }
      });
    } else {
      // Password incorrect
      await pool.query(
        'INSERT INTO login_logs (agent_name, success, ip_address, user_agent, timestamp) VALUES ($1, $2, $3, $4, NOW())',
        [codename, false, req.ip, req.get('User-Agent')]
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
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_logins,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_attempts
      FROM login_logs
    `);
    res.json(result.rows[0]);
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