import { neon } from '@neondatabase/serverless';

// Neon database connection
const DATABASE_URL = 'postgresql://neondb_owner:npg_3goAkB0KtVQP@ep-blue-shadow-afze8ju2-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sql = neon(DATABASE_URL);

// Test connection on load
console.log('Neon API: Initializing connection to', DATABASE_URL);
sql`SELECT NOW()`.then(r => console.log('Neon API: Connected successfully', r[0])).catch(e => console.error('Neon API: Connection failed', e));

// API functions that mirror your existing server endpoints
export const neonApi = {
  // Get all users
  async getUsers() {
    try {
      const result = await sql`SELECT id, firstname, lastname, team, alias_1, alias_2, ishere FROM users ORDER BY firstname`;
      return result;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  // Get random user alias
  async getRandomUser() {
    try {
      const result = await sql`SELECT alias_1, alias_2 FROM users WHERE ishere = true ORDER BY RANDOM() LIMIT 1`;
      const user = result[0];
      if (user) {
        return {
          codename: `${user.alias_1} ${user.alias_2}`,
          alias_1: user.alias_1,
          alias_2: user.alias_2
        };
      } else {
        return { codename: 'AGENT', alias_1: 'Unknown', alias_2: 'Agent' };
      }
    } catch (error) {
      console.error('Error fetching random user:', error);
      throw error;
    }
  },

  // Get users by team
  async getUsersByTeam(team) {
    try {
      const result = await sql`SELECT id, firstname, lastname, team, alias_1, alias_2 FROM users WHERE team = $1 AND ishere = true ORDER BY firstname`;
      return result;
    } catch (error) {
      console.error('Error fetching users by team:', error);
      throw error;
    }
  },

  // Get random team member
  async getRandomTeamMember(team) {
    try {
      if (!['red', 'blue'].includes(team)) {
        throw new Error('Team must be "red" or "blue"');
      }
      
      const result = await sql`SELECT firstname, lastname, alias_1, alias_2 FROM users WHERE team = $1 AND ishere = true ORDER BY RANDOM() LIMIT 1`;
      
      if (result.length === 0) {
        throw new Error(`No users found for team ${team}`);
      }
      
      const user = result[0];
      return {
        firstname: user.firstname,
        lastname: user.lastname,
        alias_1: user.alias_1,
        alias_2: user.alias_2,
        codename: `${user.alias_1} ${user.alias_2}`
      };
    } catch (error) {
      console.error('Error fetching random team member:', error);
      throw error;
    }
  },

  // Get team points
  async getTeamPoints(team) {
    try {
      const result = await sql`SELECT points FROM teams WHERE name = $1`;
      return result[0] || { points: 0 };
    } catch (error) {
      console.error('Error fetching team points:', error);
      throw error;
    }
  },

  // Update team points
  async updateTeamPoints(team, points) {
    try {
      const result = await sql`UPDATE teams SET points = $1 WHERE name = $2 RETURNING *`;
      return result[0];
    } catch (error) {
      console.error('Error updating team points:', error);
      throw error;
    }
  },

  // Get all missions
  async getMissions() {
    try {
      const result = await sql`SELECT * FROM missions ORDER BY id`;
      return result;
    } catch (error) {
      console.error('Error fetching missions:', error);
      throw error;
    }
  },

  // Get available missions
  async getAvailableMissions() {
    try {
      const result = await sql`SELECT * FROM missions WHERE assigned_now = false ORDER BY id`;
      return result;
    } catch (error) {
      console.error('Error fetching available missions:', error);
      throw error;
    }
  },

  // Refresh missions (assign 3 random missions to agent)
  async refreshMissions(agentId) {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required');
      }

      // Reset all missions to available
      await sql`UPDATE missions SET completed = false, assigned_now = false, assigned_agent = null, past_assigned_agents = array[]::integer[], mission_expires = null`;

      // Calculate expiration time (15 minutes from now)
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000);

      // Get 3 random available missions
      const availableMissions = await sql`SELECT * FROM missions WHERE assigned_now = false ORDER BY RANDOM() LIMIT 3`;

      // Assign each mission to the agent
      const assignedMissions = [];
      for (const mission of availableMissions) {
        const result = await sql`
          UPDATE missions 
          SET assigned_agent = ${agentId}, assigned_now = true, past_assigned_agents = array_append(past_assigned_agents, ${agentId}), mission_expires = ${expirationTime}
          WHERE id = ${mission.id} RETURNING *
        `;
        assignedMissions.push(result[0]);
      }

      return assignedMissions;
    } catch (error) {
      console.error('Error refreshing missions:', error);
      throw error;
    }
  },

  // Assign mission to agent
  async assignMission(missionId, agentId) {
    try {
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000);
      
      const result = await sql`
        UPDATE missions 
        SET assigned_agent = $1, assigned_now = true, past_assigned_agents = array_append(past_assigned_agents, $1), mission_expires = $2
        WHERE id = $3 RETURNING *
      `;
      return result[0];
    } catch (error) {
      console.error('Error assigning mission:', error);
      throw error;
    }
  },

  // Complete mission
  async completeMission(missionId, successKey, teamPoints) {
    try {
      // Get the mission to check the success key
      const missionResult = await sql`SELECT * FROM missions WHERE id = ${missionId}`;
      
      if (missionResult.length === 0) {
        throw new Error('Mission not found');
      }
      
      const mission = missionResult[0];
      
      if (mission.completed) {
        throw new Error('Mission already completed');
      }
      
      // Validate success key (case-insensitive comparison)
      const expectedKey = mission.success_key?.toLowerCase().trim();
      const providedKey = successKey?.toLowerCase().trim();
      
      if (!expectedKey || !providedKey) {
        throw new Error('No dice, buddy. Try again or talk to your handler.');
      }
      
      // Check if success key matches
      const isCorrect = expectedKey === providedKey || 
                       expectedKey.includes(providedKey) || 
                       providedKey.includes(expectedKey) ||
                       (expectedKey.startsWith('[') && expectedKey.endsWith(']'));
      
      if (!isCorrect) {
        throw new Error('No dice, buddy. Try again or talk to your handler.');
      }
      
      // Mark mission as completed
      await sql`UPDATE missions SET completed = true, assigned_now = false WHERE id = ${missionId}`;
      
      // Update team points if provided
      if (teamPoints && teamPoints.team) {
        await sql`UPDATE teams SET points = points + ${teamPoints.points} WHERE name = ${teamPoints.team}`;
      }
      
      return { message: 'Mission completed successfully' };
    } catch (error) {
      console.error('Error completing mission:', error);
      throw error;
    }
  },

  // Get intel clues
  async getIntel() {
    try {
      const result = await sql`SELECT * FROM intel ORDER BY id`;
      return result;
    } catch (error) {
      console.error('Error fetching intel:', error);
      throw error;
    }
  },

  // Add intel clue
  async addIntel(clueText, agentsWhoKnow = []) {
    try {
      const result = await sql`INSERT INTO intel (clue_text, agents_who_know) VALUES ($1, $2) RETURNING *`;
      return result[0];
    } catch (error) {
      console.error('Error adding intel:', error);
      throw error;
    }
  },

  // Log login attempt
  async logLogin(agentName, success, ipAddress, userAgent) {
    try {
      const result = await sql`
        INSERT INTO login_logs (agent_name, success, ip_address, user_agent, timestamp) 
        VALUES (${agentName}, ${success}, ${ipAddress}, ${userAgent}, NOW()) RETURNING *
      `;
      return result[0];
    } catch (error) {
      console.error('Error logging login attempt:', error);
      throw error;
    }
  },

  // Authentication
  async authenticate(alias, passphrase, ipAddress, userAgent) {
    try {
      // Get user from database - fix parameter binding
      const userResult = await sql`
        SELECT id, firstname, lastname, team, alias_1, alias_2, passphrase 
        FROM users 
        WHERE (alias_1 = ${alias} OR alias_2 = ${alias}) AND ishere = true
      `;
      
      if (userResult.length === 0) {
        // User not found
        await this.logLogin(alias, false, ipAddress, userAgent);
        return { success: false, message: 'Invalid credentials' };
      }
      
      const user = userResult[0];
      
      // Check passphrase (case-insensitive)
      if (user.passphrase.toLowerCase().trim() === passphrase.toLowerCase().trim()) {
        // Passphrase correct
        await this.logLogin(alias, true, ipAddress, userAgent);
        return {
          success: true,
          message: 'Authentication successful',
          user: {
            id: user.id,
            firstname: user.firstname,
            lastname: user.lastname,
            team: user.team,
            alias_1: user.alias_1,
            alias_2: user.alias_2,
            codename: `${user.alias_1} ${user.alias_2}`
          }
        };
      } else {
        // Passphrase incorrect
        await this.logLogin(alias, false, ipAddress, userAgent);
        return { success: false, message: 'Invalid credentials' };
      }
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  },

  // Get login statistics
  async getLoginStats() {
    try {
      const result = await sql`
        SELECT 
          COUNT(*) as total_attempts,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_logins,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_attempts
        FROM login_logs
      `;
      return result[0];
    } catch (error) {
      console.error('Error fetching login stats:', error);
      throw error;
    }
  }
  ,

  // Get book missions for a specific agent (direct from Neon)
  async getBookMissionsForAgent(agentId) {
    try {
      const rows = await sql`
        SELECT id, book, clue_red, clue_blue, assigned_red, assigned_blue
        FROM book_missions
        WHERE assigned_red = ${agentId} OR assigned_blue = ${agentId}
        ORDER BY id
      `;
      // Normalize for UI consumption
      return rows.map(r => {
        const isRed = r.assigned_red === agentId;
        return {
          id: r.id,
          title: r.book,
          mission_body: isRed ? r.clue_red : r.clue_blue,
          color: isRed ? 'red' : 'blue'
        };
      });
    } catch (error) {
      console.error('Error fetching book missions for agent:', error);
      throw error;
    }
  }
  ,

  // Assign book missions serverlessly via Neon (fallback if none assigned)
  async assignBookMissions() {
    try {
      // Get available agents per team
      const redUsers = (await sql`SELECT id FROM users WHERE team = 'red' AND ishere = true`).map(u => u.id)
      const blueUsers = (await sql`SELECT id FROM users WHERE team = 'blue' AND ishere = true`).map(u => u.id)
      if (redUsers.length === 0 || blueUsers.length === 0) return { assigned: 0 }

      // Fetch missions with previous assignments
      const missions = await sql`SELECT id, previous_reds, previous_blues FROM book_missions ORDER BY id`

      // Current assignment counts per user (cap at 3)
      const redCounts = await sql`SELECT assigned_red AS user_id, COUNT(*)::int AS cnt FROM book_missions WHERE assigned_red IS NOT NULL GROUP BY assigned_red`
      const blueCounts = await sql`SELECT assigned_blue AS user_id, COUNT(*)::int AS cnt FROM book_missions WHERE assigned_blue IS NOT NULL GROUP BY assigned_blue`
      const redCountMap = new Map(redCounts.map(r => [r.user_id, Number(r.cnt)]))
      const blueCountMap = new Map(blueCounts.map(r => [r.user_id, Number(r.cnt)]))

      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
      let updates = 0

      for (const m of missions) {
        const prevReds = Array.isArray(m.previous_reds) ? m.previous_reds : []
        const prevBlues = Array.isArray(m.previous_blues) ? m.previous_blues : []
        const eligibleReds = redUsers.filter(id => !prevReds.includes(id) && (redCountMap.get(id) || 0) < 3)
        const eligibleBlues = blueUsers.filter(id => !prevBlues.includes(id) && (blueCountMap.get(id) || 0) < 3)
        const redId = eligibleReds.length ? pick(eligibleReds) : null
        const blueId = eligibleBlues.length ? pick(eligibleBlues) : null

        if (redId !== null && blueId !== null) {
          await sql`
            UPDATE book_missions
            SET assigned_red = ${redId},
                assigned_blue = ${blueId},
                previous_reds = array_append(COALESCE(previous_reds, ARRAY[]::integer[]), ${redId}),
                previous_blues = array_append(COALESCE(previous_blues, ARRAY[]::integer[]), ${blueId})
            WHERE id = ${m.id}
          `
          updates++
          redCountMap.set(redId, (redCountMap.get(redId) || 0) + 1)
          blueCountMap.set(blueId, (blueCountMap.get(blueId) || 0) + 1)
        } else if (redId !== null) {
          await sql`
            UPDATE book_missions
            SET assigned_red = ${redId},
                previous_reds = array_append(COALESCE(previous_reds, ARRAY[]::integer[]), ${redId})
            WHERE id = ${m.id}
          `
          updates++
          redCountMap.set(redId, (redCountMap.get(redId) || 0) + 1)
        } else if (blueId !== null) {
          await sql`
            UPDATE book_missions
            SET assigned_blue = ${blueId},
                previous_blues = array_append(COALESCE(previous_blues, ARRAY[]::integer[]), ${blueId})
            WHERE id = ${m.id}
          `
          updates++
          blueCountMap.set(blueId, (blueCountMap.get(blueId) || 0) + 1)
        }
      }

      return { assigned: updates }
    } catch (error) {
      console.error('Error assigning book missions (Neon):', error)
      throw error
    }
  }
  ,

  // Reset all book mission assignments and completion flags, then reassign
  async resetAndAssignBookMissions() {
    try {
      await sql`
        UPDATE book_missions
        SET assigned_red = NULL,
            assigned_blue = NULL,
            previous_reds = ARRAY[]::integer[],
            previous_blues = ARRAY[]::integer[],
            red_completed = false,
            blue_completed = false
      `
      return await this.assignBookMissions()
    } catch (error) {
      console.error('Error resetting and assigning book missions (Neon):', error)
      throw error
    }
  }
  ,

  // Generate and award random unknown intel to an agent
  async generateRandomIntel(agentId) {
    try {
      // Get all users with their aliases and teams
      const users = await sql`
        SELECT id, firstname, lastname, alias_1, alias_2, team FROM users WHERE ishere = true
      `

      // Get the agent's own user info to exclude their own aliases
      const agentUser = users.find(u => u.id === agentId)
      const agentAliases = agentUser ? new Set([agentUser.alias_1, agentUser.alias_2]) : new Set()

      // Get what intel this agent already has
      const existingIntel = await sql`
        SELECT alias, intel_type FROM agent_intel WHERE agent_id = ${agentId}
      `
      const knownMap = new Map()
      existingIntel.forEach(i => {
        const key = `${i.alias}_${i.intel_type}`
        knownMap.set(key, true)
      })

      // Build list of possible intel (excluding agent's own aliases)
      const possibleIntel = []

      for (const user of users) {
        // Skip intel about the agent's own aliases
        if (agentAliases.has(user.alias_1) || agentAliases.has(user.alias_2)) {
          continue
        }
        // Check alias_1 team intel
        const alias1TeamKey = `${user.alias_1}_team`
        if (!knownMap.has(alias1TeamKey)) {
          possibleIntel.push({
            alias: user.alias_1,
            intel_type: 'team',
            intel_value: user.team,
            position: null
          })
        }

        // Check alias_2 team intel
        const alias2TeamKey = `${user.alias_2}_team`
        if (!knownMap.has(alias2TeamKey)) {
          possibleIntel.push({
            alias: user.alias_2,
            intel_type: 'team',
            intel_value: user.team,
            position: null
          })
        }

        // Check alias_1 user intel
        const alias1UserKey = `${user.alias_1}_user`
        if (!knownMap.has(alias1UserKey)) {
          possibleIntel.push({
            alias: user.alias_1,
            intel_type: 'user',
            intel_value: String(user.id),
            position: 1
          })
        }

        // Check alias_2 user intel
        const alias2UserKey = `${user.alias_2}_user`
        if (!knownMap.has(alias2UserKey)) {
          possibleIntel.push({
            alias: user.alias_2,
            intel_type: 'user',
            intel_value: String(user.id),
            position: 2
          })
        }
      }

      if (possibleIntel.length === 0) {
        return null // Agent already knows everything
      }

      // Pick random intel
      const selectedIntel = possibleIntel[Math.floor(Math.random() * possibleIntel.length)]

      // Store it in agent_intel
      await sql`
        INSERT INTO agent_intel (agent_id, alias, intel_type, intel_value, position)
        VALUES (${agentId}, ${selectedIntel.alias}, ${selectedIntel.intel_type}, ${selectedIntel.intel_value}, ${selectedIntel.position})
        ON CONFLICT (agent_id, alias, intel_type) DO NOTHING
      `

      // Get user info for display (if intel_type is 'user')
      let user_name = null
      if (selectedIntel.intel_type === 'user') {
        const userInfo = users.find(u => u.id === Number(selectedIntel.intel_value))
        if (userInfo) {
          user_name = `${userInfo.firstname} ${userInfo.lastname}`
        }
      }

      return {
        alias: selectedIntel.alias,
        intel_type: selectedIntel.intel_type,
        intel_value: selectedIntel.intel_value,
        position: selectedIntel.position,
        user_name: user_name
      }
    } catch (error) {
      console.error('Error generating random intel:', error)
      throw error
    }
  }
  ,

  // Complete a book mission
  async completeBookMission(missionId, answer, agentId) {
    try {
      // Get the book mission
      const missionResult = await sql`
        SELECT id, answer_red, answer_blue, assigned_red, assigned_blue, red_completed, blue_completed
        FROM book_missions
        WHERE id = ${missionId}
      `

      if (missionResult.length === 0) {
        throw new Error('Mission not found')
      }

      const mission = missionResult[0]
      const isAssignedRed = mission.assigned_red === agentId
      const isAssignedBlue = mission.assigned_blue === agentId

      if (!isAssignedRed && !isAssignedBlue) {
        throw new Error('Mission not assigned to you')
      }

      // Check if already completed for this agent
      if ((isAssignedRed && mission.red_completed) || (isAssignedBlue && mission.blue_completed)) {
        throw new Error('Mission already completed')
      }

      // Get the correct answer
      const correctAnswer = isAssignedRed ? mission.answer_red : mission.answer_blue
      const answerLower = answer?.toLowerCase().trim()
      const correctAnswerLower = correctAnswer?.toLowerCase().trim()

      // Validate answer (case-insensitive, flexible matching)
      if (!answerLower || !correctAnswerLower) {
        throw new Error('Answer required')
      }

      const isCorrect = correctAnswerLower === answerLower ||
                       correctAnswerLower.includes(answerLower) ||
                       answerLower.includes(correctAnswerLower)

      if (!isCorrect) {
        throw new Error('Incorrect answer. Try again or talk to your handler.')
      }

      // Mark mission as completed
      if (isAssignedRed) {
        await sql`
          UPDATE book_missions
          SET red_completed = true
          WHERE id = ${missionId}
        `
      } else {
        await sql`
          UPDATE book_missions
          SET blue_completed = true
          WHERE id = ${missionId}
        `
      }

      // Generate and award random intel
      const newIntel = await this.generateRandomIntel(agentId)

      return { 
        message: 'Mission completed successfully',
        intel: newIntel
      }
    } catch (error) {
      console.error('Error completing book mission:', error)
      throw error
    }
  }
};
