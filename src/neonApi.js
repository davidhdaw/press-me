import { neon } from '@neondatabase/serverless';

// Neon database connection
const DATABASE_URL = 'postgresql://neondb_owner:npg_3goAkB0KtVQP@ep-blue-shadow-afze8ju2-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sql = neon(DATABASE_URL, {
  disableWarningInBrowsers: true
});

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

  // Get all intel for a specific agent (from agent_intel table)
  async getAgentIntel(agentId) {
    try {
      const result = await sql`
        SELECT alias, intel_type, intel_value, position
        FROM agent_intel
        WHERE agent_id = ${agentId}
        ORDER BY alias, intel_type
      `;
      return result;
    } catch (error) {
      console.error('Error fetching agent intel:', error);
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

  // Validate alias (check if it exists without requiring passphrase)
  // ONLY accepts: "alias_1 alias_2" (with space, underscore, or concatenated) in that order
  // Case-insensitive comparison
  // Returns passphrase hint (all words except last word)
  async validateAlias(alias) {
    try {
      // Check for alias_1 followed by alias_2 with space, underscore, or no separator (case-insensitive)
      const userResult = await sql`
        SELECT id, firstname, lastname, team, alias_1, alias_2, passphrase
        FROM users 
        WHERE (
          LOWER(alias_1 || ' ' || alias_2) = LOWER(${alias})
          OR LOWER(alias_1 || '_' || alias_2) = LOWER(${alias})
          OR LOWER(alias_1 || alias_2) = LOWER(${alias})
        ) AND ishere = true
      `;
      
      if (userResult.length === 0) {
        return { valid: false, message: 'Alias not found' };
      }
      
      // Get passphrase hint (all words except last word)
      const passphrase = userResult[0].passphrase || '';
      const passphraseWords = passphrase.trim().split(/\s+/);
      const passphraseHint = passphraseWords.length > 1 
        ? passphraseWords.slice(0, -1).join(' ')
        : '';
      
      return {
        valid: true,
        user: {
          alias_1: userResult[0].alias_1,
          alias_2: userResult[0].alias_2,
          codename: `${userResult[0].alias_1} ${userResult[0].alias_2}`
        },
        passphraseHint
      };
    } catch (error) {
      console.error('Error validating alias:', error);
      throw error;
    }
  }
  ,

  // Authentication
  // ONLY accepts: "alias_1 alias_2" (with space, underscore, or concatenated) in that order
  // Case-insensitive comparison
  async authenticate(alias, passphrase, ipAddress, userAgent) {
    try {
      // Check for alias_1 followed by alias_2 with space, underscore, or no separator (case-insensitive)
      const userResult = await sql`
        SELECT id, firstname, lastname, team, alias_1, alias_2, passphrase
        FROM users 
        WHERE (
          LOWER(alias_1 || ' ' || alias_2) = LOWER(${alias})
          OR LOWER(alias_1 || '_' || alias_2) = LOWER(${alias})
          OR LOWER(alias_1 || alias_2) = LOWER(${alias})
        ) AND ishere = true
      `;
      
      if (userResult.length === 0) {
        // User not found
        await this.logLogin(alias, false, ipAddress, userAgent);
        return { success: false, message: 'Invalid credentials' };
      }
      
      const user = userResult[0];
      
      // Normalize passphrases (remove punctuation, lowercase, trim whitespace)
      const normalizePassphrase = (phrase) => {
        return phrase.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
      };
      
      const storedPassphrase = normalizePassphrase(user.passphrase);
      const enteredPassphrase = normalizePassphrase(passphrase);
      
      // Get last word from stored passphrase
      const storedWords = storedPassphrase.split(/\s+/);
      const lastWord = storedWords.length > 0 ? storedWords[storedWords.length - 1] : '';
      
      // Check if entered passphrase matches full passphrase or just the last word
      if (enteredPassphrase === storedPassphrase || enteredPassphrase === lastWord) {
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
        SELECT id, book, clue_red, clue_blue, assigned_red, assigned_blue, red_completed, blue_completed
        FROM book_missions
        WHERE assigned_red = ${agentId} OR assigned_blue = ${agentId}
        ORDER BY id
      `;
      // Return all fields needed for admin view, preserving book, clue_red, and clue_blue
      return rows.map(r => {
        const isRed = r.assigned_red === agentId;
        return {
          id: r.id,
          book: r.book,
          clue_red: r.clue_red,
          clue_blue: r.clue_blue,
          title: r.book, // Keep for compatibility
          mission_body: isRed ? r.clue_red : r.clue_blue, // Keep for compatibility
          color: isRed ? 'red' : 'blue',
          completed: isRed ? r.red_completed : r.blue_completed // Include completion status
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

  // Assign object missions - similar pattern to book/passphrase missions
  async assignObjectMissions() {
    try {
      // Get available agents
      const users = (await sql`SELECT id FROM users WHERE ishere = true`).map(u => u.id)
      if (users.length === 0) return { assigned: 0 }

      // Fetch missions with previous assignments
      const missions = await sql`SELECT id, past_assigned_agents FROM object_missions WHERE completed = false ORDER BY id`

      // Current assignment counts per user (cap at 3 total across all mission types)
      const objectCounts = await sql`SELECT assigned_agent AS user_id, COUNT(*)::int AS cnt FROM object_missions WHERE assigned_agent IS NOT NULL AND completed = false GROUP BY assigned_agent`
      const objectCountMap = new Map(objectCounts.map(r => [r.user_id, Number(r.cnt)]))

      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
      let updates = 0

      for (const m of missions) {
        const prevAssigned = Array.isArray(m.past_assigned_agents) ? m.past_assigned_agents : []
        
        // Check if mission is already assigned
        const currentAssignment = await sql`SELECT assigned_agent FROM object_missions WHERE id = ${m.id}`
        if (currentAssignment[0]?.assigned_agent) {
          continue // Skip if already assigned
        }

        const eligibleUsers = users.filter(id => !prevAssigned.includes(id) && (objectCountMap.get(id) || 0) < 3)
        
        if (eligibleUsers.length > 0) {
          const userId = pick(eligibleUsers)
          
          await sql`
            UPDATE object_missions
            SET assigned_agent = ${userId},
                past_assigned_agents = array_append(COALESCE(past_assigned_agents, ARRAY[]::integer[]), ${userId}),
                assigned_now = true
            WHERE id = ${m.id}
          `
          updates++
          objectCountMap.set(userId, (objectCountMap.get(userId) || 0) + 1)
        }
      }

      return { assigned: updates }
    } catch (error) {
      console.error('Error assigning object missions (Neon):', error)
      throw error
    }
  }
  ,

  // Assign passphrase missions - EXACT same pattern as assignBookMissions
  async assignPassphraseMissions() {
    try {
      // Get available agents - same pattern as book missions
      const users = (await sql`SELECT id FROM users WHERE ishere = true`).map(u => u.id)
      if (users.length < 3) return { assigned: 0, reason: 'Need at least 3 available agents' }

      // Fetch missions with previous assignments - same pattern as book missions
      const missions = await sql`SELECT id, previous_receivers, previous_senders FROM passphrase_missions ORDER BY id`

      // Current assignment counts per user (cap at 3) - same pattern as book missions
      const receiverCounts = await sql`SELECT assigned_receiver AS user_id, COUNT(*)::int AS cnt FROM passphrase_missions WHERE assigned_receiver IS NOT NULL GROUP BY assigned_receiver`
      const sender1Counts = await sql`SELECT assigned_sender_1 AS user_id, COUNT(*)::int AS cnt FROM passphrase_missions WHERE assigned_sender_1 IS NOT NULL GROUP BY assigned_sender_1`
      const sender2Counts = await sql`SELECT assigned_sender_2 AS user_id, COUNT(*)::int AS cnt FROM passphrase_missions WHERE assigned_sender_2 IS NOT NULL GROUP BY assigned_sender_2`
      
      const receiverCountMap = new Map(receiverCounts.map(r => [r.user_id, Number(r.cnt)]))
      const senderCountMap = new Map()
      sender1Counts.forEach(s => {
        senderCountMap.set(s.user_id, (senderCountMap.get(s.user_id) || 0) + Number(s.cnt))
      })
      sender2Counts.forEach(s => {
        senderCountMap.set(s.user_id, (senderCountMap.get(s.user_id) || 0) + Number(s.cnt))
      })

      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
      let updates = 0

      for (const m of missions) {
        const prevReceivers = Array.isArray(m.previous_receivers) ? m.previous_receivers : []
        const prevSenders = Array.isArray(m.previous_senders) ? m.previous_senders : []

        const eligibleReceivers = users.filter(id => !prevReceivers.includes(id) && (receiverCountMap.get(id) || 0) < 3)
        const eligibleSenders = users.filter(id => !prevSenders.includes(id) && (senderCountMap.get(id) || 0) < 3)

        const receiverId = eligibleReceivers.length ? pick(eligibleReceivers) : null
        const availableSenders = eligibleSenders.filter(id => id !== receiverId)

        // Only update if we have a receiver and 2 senders - same pattern as book missions
        if (receiverId !== null && availableSenders.length >= 2) {
          const sender1 = pick(availableSenders)
          const sender2 = pick(availableSenders.filter(id => id !== sender1))
          
          await sql`
            UPDATE passphrase_missions
             SET assigned_receiver = ${receiverId},
                 assigned_sender_1 = ${sender1},
                 assigned_sender_2 = ${sender2},
                 previous_receivers = array_append(COALESCE(previous_receivers, ARRAY[]::integer[]), ${receiverId}),
                 previous_senders = array_append(array_append(COALESCE(previous_senders, ARRAY[]::integer[]), ${sender1}), ${sender2})
             WHERE id = ${m.id}
          `
          updates++
          receiverCountMap.set(receiverId, (receiverCountMap.get(receiverId) || 0) + 1)
          senderCountMap.set(sender1, (senderCountMap.get(sender1) || 0) + 1)
          senderCountMap.set(sender2, (senderCountMap.get(sender2) || 0) + 1)
        }
      }

      return { assigned: updates }
    } catch (error) {
      console.error('Error assigning passphrase missions (Neon):', error)
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

  // ============================================================================
  // NEW PLAN-THEN-EXECUTE APPROACH FOR MISSION ASSIGNMENT
  // ============================================================================
  
  /**
   * Builds a complete assignment plan for all users
   * Returns: { books: [...], passphrases: [...], objects: [...] }
   */
  async buildAssignmentPlan(userIdsArray) {
    // Get users with their teams
    const users = await sql`
      SELECT id, team FROM users WHERE id = ANY(${userIdsArray}::integer[]) AND ishere = true
    `
    
    if (users.length === 0) {
      throw new Error('No valid users selected')
    }

    const redUsers = users.filter(u => u.team === 'red').map(u => u.id)
    const blueUsers = users.filter(u => u.team === 'blue').map(u => u.id)
    const allUsers = users.map(u => u.id)
    
    // Load all available missions
    const bookMissions = await sql`
      SELECT id, previous_reds, previous_blues FROM book_missions 
      WHERE assigned_red IS NULL AND assigned_blue IS NULL
        AND red_completed = false AND blue_completed = false
      ORDER BY id
    `
    
    const passphraseMissions = await sql`
      SELECT id, previous_receivers, previous_senders FROM passphrase_missions
      WHERE assigned_receiver IS NULL AND assigned_sender_1 IS NULL AND assigned_sender_2 IS NULL
        AND completed = false
      ORDER BY id
    `
    
    const objectMissions = await sql`
      SELECT id, past_assigned_agents FROM object_missions
      WHERE assigned_agent IS NULL AND completed = false
      ORDER BY id
    `

    // Track assignments per user
    const userAssignments = new Map() // userId -> { books: [], passphrases: [], objects: [] }
    allUsers.forEach(userId => {
      userAssignments.set(userId, { books: [], passphrases: [], objects: [] })
    })

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
    
    // Helper to check if user has had this mission before
    const userHadBookMission = (userId, mission) => {
      const prevReds = Array.isArray(mission.previous_reds) ? mission.previous_reds : []
      const prevBlues = Array.isArray(mission.previous_blues) ? mission.previous_blues : []
      const userTeam = users.find(u => u.id === userId)?.team
      return userTeam === 'red' ? prevReds.includes(userId) : prevBlues.includes(userId)
    }

    const userHadPassphraseMission = (userId, mission) => {
      const prevReceivers = Array.isArray(mission.previous_receivers) ? mission.previous_receivers : []
      const prevSenders = Array.isArray(mission.previous_senders) ? mission.previous_senders : []
      return prevReceivers.includes(userId) || prevSenders.includes(userId)
    }

    const userHadObjectMission = (userId, mission) => {
      const prev = Array.isArray(mission.past_assigned_agents) ? mission.past_assigned_agents : []
      return prev.includes(userId)
    }

    // Helper to get needed mission type for a user (deterministic, prioritizes diversity)
    const getNeededMissionType = (userId) => {
      const assignments = userAssignments.get(userId)
      const total = assignments.books.length + assignments.passphrases.length + assignments.objects.length
      const types = []
      if (assignments.books.length > 0) types.push('book')
      if (assignments.passphrases.length > 0) types.push('passphrase')
      if (assignments.objects.length > 0) types.push('object')
      const uniqueTypes = new Set(types)
      
      if (total === 0) {
        // No missions yet - prefer book or passphrase (more interesting)
        return 'book' // Start with book missions
      } else if (total === 1) {
        // Has 1 mission - need a different type
        const usedType = types[0]
        if (usedType === 'book') return 'passphrase'
        if (usedType === 'passphrase') return 'object'
        return 'book' // If object, prefer book
      } else if (total === 2) {
        if (uniqueTypes.size === 1) {
          // Has 2 of same type, need different type
          const currentType = types[0]
          if (currentType === 'book') return 'passphrase'
          if (currentType === 'passphrase') return 'object'
          return 'book' // If object, prefer book
        } else {
          // Has 2 different types, can get any - prefer the missing one
          const missingTypes = ['book', 'passphrase', 'object'].filter(t => !types.includes(t))
          if (missingTypes.length > 0) return missingTypes[0]
          // If all types are present, prefer object (simplest)
          return 'object'
        }
      }
      return null // User has 3 missions
    }

    // Helper to check if user needs a specific type for diversity
    // Returns array of types that should be prioritized to ensure diversity
    const needsTypeForDiversity = (userId) => {
      const assignments = userAssignments.get(userId)
      const total = assignments.books.length + assignments.passphrases.length + assignments.objects.length
      const bookCount = assignments.books.length
      const passphraseCount = assignments.passphrases.length
      const objectCount = assignments.objects.length
      
      // Count unique types
      const uniqueTypes = new Set()
      if (bookCount > 0) uniqueTypes.add('book')
      if (passphraseCount > 0) uniqueTypes.add('passphrase')
      if (objectCount > 0) uniqueTypes.add('object')
      
      // If user has 0 missions, any type is fine
      if (total === 0) {
        return ['book', 'passphrase', 'object']
      }
      
      // If user has 1 mission, they need a different type
      if (total === 1) {
        if (bookCount > 0) return ['passphrase', 'object']
        if (passphraseCount > 0) return ['book', 'object']
        if (objectCount > 0) return ['book', 'passphrase']
      }
      
      // If user has 2 missions
      if (total === 2) {
        // If they have 2 of the same type, they MUST get a different type
        if (uniqueTypes.size === 1) {
          if (bookCount === 2) return ['passphrase', 'object']
          if (passphraseCount === 2) return ['book', 'object']
          if (objectCount === 2) return ['book', 'passphrase']
        }
        // If they have 2 different types, any type is fine (will still have 2+ types)
        if (uniqueTypes.size === 2) {
          return ['book', 'passphrase', 'object']
        }
      }
      
      // User has 3 missions, shouldn't be called
      return []
    }
    
    // Helper to count missions for a user (all roles count)
    const countUserMissions = (userId) => {
      const assignments = userAssignments.get(userId)
      return assignments.books.length + assignments.passphrases.length + assignments.objects.length
    }
    
    // Assign missions until all users have exactly 3 missions
    // Prioritize users with fewer missions and ensure diversity
    let iterations = 0
    const maxIterations = allUsers.length * 20 // Increased safety limit
    
    while (iterations < maxIterations) {
      // Get users who still need missions, sorted by how many they have (fewest first)
      const usersNeedingMissions = allUsers
        .map(userId => {
          const total = countUserMissions(userId)
          return { userId, total }
        })
        .filter(u => u.total < 3)
        .sort((a, b) => a.total - b.total) // Prioritize users with fewer missions
      
      if (usersNeedingMissions.length === 0) {
        break // All users have 3 missions
      }
      
      let anyAssignment = false
      
      // Try to assign to each user needing missions
      for (const { userId } of usersNeedingMissions) {
        const assignments = userAssignments.get(userId)
        let total = countUserMissions(userId)
        
        // Re-check total - user might have gotten missions from partner assignments
        if (total >= 3) continue
        
        // Determine which types this user needs for diversity
        const neededTypes = needsTypeForDiversity(userId)
        const neededType = getNeededMissionType(userId)
        
        // Prioritize the needed type, but consider diversity requirements
        const typesToTry = neededType && neededTypes.includes(neededType) 
          ? [neededType, ...neededTypes.filter(t => t !== neededType)]
          : neededTypes
        
        let assigned = false
        
        // Try each type in order, but only assign ONE mission per user per iteration
        for (const typeToTry of typesToTry) {
          // Re-check total before each assignment attempt
          total = countUserMissions(userId)
          if (total >= 3) break
          
          if (assigned) break
          
          if (typeToTry === 'book') {
            const userTeam = users.find(u => u.id === userId)?.team
            if (!userTeam) continue
            
            const availableMissions = bookMissions.filter(m => {
              if (userHadBookMission(userId, m)) return false
              if (m.assigned_red || m.assigned_blue) return false // Already assigned in plan
              return true
            })
            
            if (availableMissions.length > 0) {
              // Sort missions to prefer ones with fewer previous assignments
              availableMissions.sort((a, b) => {
                const aPrev = (Array.isArray(a.previous_reds) ? a.previous_reds.length : 0) + 
                              (Array.isArray(a.previous_blues) ? a.previous_blues.length : 0)
                const bPrev = (Array.isArray(b.previous_reds) ? b.previous_reds.length : 0) + 
                              (Array.isArray(b.previous_blues) ? b.previous_blues.length : 0)
                return aPrev - bPrev
              })
              
              // Try missions in order until we find one with an available partner
              for (const mission of availableMissions) {
                const partnerTeam = userTeam === 'red' ? 'blue' : 'red'
                const partnerPool = partnerTeam === 'red' ? redUsers : blueUsers
                
                // Find available partner (prioritize those with fewer missions)
                const availablePartners = partnerPool
                  .map(partnerId => {
                    const partnerTotal = countUserMissions(partnerId)
                    return { partnerId, total: partnerTotal }
                  })
                  .filter(p => {
                    if (p.total >= 3) return false
                    if (userTeam === 'red') {
                      const prevBlues = Array.isArray(mission.previous_blues) ? mission.previous_blues : []
                      return !prevBlues.includes(p.partnerId)
                    } else {
                      const prevReds = Array.isArray(mission.previous_reds) ? mission.previous_reds : []
                      return !prevReds.includes(p.partnerId)
                    }
                  })
                  .sort((a, b) => a.total - b.total) // Prioritize partners with fewer missions
                
                if (availablePartners.length > 0) {
                  const partner = availablePartners[0].partnerId
                  const partnerTotal = countUserMissions(partner)
                  const partnerAssignments = userAssignments.get(partner)
                  
                  // Only assign if both users have less than 3 missions
                  if (total < 3 && partnerTotal < 3) {
                    assignments.books.push({ missionId: mission.id, partnerId: partner })
                    partnerAssignments.books.push({ missionId: mission.id, partnerId: userId })
                    mission.assigned_red = userTeam === 'red' ? userId : partner
                    mission.assigned_blue = userTeam === 'blue' ? userId : partner
                    assigned = true
                    anyAssignment = true
                    break
                  }
                }
              }
            }
          } else if (typeToTry === 'passphrase') {
            const availableMissions = passphraseMissions.filter(m => {
              if (userHadPassphraseMission(userId, m)) return false
              if (m.assigned_receiver || m.assigned_sender_1 || m.assigned_sender_2) return false
              return true
            })
            
            if (availableMissions.length > 0) {
              // Sort missions to prefer ones with fewer previous assignments
              availableMissions.sort((a, b) => {
                const aPrev = (Array.isArray(a.previous_receivers) ? a.previous_receivers.length : 0) + 
                              (Array.isArray(a.previous_senders) ? a.previous_senders.length : 0)
                const bPrev = (Array.isArray(b.previous_receivers) ? b.previous_receivers.length : 0) + 
                              (Array.isArray(b.previous_senders) ? b.previous_senders.length : 0)
                return aPrev - bPrev
              })
              
              // Try missions in order until we find one with 2 available senders
              for (const mission of availableMissions) {
                const availableSenders = allUsers
                  .map(senderId => {
                    const senderTotal = countUserMissions(senderId)
                    return { senderId, total: senderTotal }
                  })
                  .filter(p => {
                    if (p.senderId === userId) return false
                    if (p.total >= 3) return false
                    const prevReceivers = Array.isArray(mission.previous_receivers) ? mission.previous_receivers : []
                    const prevSenders = Array.isArray(mission.previous_senders) ? mission.previous_senders : []
                    return !prevReceivers.includes(p.senderId) && !prevSenders.includes(p.senderId)
                  })
                  .sort((a, b) => a.total - b.total) // Prioritize senders with fewer missions
                
                if (availableSenders.length >= 2) {
                  const sender1 = availableSenders[0].senderId
                  const sender2 = availableSenders[1].senderId
                  
                  assignments.passphrases.push({ missionId: mission.id, sender1Id: sender1, sender2Id: sender2 })
                  userAssignments.get(sender1).passphrases.push({ missionId: mission.id, receiverId: userId, isSender: true })
                  userAssignments.get(sender2).passphrases.push({ missionId: mission.id, receiverId: userId, isSender: true })
                  mission.assigned_receiver = userId
                  mission.assigned_sender_1 = sender1
                  mission.assigned_sender_2 = sender2
                  assigned = true
                  anyAssignment = true
                  break
                }
              }
            }
          } else if (typeToTry === 'object') {
            const availableMissions = objectMissions.filter(m => {
              if (userHadObjectMission(userId, m)) return false
              if (m.assigned_agent) return false
              return true
            })
            
            if (availableMissions.length > 0) {
              // Sort missions to prefer ones with fewer previous assignments
              availableMissions.sort((a, b) => {
                const aPrev = Array.isArray(a.past_assigned_agents) ? a.past_assigned_agents.length : 0
                const bPrev = Array.isArray(b.past_assigned_agents) ? b.past_assigned_agents.length : 0
                return aPrev - bPrev
              })
              
              const mission = availableMissions[0]
              // Double-check user still has less than 3 missions
              total = countUserMissions(userId)
              if (total < 3) {
                assignments.objects.push({ missionId: mission.id })
                mission.assigned_agent = userId
                assigned = true
                anyAssignment = true
              }
            }
          }
        }
      }
      
      // Check if all users have 3 missions
      const allHaveThree = [...userAssignments.keys()].every(userId => {
        return countUserMissions(userId) >= 3
      })
      
      if (allHaveThree) break
      
      // If no assignment was made but users still need missions, try a more flexible approach
      if (!anyAssignment && usersNeedingMissions.length > 0) {
        // Try assigning any available mission type to users who need missions
        // This handles edge cases where strict diversity requirements can't be met
        // But we still try to maintain diversity when possible
        for (const { userId } of usersNeedingMissions) {
          const assignments = userAssignments.get(userId)
          const total = countUserMissions(userId)
          
          if (total >= 3) continue
          
          // Get diversity requirements for this user
          const neededTypes = needsTypeForDiversity(userId)
          
          // Try to assign any available mission, but prioritize diversity
          let assigned = false
          
          // Try types in diversity order first
          for (const typeToTry of neededTypes) {
            if (assigned) break
            
            if (typeToTry === 'object') {
              const availableMissions = objectMissions.filter(m => {
                if (userHadObjectMission(userId, m)) return false
                if (m.assigned_agent) return false
                return true
              })
              
              if (availableMissions.length > 0) {
                availableMissions.sort((a, b) => {
                  const aPrev = Array.isArray(a.past_assigned_agents) ? a.past_assigned_agents.length : 0
                  const bPrev = Array.isArray(b.past_assigned_agents) ? b.past_assigned_agents.length : 0
                  return aPrev - bPrev
                })
                
                const mission = availableMissions[0]
                total = countUserMissions(userId)
                if (total < 3) {
                  assignments.objects.push({ missionId: mission.id })
                  mission.assigned_agent = userId
                  assigned = true
                  anyAssignment = true
                }
              }
            } else if (typeToTry === 'book') {
              const userTeam = users.find(u => u.id === userId)?.team
              if (userTeam) {
                const availableMissions = bookMissions.filter(m => {
                  if (userHadBookMission(userId, m)) return false
                  if (m.assigned_red || m.assigned_blue) return false
                  return true
                })
                
                if (availableMissions.length > 0) {
                  availableMissions.sort((a, b) => {
                    const aPrev = (Array.isArray(a.previous_reds) ? a.previous_reds.length : 0) + 
                                  (Array.isArray(a.previous_blues) ? a.previous_blues.length : 0)
                    const bPrev = (Array.isArray(b.previous_reds) ? b.previous_reds.length : 0) + 
                                  (Array.isArray(b.previous_blues) ? b.previous_blues.length : 0)
                    return aPrev - bPrev
                  })
                  
                  for (const mission of availableMissions) {
                    const partnerTeam = userTeam === 'red' ? 'blue' : 'red'
                    const partnerPool = partnerTeam === 'red' ? redUsers : blueUsers
                    
                    const availablePartners = partnerPool
                      .map(partnerId => {
                        const partnerTotal = countUserMissions(partnerId)
                        return { partnerId, total: partnerTotal }
                      })
                      .filter(p => {
                        if (p.total >= 3) return false
                        if (userTeam === 'red') {
                          const prevBlues = Array.isArray(mission.previous_blues) ? mission.previous_blues : []
                          return !prevBlues.includes(p.partnerId)
                        } else {
                          const prevReds = Array.isArray(mission.previous_reds) ? mission.previous_reds : []
                          return !prevReds.includes(p.partnerId)
                        }
                      })
                      .sort((a, b) => a.total - b.total)
                    
                    if (availablePartners.length > 0) {
                      const partner = availablePartners[0].partnerId
                      const partnerTotal = countUserMissions(partner)
                      const partnerAssignments = userAssignments.get(partner)
                      
                      total = countUserMissions(userId)
                      if (total < 3 && partnerTotal < 3) {
                        assignments.books.push({ missionId: mission.id, partnerId: partner })
                        partnerAssignments.books.push({ missionId: mission.id, partnerId: userId })
                        mission.assigned_red = userTeam === 'red' ? userId : partner
                        mission.assigned_blue = userTeam === 'blue' ? userId : partner
                        assigned = true
                        anyAssignment = true
                        break
                      }
                    }
                  }
                }
              }
            } else if (typeToTry === 'passphrase') {
              const availableMissions = passphraseMissions.filter(m => {
                if (userHadPassphraseMission(userId, m)) return false
                if (m.assigned_receiver || m.assigned_sender_1 || m.assigned_sender_2) return false
                return true
              })
              
              if (availableMissions.length > 0) {
                availableMissions.sort((a, b) => {
                  const aPrev = (Array.isArray(a.previous_receivers) ? a.previous_receivers.length : 0) + 
                                (Array.isArray(a.previous_senders) ? a.previous_senders.length : 0)
                  const bPrev = (Array.isArray(b.previous_receivers) ? b.previous_receivers.length : 0) + 
                                (Array.isArray(b.previous_senders) ? b.previous_senders.length : 0)
                  return aPrev - bPrev
                })
                
                for (const mission of availableMissions) {
                  const availableSenders = allUsers
                    .map(senderId => {
                      const senderTotal = countUserMissions(senderId)
                      return { senderId, total: senderTotal }
                    })
                    .filter(p => {
                      if (p.senderId === userId) return false
                      if (p.total >= 3) return false
                      const prevReceivers = Array.isArray(mission.previous_receivers) ? mission.previous_receivers : []
                      const prevSenders = Array.isArray(mission.previous_senders) ? mission.previous_senders : []
                      return !prevReceivers.includes(p.senderId) && !prevSenders.includes(p.senderId)
                    })
                    .sort((a, b) => a.total - b.total)
                  
                if (availableSenders.length >= 2) {
                  const sender1 = availableSenders[0].senderId
                  const sender2 = availableSenders[1].senderId
                  const sender1Total = countUserMissions(sender1)
                  const sender2Total = countUserMissions(sender2)
                  
                  total = countUserMissions(userId)
                  if (total < 3 && sender1Total < 3 && sender2Total < 3) {
                      assignments.passphrases.push({ missionId: mission.id, sender1Id: sender1, sender2Id: sender2 })
                      const sender1Assignments = userAssignments.get(sender1)
                      const sender2Assignments = userAssignments.get(sender2)
                      sender1Assignments.passphrases.push({ missionId: mission.id, receiverId: userId, isSender: true })
                      sender2Assignments.passphrases.push({ missionId: mission.id, receiverId: userId, isSender: true })
                      mission.assigned_receiver = userId
                      mission.assigned_sender_1 = sender1
                      mission.assigned_sender_2 = sender2
                      assigned = true
                      anyAssignment = true
                      break
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      if (!anyAssignment) {
        // If still no assignment after relaxed attempts, we've hit a deadlock
        console.warn(`No assignments made in iteration ${iterations}, but users still need missions`)
        break
      }
      iterations++
    }
    
    // Build final plan structure
    const plan = {
      books: [],
      passphrases: [],
      objects: []
    }
    
    // Collect all book assignments (avoid duplicates by mission ID)
    const bookAssignmentsSet = new Set()
    for (const [userId, assignments] of userAssignments) {
      for (const book of assignments.books) {
        const key = `${book.missionId}` // Use just mission ID to avoid duplicates
        if (!bookAssignmentsSet.has(key)) {
          const userTeam = users.find(u => u.id === userId)?.team
          plan.books.push({
            missionId: book.missionId,
            redUserId: userTeam === 'red' ? userId : book.partnerId,
            blueUserId: userTeam === 'blue' ? userId : book.partnerId
          })
          bookAssignmentsSet.add(key)
        }
      }
    }
    
    // Collect all passphrase assignments (avoid duplicates by mission ID)
    const passphraseAssignmentsSet = new Set()
    for (const [userId, assignments] of userAssignments) {
      for (const passphrase of assignments.passphrases) {
        if (!passphrase.isSender) {
          const key = `${passphrase.missionId}` // Use just mission ID to avoid duplicates
          if (!passphraseAssignmentsSet.has(key)) {
            plan.passphrases.push({
              missionId: passphrase.missionId,
              receiverId: userId,
              sender1Id: passphrase.sender1Id,
              sender2Id: passphrase.sender2Id
            })
            passphraseAssignmentsSet.add(key)
          }
        }
      }
    }
    
    // Collect all object assignments
    for (const [userId, assignments] of userAssignments) {
      for (const object of assignments.objects) {
        plan.objects.push({
          missionId: object.missionId,
          agentId: userId
        })
      }
    }
    
    return plan
  },

  /**
   * Validates an assignment plan
   * Returns: { valid: boolean, errors: string[] }
   */
  validateAssignmentPlan(plan, userIdsArray) {
    const errors = []
    const userCounts = new Map()
    const userTypes = new Map()
    
    // Initialize counts
    userIdsArray.forEach(userId => {
      userCounts.set(userId, 0)
      userTypes.set(userId, { books: 0, passphrases: 0, objects: 0 })
    })
    
    // Count book assignments
    for (const book of plan.books) {
      if (book.redUserId) {
        const count = userCounts.get(book.redUserId) || 0
        userCounts.set(book.redUserId, count + 1)
        const types = userTypes.get(book.redUserId) || { books: 0, passphrases: 0, objects: 0 }
        types.books++
        userTypes.set(book.redUserId, types)
      }
      if (book.blueUserId) {
        const count = userCounts.get(book.blueUserId) || 0
        userCounts.set(book.blueUserId, count + 1)
        const types = userTypes.get(book.blueUserId) || { books: 0, passphrases: 0, objects: 0 }
        types.books++
        userTypes.set(book.blueUserId, types)
      }
    }
    
    // Count passphrase assignments
    for (const passphrase of plan.passphrases) {
      if (passphrase.receiverId) {
        const count = userCounts.get(passphrase.receiverId) || 0
        userCounts.set(passphrase.receiverId, count + 1)
        const types = userTypes.get(passphrase.receiverId) || { books: 0, passphrases: 0, objects: 0 }
        types.passphrases++
        userTypes.set(passphrase.receiverId, types)
      }
      if (passphrase.sender1Id) {
        const count = userCounts.get(passphrase.sender1Id) || 0
        userCounts.set(passphrase.sender1Id, count + 1)
        const types = userTypes.get(passphrase.sender1Id) || { books: 0, passphrases: 0, objects: 0 }
        types.passphrases++
        userTypes.set(passphrase.sender1Id, types)
      }
      if (passphrase.sender2Id) {
        const count = userCounts.get(passphrase.sender2Id) || 0
        userCounts.set(passphrase.sender2Id, count + 1)
        const types = userTypes.get(passphrase.sender2Id) || { books: 0, passphrases: 0, objects: 0 }
        types.passphrases++
        userTypes.set(passphrase.sender2Id, types)
      }
    }
    
    // Count object assignments
    for (const object of plan.objects) {
      if (object.agentId) {
        const count = userCounts.get(object.agentId) || 0
        userCounts.set(object.agentId, count + 1)
        const types = userTypes.get(object.agentId) || { books: 0, passphrases: 0, objects: 0 }
        types.objects++
        userTypes.set(object.agentId, types)
      }
    }
    
    // Validate counts
    for (const userId of userIdsArray) {
      const count = userCounts.get(userId) || 0
      if (count !== 3) {
        errors.push(`User ${userId} has ${count} missions (expected 3)`)
      }
      
      // Validate diversity (at least 2 different types)
      const types = userTypes.get(userId) || { books: 0, passphrases: 0, objects: 0 }
      const typeCount = (types.books > 0 ? 1 : 0) + (types.passphrases > 0 ? 1 : 0) + (types.objects > 0 ? 1 : 0)
      if (typeCount < 2 && count === 3) {
        errors.push(`User ${userId} has ${count} missions but only ${typeCount} different types (need at least 2)`)
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  },

  /**
   * Executes an assignment plan atomically using CTE-based batch updates
   * This ensures all assignments for each mission type are executed in a single query
   * @param {Object} plan - The assignment plan with books, passphrases, objects arrays
   * @param {number[]} userIdsArray - Array of user IDs being assigned
   * @param {Date|null} expectedTimestamp - Optional timestamp to verify assignments haven't changed
   */
  async executeAssignmentPlan(plan, userIdsArray, expectedTimestamp = null) {
    const execId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log(`[${execId}] executeAssignmentPlan called with ${plan.books.length} books, ${plan.passphrases.length} passphrases, ${plan.objects.length} objects`)
    
    // Verify lock is still held
    const lockCheck = await sql`
      SELECT currently_updating FROM assignment_timestamp WHERE id = 1
    `
    if (!lockCheck.length || !lockCheck[0].currently_updating) {
      console.error(`[${execId}] Lock not held!`)
      throw new Error('Lock not held - another process may be updating assignments')
    }
    
    console.log(`[${execId}] Lock verified, proceeding with assignments`)
    
    // Verify timestamp hasn't changed
    if (expectedTimestamp !== null) {
      const currentTimestamp = await sql`
        SELECT last_assigned_at FROM assignment_timestamp WHERE id = 1
      `
      const currentValue = currentTimestamp.length > 0 ? currentTimestamp[0].last_assigned_at : null
      
      if (currentValue === null && expectedTimestamp !== null) {
        throw new Error('Assignments were updated by another process before execution')
      }
      if (currentValue !== null && expectedTimestamp !== null) {
        const currentTime = currentValue instanceof Date ? currentValue.getTime() : new Date(currentValue).getTime()
        const expectedTime = expectedTimestamp instanceof Date ? expectedTimestamp.getTime() : new Date(expectedTimestamp).getTime()
        if (currentTime !== expectedTime) {
          throw new Error('Assignments were updated by another process before execution')
        }
      }
    }
    
    // Execute all book assignments atomically using CTE
    if (plan.books.length > 0) {
      const bookValues = plan.books.map(book => 
        `(${book.missionId}::integer, ${book.redUserId}::integer, ${book.blueUserId}::integer)`
      ).join(', ')
      
      const bookResult = await sql`
        WITH assignment_plan AS (
          SELECT * FROM (VALUES ${sql.unsafe(bookValues)}) AS t(mission_id, red_user_id, blue_user_id)
        )
        UPDATE book_missions
        SET assigned_red = assignment_plan.red_user_id,
            assigned_blue = assignment_plan.blue_user_id,
            previous_reds = array_append(COALESCE(book_missions.previous_reds, ARRAY[]::integer[]), assignment_plan.red_user_id),
            previous_blues = array_append(COALESCE(book_missions.previous_blues, ARRAY[]::integer[]), assignment_plan.blue_user_id)
        FROM assignment_plan
        WHERE book_missions.id = assignment_plan.mission_id
          AND book_missions.assigned_red IS NULL
          AND book_missions.assigned_blue IS NULL
          AND EXISTS (SELECT 1 FROM assignment_timestamp WHERE id = 1 AND currently_updating = true)
        RETURNING book_missions.id
      `
      console.log(`[${execId}] Book assignments: attempted ${plan.books.length}, actually updated ${bookResult.length}`)
    }
    
    // Execute all passphrase assignments atomically using CTE
    if (plan.passphrases.length > 0) {
      const passphraseValues = plan.passphrases.map(p => 
        `(${p.missionId}::integer, ${p.receiverId}::integer, ${p.sender1Id}::integer, ${p.sender2Id}::integer)`
      ).join(', ')
      
      const passphraseResult = await sql`
        WITH assignment_plan AS (
          SELECT * FROM (VALUES ${sql.unsafe(passphraseValues)}) AS t(mission_id, receiver_id, sender1_id, sender2_id)
        )
        UPDATE passphrase_missions
        SET assigned_receiver = assignment_plan.receiver_id,
            assigned_sender_1 = assignment_plan.sender1_id,
            assigned_sender_2 = assignment_plan.sender2_id,
            previous_receivers = array_append(COALESCE(passphrase_missions.previous_receivers, ARRAY[]::integer[]), assignment_plan.receiver_id),
            previous_senders = array_append(
              array_append(COALESCE(passphrase_missions.previous_senders, ARRAY[]::integer[]), assignment_plan.sender1_id),
              assignment_plan.sender2_id
            )
        FROM assignment_plan
        WHERE passphrase_missions.id = assignment_plan.mission_id
          AND passphrase_missions.assigned_receiver IS NULL
          AND passphrase_missions.assigned_sender_1 IS NULL
          AND passphrase_missions.assigned_sender_2 IS NULL
          AND EXISTS (SELECT 1 FROM assignment_timestamp WHERE id = 1 AND currently_updating = true)
        RETURNING passphrase_missions.id
      `
      console.log(`[${execId}] Passphrase assignments: attempted ${plan.passphrases.length}, actually updated ${passphraseResult.length}`)
    }
    
    // Execute all object assignments atomically using CTE
    if (plan.objects.length > 0) {
      const objectValues = plan.objects.map(obj => 
        `(${obj.missionId}::integer, ${obj.agentId}::integer)`
      ).join(', ')
      
      const objectResult = await sql`
        WITH assignment_plan AS (
          SELECT * FROM (VALUES ${sql.unsafe(objectValues)}) AS t(mission_id, agent_id)
        )
        UPDATE object_missions
        SET assigned_agent = assignment_plan.agent_id,
            past_assigned_agents = array_append(COALESCE(object_missions.past_assigned_agents, ARRAY[]::integer[]), assignment_plan.agent_id),
            assigned_now = true
        FROM assignment_plan
        WHERE object_missions.id = assignment_plan.mission_id
          AND object_missions.assigned_agent IS NULL
          AND EXISTS (SELECT 1 FROM assignment_timestamp WHERE id = 1 AND currently_updating = true)
        RETURNING object_missions.id
      `
      console.log(`[${execId}] Object assignments: attempted ${plan.objects.length}, actually updated ${objectResult.length}`)
    }
    
    console.log(`[${execId}] All assignments completed successfully`)
  },

  // Reset all missions (book, passphrase, and object) and assign until each user has 3 missions total
  // NOTE: Only works if there's an active session
  // Uses optimistic locking with retry logic to handle concurrent requests
  async resetAndAssignAllMissions() {
    const functionCallId = `reset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log(`[${functionCallId}] resetAndAssignAllMissions called`)
    
    let lockAcquired = false
    const maxLockRetries = 5
    const baseDelayMs = 100 // Start with 100ms delay
    
    try {
      // Quick early check - if lock is held, return immediately
      const quickCheck = await sql`
        SELECT currently_updating FROM assignment_timestamp WHERE id = 1
      `
      if (quickCheck.length > 0 && quickCheck[0].currently_updating === true) {
        console.log(`[${functionCallId}] Lock already held, returning early`)
        return { assigned: 0, reason: 'Lock already held' }
      }
      
      const activeSession = await this.getActiveSession()
      if (!activeSession) {
        throw new Error('No active session. Cannot assign missions.')
      }
      
      const sessionUserIds = activeSession.participant_user_ids || []
      if (sessionUserIds.length === 0) {
        throw new Error('No participants in active session')
      }
      
      console.log(`[${functionCallId}] Attempting to acquire lock for ${sessionUserIds.length} users`)
      
      // Try to acquire lock with retry logic
      let lockResult = null
      let timestampValue = null
      
      for (let attempt = 0; attempt < maxLockRetries; attempt++) {
        // Get current timestamp and lock status atomically
        const timestampCheck = await sql`
          SELECT last_assigned_at, currently_updating FROM assignment_timestamp WHERE id = 1
        `
        
        if (timestampCheck.length > 0 && timestampCheck[0].currently_updating === true) {
          // Lock is held, wait and retry with exponential backoff
          if (attempt < maxLockRetries - 1) {
            const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 50 // Add jitter
            console.log(`[${functionCallId}] Lock held, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxLockRetries})`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
            continue
          } else {
            console.log(`[${functionCallId}] Lock held after all retries, giving up`)
            return { assigned: 0, reason: 'Lock held after retries' }
          }
        }
        
        timestampValue = timestampCheck.length > 0 ? timestampCheck[0].last_assigned_at : null
        
        // Ensure row exists
        await sql`
          INSERT INTO assignment_timestamp (id, last_assigned_at, currently_updating)
          VALUES (1, NOW(), false)
          ON CONFLICT (id) DO NOTHING
        `
        
        // Try to acquire lock atomically - check timestamp matches AND lock is free
        lockResult = timestampValue 
          ? await sql`
              UPDATE assignment_timestamp 
              SET currently_updating = true
              WHERE id = 1 
                AND currently_updating = false
                AND last_assigned_at = ${timestampValue}
              RETURNING id, last_assigned_at, currently_updating
            `
          : await sql`
              UPDATE assignment_timestamp 
              SET currently_updating = true
              WHERE id = 1 
                AND currently_updating = false
                AND last_assigned_at IS NULL
              RETURNING id, last_assigned_at, currently_updating
            `
        
        if (lockResult.length > 0 && lockResult[0].currently_updating === true) {
          lockAcquired = true
          console.log(`[${functionCallId}] Lock acquired successfully on attempt ${attempt + 1}`)
          break // Successfully acquired lock
        }
        
        // Lock acquisition failed - another process got it first
        if (attempt < maxLockRetries - 1) {
          const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 50
          console.log(`[${functionCallId}] Lock acquisition failed, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxLockRetries})`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
      
      if (!lockAcquired || !lockResult || lockResult.length === 0) {
        console.log(`[${functionCallId}] Failed to acquire lock after ${maxLockRetries} attempts`)
        return { assigned: 0, reason: 'Failed to acquire lock after retries' }
      }
      
      console.log(`[${functionCallId}] Unassigning missions for session users...`)
      
      // CRITICAL: Unassign all missions for session users BEFORE building plan
      // The plan builder queries for missions where assigned_* IS NULL, so we must clear assignments first
      const unassignBooks = await sql`
        UPDATE book_missions
        SET assigned_red = NULL,
            assigned_blue = NULL,
            red_completed = false,
            blue_completed = false
        WHERE assigned_red = ANY(${sessionUserIds}::integer[]) OR assigned_blue = ANY(${sessionUserIds}::integer[])
        RETURNING id
      `
      
      const unassignPassphrases = await sql`
        UPDATE passphrase_missions
        SET assigned_receiver = NULL,
            assigned_sender_1 = NULL,
            assigned_sender_2 = NULL,
            completed = false
        WHERE assigned_receiver = ANY(${sessionUserIds}::integer[]) 
           OR assigned_sender_1 = ANY(${sessionUserIds}::integer[])
           OR assigned_sender_2 = ANY(${sessionUserIds}::integer[])
        RETURNING id
      `
      
      const unassignObjects = await sql`
        UPDATE object_missions
        SET assigned_agent = NULL,
            assigned_now = false,
            completed = false
        WHERE assigned_agent = ANY(${sessionUserIds}::integer[])
        RETURNING id
      `
      
      console.log(`[${functionCallId}] Unassigned: ${unassignBooks.length} books, ${unassignPassphrases.length} passphrases, ${unassignObjects.length} objects`)
      
      // Verify lock is still held after unassignment
      const lockAfterUnassign = await sql`
        SELECT currently_updating FROM assignment_timestamp WHERE id = 1
      `
      if (!lockAfterUnassign.length || !lockAfterUnassign[0].currently_updating) {
        throw new Error('Lock lost after unassignment - aborting to prevent race condition')
      }
      
      console.log(`[${functionCallId}] Building assignment plan...`)
      
      // Lock acquired AND missions unassigned - now build plan based on CURRENT database state
      // This ensures we're working with fresh data after acquiring the lock and clearing assignments
      let plan = null
      let validation = null
      const maxPlanRetries = 50
      let retryCount = 0
      
      while (retryCount < maxPlanRetries) {
        plan = await this.buildAssignmentPlan(sessionUserIds)
        validation = this.validateAssignmentPlan(plan, sessionUserIds)
        
        if (validation.valid) {
          break
        }
        
        retryCount++
        if (retryCount >= maxPlanRetries) {
          throw new Error(`Assignment plan invalid after ${maxPlanRetries} attempts: ${validation.errors.join(', ')}`)
        }
      }
      
      console.log(`[${functionCallId}] Plan built: ${plan.books.length} books, ${plan.passphrases.length} passphrases, ${plan.objects.length} objects`)
      
      // Log the plan (only the process that acquired the lock will log)
      console.log('\n📋 MISSION REASSIGNMENT PLAN:')
      console.log('═'.repeat(60))
      
      if (plan.books.length > 0) {
        console.log(`\n📚 Book Missions (${plan.books.length}):`)
        plan.books.forEach((book, idx) => {
          console.log(`  ${idx + 1}. Mission ${book.missionId}: Red User ${book.redUserId} + Blue User ${book.blueUserId}`)
        })
      }
      
      if (plan.passphrases.length > 0) {
        console.log(`\n🔐 Passphrase Missions (${plan.passphrases.length}):`)
        plan.passphrases.forEach((p, idx) => {
          console.log(`  ${idx + 1}. Mission ${p.missionId}: Receiver ${p.receiverId}, Senders ${p.sender1Id} & ${p.sender2Id}`)
        })
      }
      
      if (plan.objects.length > 0) {
        console.log(`\n🎯 Object Missions (${plan.objects.length}):`)
        plan.objects.forEach((obj, idx) => {
          console.log(`  ${idx + 1}. Mission ${obj.missionId}: Agent ${obj.agentId}`)
        })
      }
      
      const totalMissions = plan.books.length + plan.passphrases.length + plan.objects.length
      console.log(`\n📊 Total: ${totalMissions} missions`)
      
      // Log detailed per-user breakdown
      console.log('\n📋 PER-USER BREAKDOWN:')
      const userCounts = new Map()
      const userTypes = new Map()
      
      // Count book assignments
      for (const book of plan.books) {
        if (book.redUserId) {
          userCounts.set(book.redUserId, (userCounts.get(book.redUserId) || 0) + 1)
          const types = userTypes.get(book.redUserId) || { books: 0, passphrases: 0, objects: 0 }
          types.books++
          userTypes.set(book.redUserId, types)
        }
        if (book.blueUserId) {
          userCounts.set(book.blueUserId, (userCounts.get(book.blueUserId) || 0) + 1)
          const types = userTypes.get(book.blueUserId) || { books: 0, passphrases: 0, objects: 0 }
          types.books++
          userTypes.set(book.blueUserId, types)
        }
      }
      
      // Count passphrase assignments
      for (const p of plan.passphrases) {
        if (p.receiverId) {
          userCounts.set(p.receiverId, (userCounts.get(p.receiverId) || 0) + 1)
          const types = userTypes.get(p.receiverId) || { books: 0, passphrases: 0, objects: 0 }
          types.passphrases++
          userTypes.set(p.receiverId, types)
        }
        if (p.sender1Id) {
          userCounts.set(p.sender1Id, (userCounts.get(p.sender1Id) || 0) + 1)
          const types = userTypes.get(p.sender1Id) || { books: 0, passphrases: 0, objects: 0 }
          types.passphrases++
          userTypes.set(p.sender1Id, types)
        }
        if (p.sender2Id) {
          userCounts.set(p.sender2Id, (userCounts.get(p.sender2Id) || 0) + 1)
          const types = userTypes.get(p.sender2Id) || { books: 0, passphrases: 0, objects: 0 }
          types.passphrases++
          userTypes.set(p.sender2Id, types)
        }
      }
      
      // Count object assignments
      for (const obj of plan.objects) {
        if (obj.agentId) {
          userCounts.set(obj.agentId, (userCounts.get(obj.agentId) || 0) + 1)
          const types = userTypes.get(obj.agentId) || { books: 0, passphrases: 0, objects: 0 }
          types.objects++
          userTypes.set(obj.agentId, types)
        }
      }
      
      // Log per-user breakdown
      for (const userId of sessionUserIds.sort((a, b) => a - b)) {
        const count = userCounts.get(userId) || 0
        const types = userTypes.get(userId) || { books: 0, passphrases: 0, objects: 0 }
        const typeCount = (types.books > 0 ? 1 : 0) + (types.passphrases > 0 ? 1 : 0) + (types.objects > 0 ? 1 : 0)
        const status = count === 3 && typeCount >= 2 ? '✅' : '❌'
        console.log(`  ${status} User ${userId}: ${count} missions (${types.books} books, ${types.passphrases} passphrases, ${types.objects} objects) - ${typeCount} types`)
      }
      
      console.log('═'.repeat(60) + '\n')
      
      // Verify lock is still held before executing plan
      const lockStillHeld = await sql`
        SELECT currently_updating FROM assignment_timestamp WHERE id = 1
      `
      if (!lockStillHeld.length || !lockStillHeld[0].currently_updating) {
        throw new Error('Lock lost before executing plan - aborting to prevent race condition')
      }
      
      console.log(`[${functionCallId}] Executing assignment plan...`)
      
      // Execute plan
      await this.executeAssignmentPlan(plan, sessionUserIds, timestampValue)
      
      console.log(`[${functionCallId}] Plan executed successfully`)
      
      // Verify assignments were made correctly
      const verificationResult = await sql`
        SELECT 
          (SELECT COUNT(*) FROM book_missions WHERE assigned_red = ANY(${sessionUserIds}::integer[]) OR assigned_blue = ANY(${sessionUserIds}::integer[])) as book_count,
          (SELECT COUNT(*) FROM passphrase_missions WHERE assigned_receiver = ANY(${sessionUserIds}::integer[]) OR assigned_sender_1 = ANY(${sessionUserIds}::integer[]) OR assigned_sender_2 = ANY(${sessionUserIds}::integer[])) as passphrase_count,
          (SELECT COUNT(*) FROM object_missions WHERE assigned_agent = ANY(${sessionUserIds}::integer[])) as object_count
      `
      
      console.log(`[${functionCallId}] Verification: ${verificationResult[0].book_count} books, ${verificationResult[0].passphrase_count} passphrases, ${verificationResult[0].object_count} objects`)
      
      // CRITICAL: Update timestamp BEFORE releasing lock to prevent race conditions
      // This ensures other tabs see the updated timestamp immediately
      await this.updateAssignmentTimestamp()
      
      console.log(`[${functionCallId}] Timestamp updated`)
      
      // Verify lock is still held after timestamp update
      const finalLockCheck = await sql`
        SELECT currently_updating FROM assignment_timestamp WHERE id = 1
      `
      if (!finalLockCheck.length || !finalLockCheck[0].currently_updating) {
        throw new Error('Lock lost during timestamp update - aborting')
      }
      
      console.log(`[${functionCallId}] Completing successfully, releasing lock`)
      
      return {
        success: true,
        assigned: totalMissions,
        usersAssigned: sessionUserIds.length,
        unassigned: {
          books: unassignBooks.length,
          passphrases: unassignPassphrases.length,
          objects: unassignObjects.length
        },
        verification: verificationResult[0]
      }
    } catch (error) {
      console.error(`[${functionCallId}] Error in resetAndAssignAllMissions:`, error)
      throw error
    } finally {
      if (lockAcquired) {
        try {
          console.log(`[${functionCallId}] Releasing lock`)
          await sql`UPDATE assignment_timestamp SET currently_updating = false WHERE id = 1`
          console.log(`[${functionCallId}] Lock released`)
        } catch (clearError) {
          console.error(`[${functionCallId}] Error clearing currently_updating flag:`, clearError)
        }
      }
    }
  },

  // Assign missions to users (internal helper function)
  async assignMissionsToSessionUsers(userIdsArray) {
    let lockAcquired = false // Track if we acquired the lock, so finally block can clear it
    try {
      // STEP 1: Get the current assignment timestamp BEFORE building plan
      // This allows multiple tabs to calculate plans in parallel
      const timestampBefore = await sql`
        SELECT last_assigned_at FROM assignment_timestamp WHERE id = 1
      `
      const timestampValue = timestampBefore.length > 0 ? timestampBefore[0].last_assigned_at : null
      
      // Build and validate assignment plan
      let plan = null
      let validation = null
      const maxRetries = 50 // Maximum attempts to build a valid plan
      let retryCount = 0
      
      while (retryCount < maxRetries) {
        plan = await this.buildAssignmentPlan(userIdsArray)
        validation = this.validateAssignmentPlan(plan, userIdsArray)
        
        if (validation.valid) {
          break // Valid plan found, exit retry loop
        }
        
        retryCount++
        if (retryCount >= maxRetries) {
          throw new Error(`Assignment plan invalid after ${maxRetries} attempts: ${validation.errors.join(', ')}`)
        }
      }
      
      // Ensure the row exists first
      await sql`
        INSERT INTO assignment_timestamp (id, last_assigned_at, currently_updating)
        VALUES (1, NOW(), false)
        ON CONFLICT (id) DO NOTHING
      `
      
      // Atomically acquire lock AND check timestamp hasn't changed
      // Only succeeds if lock is free AND timestamp hasn't changed since we started
      const lockResult = timestampValue 
        ? await sql`
          UPDATE assignment_timestamp 
          SET currently_updating = true
          WHERE id = 1 
            AND currently_updating = false
            AND last_assigned_at = ${timestampValue}
          RETURNING id, last_assigned_at, currently_updating
        `
        : await sql`
          UPDATE assignment_timestamp 
          SET currently_updating = true
          WHERE id = 1 
            AND currently_updating = false
            AND last_assigned_at IS NULL
          RETURNING id, last_assigned_at, currently_updating
        `
      
      if (lockResult.length === 0) {
        // Another tab already updated assignments or has the lock - fail silently
        return { success: false, assigned: 0 }
      }
      
      if (!lockResult[0].currently_updating) {
        return { success: false, assigned: 0 }
      }
      
      lockAcquired = true
      
      // Only log the plan AFTER acquiring the lock (only the tab that wins will log)
      console.log('\n📋 MISSION REASSIGNMENT PLAN:')
      console.log('═'.repeat(60))
      
      if (plan.books.length > 0) {
        console.log(`\n📚 Book Missions (${plan.books.length}):`)
        plan.books.forEach((book, idx) => {
          console.log(`  ${idx + 1}. Mission ${book.missionId}: Red User ${book.redUserId} + Blue User ${book.blueUserId}`)
        })
      }
      
      if (plan.passphrases.length > 0) {
        console.log(`\n🔐 Passphrase Missions (${plan.passphrases.length}):`)
        plan.passphrases.forEach((p, idx) => {
          console.log(`  ${idx + 1}. Mission ${p.missionId}: Receiver ${p.receiverId}, Senders ${p.sender1Id} & ${p.sender2Id}`)
        })
      }
      
      if (plan.objects.length > 0) {
        console.log(`\n🎯 Object Missions (${plan.objects.length}):`)
        plan.objects.forEach((obj, idx) => {
          console.log(`  ${idx + 1}. Mission ${obj.missionId}: Agent ${obj.agentId}`)
        })
      }
      
      const totalMissions = plan.books.length + plan.passphrases.length + plan.objects.length
      console.log(`\n📊 Total: ${totalMissions} missions`)
      console.log('═'.repeat(60) + '\n')
      
      // Unassign all missions for selected users
      // Use simpler, more direct updates to ensure all assignments are cleared
      await sql`
        UPDATE book_missions
        SET assigned_red = NULL,
            assigned_blue = NULL,
            red_completed = false,
            blue_completed = false
        WHERE assigned_red = ANY(${userIdsArray}::integer[]) OR assigned_blue = ANY(${userIdsArray}::integer[])
      `
      
      await sql`
        UPDATE passphrase_missions
        SET assigned_receiver = NULL,
            assigned_sender_1 = NULL,
            assigned_sender_2 = NULL,
            completed = false
        WHERE assigned_receiver = ANY(${userIdsArray}::integer[]) 
           OR assigned_sender_1 = ANY(${userIdsArray}::integer[])
           OR assigned_sender_2 = ANY(${userIdsArray}::integer[])
      `
      
      await sql`
        UPDATE object_missions
        SET assigned_agent = NULL,
            assigned_now = false,
            completed = false
        WHERE assigned_agent = ANY(${userIdsArray}::integer[])
      `
      
      // STEP 5: Execute plan (pass timestamp to verify nothing changed)
      await this.executeAssignmentPlan(plan, userIdsArray, timestampValue)
      
      // Update timestamp
      await this.updateAssignmentTimestamp()
      
      return {
        success: true,
        usersAssigned: userIdsArray.length,
        missionsAssigned: totalMissions
      }
    } catch (error) {
      console.error('Error assigning missions to session users:', error)
      throw error
    } finally {
      if (lockAcquired) {
        try {
          await sql`UPDATE assignment_timestamp SET currently_updating = false WHERE id = 1`
        } catch (clearError) {
          console.error('Error clearing currently_updating flag:', clearError)
        }
      }
    }
  },

  // Get passphrase missions for a specific agent
  async getPassphraseMissionsForAgent(agentId) {
    try {
      const rows = await sql`
        SELECT id, passphrase_template, correct_answer, incorrect_answer, assigned_receiver, assigned_sender_1, assigned_sender_2, completed
        FROM passphrase_missions
        WHERE assigned_receiver = ${agentId} OR assigned_sender_1 = ${agentId} OR assigned_sender_2 = ${agentId}
        ORDER BY id
      `
      // Return all fields needed for admin view, preserving passphrase_template, correct_answer, incorrect_answer
      return rows.map(r => {
        const isReceiver = r.assigned_receiver === agentId
        const isSender1 = r.assigned_sender_1 === agentId
        const isSender2 = r.assigned_sender_2 === agentId
        
        let mission_body = ''
        if (isReceiver) {
          mission_body = `Agents are looking to have you complete the passphrase:\n${r.passphrase_template}\nOne agent is trying to pass the correct intel while another is looking to pass incorrect intel. When you're ready, type in what you believe is the correct answer.`
        } else if (isSender1) {
          // Sender 1 passes TRUE (correct) intel
          const passphraseWithWord = r.passphrase_template.replace(/___/g, r.correct_answer)
          mission_body = `You are looking to pass the following TRUE intel to a receiver:\n"${passphraseWithWord}"\nBe cautious, another agent is trying to pass FALSE intel.`
        } else if (isSender2) {
          // Sender 2 passes FALSE (incorrect) intel
          const passphraseWithWord = r.passphrase_template.replace(/___/g, r.incorrect_answer)
          mission_body = `You are looking to pass the following FALSE intel to a receiver:\n"${passphraseWithWord}"\nBe cautious, another agent is trying to pass TRUE intel.`
        }
        
        return {
          id: r.id,
          type: 'passphrase',
          title: 'Passphrase Mission',
          mission_body: mission_body, // Keep for compatibility
          passphrase_template: r.passphrase_template, // Preserve for admin view
          correct_answer: r.correct_answer, // Preserve for admin view
          incorrect_answer: r.incorrect_answer, // Preserve for admin view
          assigned_receiver: r.assigned_receiver, // Preserve for admin view
          assigned_sender_1: r.assigned_sender_1, // Preserve for admin view
          assigned_sender_2: r.assigned_sender_2, // Preserve for admin view
          role: isReceiver ? 'receiver' : (isSender1 ? 'sender1' : 'sender2'),
          completed: r.completed
        }
      })
    } catch (error) {
      console.error('Error fetching passphrase missions for agent:', error)
      throw error
    }
  },

  // Get object missions for a specific agent
  async getObjectMissionsForAgent(agentId) {
    try {
      const rows = await sql`
        SELECT id, title, mission_body, success_key, completed, assigned_agent
        FROM object_missions
        WHERE assigned_agent = ${agentId}
        ORDER BY id
      `
      return rows.map(r => ({
        id: r.id,
        type: 'object',
        title: r.title,
        mission_body: r.mission_body,
        success_key: r.success_key,
        completed: r.completed || false
      }))
    } catch (error) {
      console.error('Error fetching object missions for agent:', error)
      throw error
    }
  },

  // Get all missions (both book, passphrase, and object) for a specific agent
  // Only returns missions if agent is in an active session
  async getAllMissionsForAgent(agentId) {
    try {
      // Check if there's an active session and if user is in it
      let activeSession = null
      try {
        activeSession = await this.getActiveSession()
      } catch (error) {
        // If getting active session fails, log but don't throw - just return empty array
        console.error('Error fetching active session in getAllMissionsForAgent:', error)
        return []
      }
      
      if (!activeSession) {
        // No active session - return empty array
        return []
      }
      
      // Convert agentId to number for comparison
      const agentIdNum = Number(agentId)
      const participantIds = (activeSession.participant_user_ids || []).map(id => Number(id))
      
      if (!participantIds.includes(agentIdNum)) {
        // User is not in active session - return empty array
        return []
      }
      
      // Fetch missions for each type, handling errors gracefully
      let bookMissions = []
      let passphraseMissions = []
      let objectMissions = []
      
      try {
        bookMissions = await this.getBookMissionsForAgent(agentId)
      } catch (error) {
        console.error('Error fetching book missions:', error)
        // Continue with other mission types
      }
      
      try {
        passphraseMissions = await this.getPassphraseMissionsForAgent(agentId)
      } catch (error) {
        console.error('Error fetching passphrase missions:', error)
        // Continue with other mission types
      }
      
      try {
        objectMissions = await this.getObjectMissionsForAgent(agentId)
      } catch (error) {
        console.error('Error fetching object missions:', error)
        // Continue with other mission types
      }
      
      // Add type field to book missions if not present
      const bookMissionsWithType = bookMissions.map(m => ({
        ...m,
        type: 'book'
      }))
      
      // Combine and return
      return [...bookMissionsWithType, ...passphraseMissions, ...objectMissions]
    } catch (error) {
      // This catch should rarely be hit now since we handle errors above
      // But if something unexpected happens, log it and return empty array instead of throwing
      console.error('Unexpected error in getAllMissionsForAgent:', error)
      return []
    }
  },

  // Clear all intel for a specific agent
  async clearAgentIntel(agentId) {
    try {
      await sql`
        DELETE FROM agent_intel WHERE agent_id = ${agentId}
      `
    } catch (error) {
      console.error('Error clearing agent intel:', error)
      throw error
    }
  },

 
  // Reset a session: clear all mission assignments, completions, and intel for session participants
  // Works for paused or ended sessions (does not require active session)
  async resetSession(sessionId) {
    try {
      // Get the session to find participants
      const sessionResult = await sql`
        SELECT id, participant_user_ids, status
        FROM sessions
        WHERE id = ${sessionId}
      `
      
      if (sessionResult.length === 0) {
        throw new Error('Session not found')
      }
      
      const session = sessionResult[0]
      
      // Only allow reset for paused or ended sessions
      if (session.status !== 'paused' && session.status !== 'ended') {
        throw new Error('Can only reset paused or ended sessions')
      }
      
      const sessionUserIds = session.participant_user_ids || []
      if (sessionUserIds.length === 0) {
        throw new Error('No participants in session')
      }
      
      // Clear all mission assignments, completions, and history for session users
      // Reset book missions for session users
      await sql`
        UPDATE book_missions
        SET assigned_red = CASE WHEN assigned_red = ANY(${sessionUserIds}::integer[]) THEN NULL ELSE assigned_red END,
            assigned_blue = CASE WHEN assigned_blue = ANY(${sessionUserIds}::integer[]) THEN NULL ELSE assigned_blue END,
            red_completed = CASE WHEN assigned_red = ANY(${sessionUserIds}::integer[]) THEN false ELSE red_completed END,
            blue_completed = CASE WHEN assigned_blue = ANY(${sessionUserIds}::integer[]) THEN false ELSE blue_completed END,
            previous_reds = ARRAY(
              SELECT unnest(COALESCE(previous_reds, ARRAY[]::integer[]))
              EXCEPT
              SELECT unnest(${sessionUserIds}::integer[])
            ),
            previous_blues = ARRAY(
              SELECT unnest(COALESCE(previous_blues, ARRAY[]::integer[]))
              EXCEPT
              SELECT unnest(${sessionUserIds}::integer[])
            )
        WHERE assigned_red = ANY(${sessionUserIds}::integer[]) 
           OR assigned_blue = ANY(${sessionUserIds}::integer[])
           OR previous_reds && ${sessionUserIds}::integer[]
           OR previous_blues && ${sessionUserIds}::integer[]
      `
      
      // Reset passphrase missions for session users
      await sql`
        UPDATE passphrase_missions
        SET assigned_receiver = CASE WHEN assigned_receiver = ANY(${sessionUserIds}::integer[]) THEN NULL ELSE assigned_receiver END,
            assigned_sender_1 = CASE WHEN assigned_sender_1 = ANY(${sessionUserIds}::integer[]) THEN NULL ELSE assigned_sender_1 END,
            assigned_sender_2 = CASE WHEN assigned_sender_2 = ANY(${sessionUserIds}::integer[]) THEN NULL ELSE assigned_sender_2 END,
            completed = CASE WHEN assigned_receiver = ANY(${sessionUserIds}::integer[]) 
                              OR assigned_sender_1 = ANY(${sessionUserIds}::integer[])
                              OR assigned_sender_2 = ANY(${sessionUserIds}::integer[])
                         THEN false ELSE completed END,
            previous_receivers = ARRAY(
              SELECT unnest(COALESCE(previous_receivers, ARRAY[]::integer[]))
              EXCEPT
              SELECT unnest(${sessionUserIds}::integer[])
            ),
            previous_senders = ARRAY(
              SELECT unnest(COALESCE(previous_senders, ARRAY[]::integer[]))
              EXCEPT
              SELECT unnest(${sessionUserIds}::integer[])
            )
        WHERE assigned_receiver = ANY(${sessionUserIds}::integer[]) 
           OR assigned_sender_1 = ANY(${sessionUserIds}::integer[])
           OR assigned_sender_2 = ANY(${sessionUserIds}::integer[])
           OR previous_receivers && ${sessionUserIds}::integer[]
           OR previous_senders && ${sessionUserIds}::integer[]
      `
      
      // Reset object missions for session users
      await sql`
        UPDATE object_missions
        SET assigned_agent = CASE WHEN assigned_agent = ANY(${sessionUserIds}::integer[]) THEN NULL ELSE assigned_agent END,
            assigned_now = CASE WHEN assigned_agent = ANY(${sessionUserIds}::integer[]) THEN false ELSE assigned_now END,
            completed = CASE WHEN assigned_agent = ANY(${sessionUserIds}::integer[]) THEN false ELSE completed END,
            past_assigned_agents = ARRAY(
              SELECT unnest(COALESCE(past_assigned_agents, ARRAY[]::integer[]))
              EXCEPT
              SELECT unnest(${sessionUserIds}::integer[])
            )
        WHERE assigned_agent = ANY(${sessionUserIds}::integer[])
           OR past_assigned_agents && ${sessionUserIds}::integer[]
      `
      
      // Clear all agent intel for session users
      await sql`
        DELETE FROM agent_intel 
        WHERE agent_id = ANY(${sessionUserIds}::integer[])
      `
      
      // Reset session status back to 'draft' and clear timestamps
      await sql`
        UPDATE sessions
        SET status = 'draft',
            started_at = NULL,
            paused_at = NULL,
            ended_at = NULL
        WHERE id = ${sessionId}
      `
      
      return { 
        success: true,
        message: 'Session reset successfully. All missions and intel cleared for participants. Session status reset to draft.'
      }
    } catch (error) {
      console.error('Error resetting session:', error)
      throw error
    }
  },

  // Generate and award random unknown intel to an agent
  async generateRandomIntel(agentId) {
    try {
      // Check if there's an active session and get session users
      const activeSession = await this.getActiveSession()
      if (!activeSession || !activeSession.participant_user_ids || activeSession.participant_user_ids.length === 0) {
        // No active session - return null (no intel generated)
        return null
      }
      
      const sessionUserIds = activeSession.participant_user_ids.map(id => Number(id))
      
      // Get only users in the active session
      const users = await sql`
        SELECT id, firstname, lastname, alias_1, alias_2, team 
        FROM users 
        WHERE ishere = true AND id = ANY(${sessionUserIds}::integer[])
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
  ,

  // Complete a passphrase mission (only receivers can complete)
  async completePassphraseMission(missionId, answer, agentId) {
    try {
      // Get the passphrase mission
      const missionResult = await sql`
        SELECT id, correct_answer, incorrect_answer, assigned_receiver, assigned_sender_1, assigned_sender_2, completed
        FROM passphrase_missions
        WHERE id = ${missionId}
      `

      if (missionResult.length === 0) {
        throw new Error('Mission not found')
      }

      const mission = missionResult[0]

      // Only receivers can complete passphrase missions
      if (mission.assigned_receiver !== agentId) {
        throw new Error('Only the receiver can complete this mission')
      }

      // Check if already completed
      if (mission.completed) {
        throw new Error('Mission already completed')
      }

      // Validate answer (case-insensitive, flexible matching)
      const answerLower = answer?.toLowerCase().trim()
      const correctAnswerLower = mission.correct_answer?.toLowerCase().trim()
      const incorrectAnswerLower = mission.incorrect_answer?.toLowerCase().trim()

      if (!answerLower || !correctAnswerLower) {
        throw new Error('Answer required')
      }

      // Check if answer matches correct or incorrect
      const isCorrect = correctAnswerLower === answerLower ||
                       correctAnswerLower.includes(answerLower) ||
                       answerLower.includes(correctAnswerLower)

      const isIncorrect = incorrectAnswerLower === answerLower ||
                          incorrectAnswerLower.includes(answerLower) ||
                          answerLower.includes(incorrectAnswerLower)

      if (!isCorrect && !isIncorrect) {
        throw new Error('Answer does not match the correct or incorrect option. Try again or talk to your handler.')
      }

      // Mark mission as completed (regardless of whether answer was correct or incorrect)
      await sql`
        UPDATE passphrase_missions
        SET completed = true
        WHERE id = ${missionId}
      `

      // Only generate and award intel if they got the correct answer
      let newIntel = null
      if (isCorrect) {
        newIntel = await this.generateRandomIntel(agentId)
      }

      return { 
        message: isCorrect 
          ? 'Mission completed successfully! You chose the correct answer.'
          : 'Mission failed. You\'ve been tricked! You fell for the false intel.',
        intel: newIntel,
        was_correct: isCorrect
      }
    } catch (error) {
      console.error('Error completing passphrase mission:', error)
      throw error
    }
  }
  ,

  // Complete an object mission
  async completeObjectMission(missionId, answer, agentId) {
    try {
      // Get the object mission
      const missionResult = await sql`
        SELECT id, success_key, assigned_agent, completed
        FROM object_missions
        WHERE id = ${missionId}
      `

      if (missionResult.length === 0) {
        throw new Error('Mission not found')
      }

      const mission = missionResult[0]

      // Check if mission is assigned to this agent
      if (mission.assigned_agent !== agentId) {
        throw new Error('Mission not assigned to you')
      }

      // Check if already completed
      if (mission.completed) {
        throw new Error('Mission already completed')
      }

      // Validate answer (case-insensitive, flexible matching)
      const answerLower = answer?.toLowerCase().trim()
      const correctAnswerLower = mission.success_key?.toLowerCase().trim()

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
      await sql`
        UPDATE object_missions
        SET completed = true,
            assigned_now = false
        WHERE id = ${missionId}
      `

      // Generate and award random intel
      const newIntel = await this.generateRandomIntel(agentId)

      return { 
        message: 'Mission completed successfully',
        intel: newIntel
      }
    } catch (error) {
      console.error('Error completing object mission:', error)
      throw error
    }
  },

  // Admin function to manually complete a book mission (no validation)
  async adminCompleteBookMission(missionId, userId) {
    try {
      // Get the book mission
      const missionResult = await sql`
        SELECT id, assigned_red, assigned_blue, red_completed, blue_completed
        FROM book_missions
        WHERE id = ${missionId}
      `

      if (missionResult.length === 0) {
        throw new Error('Mission not found')
      }

      const mission = missionResult[0]
      const isAssignedRed = mission.assigned_red === userId
      const isAssignedBlue = mission.assigned_blue === userId

      if (!isAssignedRed && !isAssignedBlue) {
        throw new Error('Mission not assigned to this user')
      }

      // Check if already completed for this user
      if ((isAssignedRed && mission.red_completed) || (isAssignedBlue && mission.blue_completed)) {
        throw new Error('Mission already completed')
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
      const newIntel = await this.generateRandomIntel(userId)

      return { 
        success: true,
        message: 'Mission completed successfully',
        intel: newIntel
      }
    } catch (error) {
      console.error('Error admin completing book mission:', error)
      throw error
    }
  },

  // Admin function to manually complete a passphrase mission (no validation)
  async adminCompletePassphraseMission(missionId, userId) {
    try {
      // Get the passphrase mission
      const missionResult = await sql`
        SELECT id, assigned_receiver, assigned_sender_1, assigned_sender_2, completed
        FROM passphrase_missions
        WHERE id = ${missionId}
      `

      if (missionResult.length === 0) {
        throw new Error('Mission not found')
      }

      const mission = missionResult[0]

      // Check if user is involved in this mission
      const isInvolved = mission.assigned_receiver === userId ||
                        mission.assigned_sender_1 === userId ||
                        mission.assigned_sender_2 === userId

      if (!isInvolved) {
        throw new Error('User not involved in this mission')
      }

      // Check if already completed
      if (mission.completed) {
        throw new Error('Mission already completed')
      }

      // Mark mission as completed
      await sql`
        UPDATE passphrase_missions
        SET completed = true
        WHERE id = ${missionId}
      `

      // Only award intel if they were the receiver (passphrase missions only give intel to receivers)
      let newIntel = null
      if (mission.assigned_receiver === userId) {
        // For receivers, we assume they got it correct when admin completes
        newIntel = await this.generateRandomIntel(userId)
      }

      return { 
        success: true,
        message: 'Mission completed successfully',
        intel: newIntel
      }
    } catch (error) {
      console.error('Error admin completing passphrase mission:', error)
      throw error
    }
  },

  // Admin function to manually complete an object mission (no validation)
  async adminCompleteObjectMission(missionId, userId) {
    try {
      // Get the object mission
      const missionResult = await sql`
        SELECT id, assigned_agent, completed
        FROM object_missions
        WHERE id = ${missionId}
      `

      if (missionResult.length === 0) {
        throw new Error('Mission not found')
      }

      const mission = missionResult[0]

      // Check if mission is assigned to this user
      if (mission.assigned_agent !== userId) {
        throw new Error('Mission not assigned to this user')
      }

      // Check if already completed
      if (mission.completed) {
        throw new Error('Mission already completed')
      }

      // Mark mission as completed
      await sql`
        UPDATE object_missions
        SET completed = true,
            assigned_now = false
        WHERE id = ${missionId}
      `

      // Generate and award random intel
      const newIntel = await this.generateRandomIntel(userId)

      return { 
        success: true,
        message: 'Mission completed successfully',
        intel: newIntel
      }
    } catch (error) {
      console.error('Error admin completing object mission:', error)
      throw error
    }
  },

  // Get the last mission assignment timestamp
  async getLastAssignmentTimestamp() {
    try {
      // Query the timestamp - PostgreSQL may return it in server timezone
      const result = await sql`
        SELECT last_assigned_at 
        FROM assignment_timestamp 
        WHERE id = 1
      `;
      
      // console.log('[TIMESTAMP] Query result:', result);
      
      if (result.length === 0) {
        // Table doesn't exist or no row, return null
        // console.log('[TIMESTAMP] No result found, returning null');
        return null;
      }
      
      const timestamp = result[0].last_assigned_at;
      // console.log('[TIMESTAMP] Retrieved timestamp:', timestamp);
      // console.log('[TIMESTAMP] Timestamp type:', typeof timestamp);
      
      // If it's a Date object, the timezone is already baked in
      // getTime() gives us UTC milliseconds, which is what we need
      if (timestamp instanceof Date) {
        // console.log('[TIMESTAMP] Timestamp as Date, getTime():', timestamp.getTime());
        // console.log('[TIMESTAMP] Timestamp ISO string:', timestamp.toISOString());
        // Use getTime() which is timezone-independent (UTC milliseconds since epoch)
        return timestamp;
      }
      
      // Otherwise parse it
      const timestampDate = new Date(timestamp);
      // console.log('[TIMESTAMP] Parsed as Date:', timestampDate.toISOString());
      
      return timestampDate;
    } catch (error) {
      // console.error('[TIMESTAMP] Error getting last assignment timestamp:', error);
      // If table doesn't exist, return null
      return null;
    }
  },

  // Update the last mission assignment timestamp
  async updateAssignmentTimestamp() {
    try {
      // Store the current UTC time as a string to avoid timezone conversion
      // Use to_timestamp to explicitly create a UTC timestamp
      const nowUTC = new Date().toISOString();
      // console.log('[TIMESTAMP] Updating assignment timestamp to:', nowUTC);
      
      await sql`
        INSERT INTO assignment_timestamp (id, last_assigned_at)
        VALUES (1, ${nowUTC}::timestamptz AT TIME ZONE 'UTC')
        ON CONFLICT (id) 
        DO UPDATE SET last_assigned_at = ${nowUTC}::timestamptz AT TIME ZONE 'UTC'
      `;
      
      // console.log('[TIMESTAMP] Updated assignment timestamp to UTC');
      return true;
    } catch (error) {
      // console.error('[TIMESTAMP] Error updating assignment timestamp:', error);
      // Try simpler fallback
      try {
        await sql`
          INSERT INTO assignment_timestamp (id, last_assigned_at)
          VALUES (1, NOW())
          ON CONFLICT (id) 
          DO UPDATE SET last_assigned_at = NOW()
        `;
        // console.log('[TIMESTAMP] Updated using fallback (NOW())');
        return true;
      } catch (fallbackError) {
        // console.error('[TIMESTAMP] Fallback also failed:', fallbackError);
        throw error;
      }
    }
  },

  // Check if missions should be reassigned (1 minute for testing, normally 15 minutes)
  async shouldReassignMissions() {
    try {
      // Check if there's an active session - missions can only be reassigned during active sessions
      const activeSession = await this.getActiveSession()
      if (!activeSession) {
        return false
      }
      
      // IMPORTANT: Check if missions are currently being updated FIRST
      // This prevents race conditions where multiple tabs all try to reassign
      const statusResult = await sql`
        SELECT currently_updating, last_assigned_at
        FROM assignment_timestamp 
        WHERE id = 1
      `
      
      // If lock is held, definitely don't reassign
      if (statusResult.length > 0 && statusResult[0].currently_updating === true) {
        return false
      }
      
      // Add cooldown period: if reassignment happened within last 5 seconds, don't reassign
      // This prevents rapid-fire reassignments when multiple tabs check simultaneously
      if (statusResult.length > 0 && statusResult[0].last_assigned_at) {
        const lastAssigned = statusResult[0].last_assigned_at
        const now = new Date()
        const lastAssignedDate = lastAssigned instanceof Date ? lastAssigned : new Date(lastAssigned)
        const diffMs = now.getTime() - lastAssignedDate.getTime()
        const diffSeconds = diffMs / 1000
        
        // If reassignment happened within last 5 seconds, don't reassign (cooldown period)
        if (diffSeconds < 5) {
          return false
        }
      }
      
      const lastAssigned = await this.getLastAssignmentTimestamp();
      
      if (!lastAssigned) {
        // No timestamp exists, should assign
        return true;
      }
      
      // Get current time in UTC
      const now = new Date();
      const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 
                                         now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), 
                                         now.getUTCMilliseconds()));
      
      // Parse the timestamp and convert to UTC
      let lastAssignedDate;
      if (lastAssigned instanceof Date) {
        lastAssignedDate = lastAssigned;
      } else if (typeof lastAssigned === 'string') {
        lastAssignedDate = new Date(lastAssigned);
      } else {
        lastAssignedDate = new Date(lastAssigned);
      }
      
      // Use getTime() for accurate millisecond comparison (timezone-independent)
      const diffMs = now.getTime() - lastAssignedDate.getTime();
      let diffMinutes = diffMs / (1000 * 60);
      
      // Handle negative differences (timezone issues)
      if (diffMs < 0 && Math.abs(diffMinutes) > 400 && Math.abs(diffMinutes) < 500) {
        const timezoneOffsetMinutes = 480; // PST is UTC-8
        const actualElapsedMs = diffMs + (timezoneOffsetMinutes * 60 * 1000);
        diffMinutes = actualElapsedMs / (1000 * 60);
      } else if (diffMinutes < 0) {
        diffMinutes = Math.abs(diffMinutes);
      }
      
      // Get the refresh interval from the active session (default to 15 minutes if not set)
      const refreshIntervalMinutes = activeSession.mission_refresh_interval_minutes || 15
      
      // Return true if enough minutes have passed based on session's refresh interval
      return diffMinutes >= refreshIntervalMinutes;
    } catch (error) {
      // On error, default to false (don't reassign) to prevent loops
      console.error('[SHOULD-REASSIGN] Error checking if missions should be reassigned:', error);
      return false;
    }
  },

  // Create a new session (draft status - missions not assigned yet)
  async createSession({ name, userIds, createdBy, refreshIntervalMinutes }) {
    try {
      if (!name || !userIds || userIds.length === 0) {
        throw new Error('Session name and at least one user ID required')
      }

      const userIdsArray = userIds.map(id => Number(id))
      const refreshInterval = refreshIntervalMinutes || 15 // Default to 15 minutes
      
      // Create session record in database
      const result = await sql`
        INSERT INTO sessions (name, status, participant_user_ids, created_by, mission_refresh_interval_minutes)
        VALUES (${name.trim()}, 'draft', ${userIdsArray}::integer[], ${createdBy || null}, ${refreshInterval})
        RETURNING *
      `
      
      return {
        success: true,
        session: result[0]
      }
    } catch (error) {
      console.error('Error creating session:', error)
      throw error
    }
  },

  // Update a session (only allowed for draft, paused, or ended sessions)
  async updateSession(sessionId, { name, userIds, refreshIntervalMinutes }) {
    try {
      if (!sessionId) {
        throw new Error('Session ID required')
      }

      // Get the session to check its status
      const session = await sql`
        SELECT * FROM sessions WHERE id = ${sessionId}
      `
      
      if (session.length === 0) {
        throw new Error('Session not found')
      }
      
      const currentStatus = session[0].status
      
      // Only allow editing draft, paused, or ended sessions
      if (currentStatus === 'active') {
        throw new Error('Cannot edit an active session. Pause or end it first.')
      }

      // Validate inputs
      if (name !== undefined && !name?.trim()) {
        throw new Error('Session name cannot be empty')
      }
      
      if (userIds !== undefined && (!Array.isArray(userIds) || userIds.length === 0)) {
        throw new Error('At least one user ID required')
      }

      if (refreshIntervalMinutes !== undefined && (typeof refreshIntervalMinutes !== 'number' || refreshIntervalMinutes < 1)) {
        throw new Error('Refresh interval must be a positive number (minutes)')
      }

      // Build update fields dynamically
      const updateFields = []
      const updateValues = []
      let paramIndex = 1

      if (name !== undefined) {
        updateFields.push(`name = $${paramIndex}`)
        updateValues.push(name.trim())
        paramIndex++
      }

      if (userIds !== undefined) {
        updateFields.push(`participant_user_ids = $${paramIndex}::integer[]`)
        updateValues.push(userIds.map(id => Number(id)))
        paramIndex++
      }

      if (refreshIntervalMinutes !== undefined) {
        updateFields.push(`mission_refresh_interval_minutes = $${paramIndex}`)
        updateValues.push(refreshIntervalMinutes)
        paramIndex++
      }

      if (updateFields.length === 0) {
        throw new Error('At least one field must be provided')
      }

      updateValues.push(sessionId)

      // Use template literal with sql helper
      const updates = updateFields.join(', ')
      
      // Build the SQL query - since we can't use dynamic field names in template literals easily,
      // we'll build it conditionally
      let result
      if (name !== undefined && userIds !== undefined && refreshIntervalMinutes !== undefined) {
        result = await sql`
          UPDATE sessions
          SET name = ${name.trim()}, 
              participant_user_ids = ${userIds.map(id => Number(id))}::integer[],
              mission_refresh_interval_minutes = ${refreshIntervalMinutes}
          WHERE id = ${sessionId}
          RETURNING *
        `
      } else if (name !== undefined && userIds !== undefined) {
        result = await sql`
          UPDATE sessions
          SET name = ${name.trim()}, 
              participant_user_ids = ${userIds.map(id => Number(id))}::integer[]
          WHERE id = ${sessionId}
          RETURNING *
        `
      } else if (name !== undefined && refreshIntervalMinutes !== undefined) {
        result = await sql`
          UPDATE sessions
          SET name = ${name.trim()}, 
              mission_refresh_interval_minutes = ${refreshIntervalMinutes}
          WHERE id = ${sessionId}
          RETURNING *
        `
      } else if (userIds !== undefined && refreshIntervalMinutes !== undefined) {
        result = await sql`
          UPDATE sessions
          SET participant_user_ids = ${userIds.map(id => Number(id))}::integer[],
              mission_refresh_interval_minutes = ${refreshIntervalMinutes}
          WHERE id = ${sessionId}
          RETURNING *
        `
      } else if (name !== undefined) {
        result = await sql`
          UPDATE sessions
          SET name = ${name.trim()}
          WHERE id = ${sessionId}
          RETURNING *
        `
      } else if (userIds !== undefined) {
        result = await sql`
          UPDATE sessions
          SET participant_user_ids = ${userIds.map(id => Number(id))}::integer[]
          WHERE id = ${sessionId}
          RETURNING *
        `
      } else if (refreshIntervalMinutes !== undefined) {
        result = await sql`
          UPDATE sessions
          SET mission_refresh_interval_minutes = ${refreshIntervalMinutes}
          WHERE id = ${sessionId}
          RETURNING *
        `
      }

      return {
        success: true,
        session: result[0]
      }
    } catch (error) {
      console.error('Error updating session:', error)
      throw error
    }
  },

  // Open voting for a session
  async openVoting(sessionId) {
    try {
      if (!sessionId) {
        throw new Error('Session ID required')
      }

      // Check if session exists
      const session = await sql`
        SELECT * FROM sessions WHERE id = ${sessionId}
      `
      
      if (session.length === 0) {
        throw new Error('Session not found')
      }

      // Update voting_open to true
      const result = await sql`
        UPDATE sessions
        SET voting_open = true
        WHERE id = ${sessionId}
        RETURNING *
      `

      return {
        success: true,
        session: result[0]
      }
    } catch (error) {
      console.error('Error opening voting:', error)
      throw error
    }
  },

  // Close voting for a session
  async closeVoting(sessionId) {
    try {
      if (!sessionId) {
        throw new Error('Session ID required')
      }

      // Check if session exists
      const session = await sql`
        SELECT * FROM sessions WHERE id = ${sessionId}
      `
      
      if (session.length === 0) {
        throw new Error('Session not found')
      }

      // Update voting_open to false
      const result = await sql`
        UPDATE sessions
        SET voting_open = false
        WHERE id = ${sessionId}
        RETURNING *
      `

      return {
        success: true,
        session: result[0]
      }
    } catch (error) {
      console.error('Error closing voting:', error)
      throw error
    }
  },

  // Get user score
  async getUserScore(userId) {
    try {
      const result = await sql`
        SELECT COALESCE(score, 0) as score FROM users WHERE id = ${userId}
      `
      return result[0]?.score || 0
    } catch (error) {
      console.error('Error fetching user score:', error)
      throw error
    }
  },

  // Check if user has already submitted intel (for current voting period)
  async hasSubmittedIntel(agentId) {
    try {
      const activeSession = await this.getActiveSession()
      if (!activeSession || !activeSession.voting_open) {
        return false
      }

      // If voting is open, check if they have a score set
      // We'll use a simple check: if voting is open and they have submitted,
      // we track it via checking their score
      // For now, we'll check if their score is set (including 0)
      const score = await this.getUserScore(agentId)
      // If voting is open and they previously submitted, their score would be set
      // We'll use localStorage to track submission per session to be more reliable
      return false // This will be handled client-side with localStorage
    } catch (error) {
      console.error('Error checking submission status:', error)
      return false
    }
  },

  // Submit intel and calculate score
  // guesses format: { userId: { aliases: [alias1, alias2], team: 'red'|'blue'|'unknown' } }
  async submitIntel(agentId, guesses) {
    try {
      if (!agentId) {
        throw new Error('Agent ID required')
      }

      // Check if voting is open
      const activeSession = await this.getActiveSession()
      if (!activeSession || !activeSession.voting_open) {
        throw new Error('Voting is not currently open')
      }

      // Check if agent is in the session
      if (!activeSession.participant_user_ids.includes(agentId)) {
        throw new Error('You are not in the active session')
      }

      // Get all users in the session
      const sessionUserIds = new Set(activeSession.participant_user_ids.map(id => Number(id)))
      const allUsers = await this.getUsers()
      const sessionUsers = allUsers.filter(user => sessionUserIds.has(user.id))
      
      // Calculate score changes
      let totalScoreChange = 0
      const scoreDetails = []

      // Process each user guess
      for (const [userIdStr, guess] of Object.entries(guesses)) {
        const userId = Number(userIdStr)
        const actualUser = sessionUsers.find(u => u.id === userId)
        
        if (!actualUser) {
          continue // Skip if user not in session
        }

        // Check alias guesses (position 0 and 1)
        if (guess.aliases && Array.isArray(guess.aliases)) {
          // Position 0 (first alias)
          const alias0 = guess.aliases[0]
          if (alias0 !== null && alias0 !== undefined && alias0 !== '') {
            const isCorrect = alias0.trim().toLowerCase() === actualUser.alias_1.trim().toLowerCase()
            if (isCorrect) {
              totalScoreChange += 1
              scoreDetails.push({ userId, type: 'alias', position: 0, correct: true, points: 1 })
            } else {
              // No penalty for incorrect alias guesses - just track for UI feedback
              scoreDetails.push({ userId, type: 'alias', position: 0, correct: false, points: 0 })
            }
          }

          // Position 1 (second alias)
          const alias1 = guess.aliases[1]
          if (alias1 !== null && alias1 !== undefined && alias1 !== '') {
            const isCorrect = alias1.trim().toLowerCase() === actualUser.alias_2.trim().toLowerCase()
            if (isCorrect) {
              totalScoreChange += 1
              scoreDetails.push({ userId, type: 'alias', position: 1, correct: true, points: 1 })
            } else {
              // No penalty for incorrect alias guesses - just track for UI feedback
              scoreDetails.push({ userId, type: 'alias', position: 1, correct: false, points: 0 })
            }
          }
        }

        // Check team guess
        if (guess.team && guess.team !== 'unknown') {
          const isCorrect = guess.team === actualUser.team
          if (isCorrect) {
            totalScoreChange += 3
            scoreDetails.push({ userId, type: 'team', correct: true, points: 3 })
          } else {
            totalScoreChange -= 3
            scoreDetails.push({ userId, type: 'team', correct: false, points: -3 })
          }
        }
      }

      // Update agent's score
      const currentUser = sessionUsers.find(u => u.id === agentId)
      if (!currentUser) {
        throw new Error('Agent not found in session')
      }

      // Reset score to 0, then apply score changes
      // Score is not additive - it's calculated fresh each time
      const newScore = totalScoreChange

      // Update score
      await sql`
        UPDATE users 
        SET score = ${newScore}
        WHERE id = ${agentId}
      `

      return {
        success: true,
        scoreChange: totalScoreChange,
        newScore: newScore,
        details: scoreDetails,
        message: `Score: ${newScore} points (${totalScoreChange >= 0 ? '+' : ''}${totalScoreChange})`
      }
    } catch (error) {
      console.error('Error submitting intel:', error)
      throw error
    }
  },

  // Get all sessions
  async getAllSessions() {
    try {
      const sessions = await sql`
        SELECT * FROM sessions ORDER BY created_at DESC
      `
      return sessions
    } catch (error) {
      console.error('Error fetching sessions:', error)
      throw error
    }
  },

  // Get active session
  async getActiveSession() {
    try {
      const result = await sql`
        SELECT * FROM sessions WHERE status = 'active' LIMIT 1
      `
      return result.length > 0 ? result[0] : null
    } catch (error) {
      console.error('Error fetching active session:', error)
      throw error
    }
  },

  // Start a session (changes status to active and assigns missions)
  async startSession(sessionId) {
    try {
      // Check if session exists and is in draft status
      const session = await sql`
        SELECT * FROM sessions WHERE id = ${sessionId}
      `
      
      if (session.length === 0) {
        throw new Error('Session not found')
      }
      
      if (session[0].status !== 'draft') {
        throw new Error(`Session is already ${session[0].status}`)
      }

      // Check if there's already an active session
      const activeSession = await this.getActiveSession()
      if (activeSession) {
        throw new Error('There is already an active session. End it before starting a new one.')
      }

      const userIdsArray = session[0].participant_user_ids
      
      // First, clear missions for users NOT in this session
      await this.clearMissionsForNonSessionUsers()
      
      // Update session status to active and set started_at
      await sql`
        UPDATE sessions
        SET status = 'active', started_at = NOW()
        WHERE id = ${sessionId}
      `

      // Now assign missions to the selected users
      await this.assignMissionsToSessionUsers(userIdsArray)
      
      // Get updated session
      const updatedSession = await sql`
        SELECT * FROM sessions WHERE id = ${sessionId}
      `
      
      return {
        success: true,
        session: updatedSession[0]
      }
    } catch (error) {
      console.error('Error starting session:', error)
      throw error
    }
  },


  // Pause a session
  async pauseSession(sessionId) {
    try {
      const session = await sql`
        SELECT * FROM sessions WHERE id = ${sessionId}
      `
      
      if (session.length === 0) {
        throw new Error('Session not found')
      }
      
      if (session[0].status !== 'active') {
        throw new Error(`Session is not active (current status: ${session[0].status})`)
      }

      await sql`
        UPDATE sessions
        SET status = 'paused', paused_at = NOW()
        WHERE id = ${sessionId}
      `
      
      return { success: true }
    } catch (error) {
      console.error('Error pausing session:', error)
      throw error
    }
  },

  // Resume a paused session
  async resumeSession(sessionId) {
    try {
      const session = await sql`
        SELECT * FROM sessions WHERE id = ${sessionId}
      `
      
      if (session.length === 0) {
        throw new Error('Session not found')
      }
      
      if (session[0].status !== 'paused') {
        throw new Error(`Session is not paused (current status: ${session[0].status})`)
      }

      await sql`
        UPDATE sessions
        SET status = 'active', paused_at = NULL
        WHERE id = ${sessionId}
      `
      
      return { success: true }
    } catch (error) {
      console.error('Error resuming session:', error)
      throw error
    }
  },

  // Clear missions for users not in the active session
  async clearMissionsForNonSessionUsers() {
    try {
      const activeSession = await this.getActiveSession()
      
      if (!activeSession) {
        // No active session - clear missions for all users
        await sql`
          UPDATE book_missions
          SET assigned_red = NULL,
              assigned_blue = NULL,
              previous_reds = ARRAY[]::integer[],
              previous_blues = ARRAY[]::integer[],
              red_completed = false,
              blue_completed = false
        `
        
        await sql`
          UPDATE passphrase_missions
          SET assigned_receiver = NULL,
              assigned_sender_1 = NULL,
              assigned_sender_2 = NULL,
              previous_receivers = ARRAY[]::integer[],
              previous_senders = ARRAY[]::integer[],
              completed = false
        `
        
        await sql`
          UPDATE object_missions
          SET assigned_agent = NULL,
              past_assigned_agents = ARRAY[]::integer[],
              assigned_now = false,
              completed = false
        `
        
        return { success: true, cleared: 'all' }
      }
      
      // Clear missions for users NOT in the active session
      const sessionUserIds = activeSession.participant_user_ids || []
      const allUsers = (await sql`SELECT id FROM users WHERE ishere = true`).map(u => u.id)
      const nonSessionUsers = allUsers.filter(id => !sessionUserIds.includes(id))
      
      if (nonSessionUsers.length === 0) {
        return { success: true, cleared: 'none' }
      }
      
      // Clear book missions
      await sql`
        UPDATE book_missions
        SET assigned_red = CASE WHEN assigned_red = ANY(${nonSessionUsers}::integer[]) THEN NULL ELSE assigned_red END,
            assigned_blue = CASE WHEN assigned_blue = ANY(${nonSessionUsers}::integer[]) THEN NULL ELSE assigned_blue END,
            previous_reds = array(SELECT unnest(previous_reds) EXCEPT SELECT unnest(${nonSessionUsers}::integer[])),
            previous_blues = array(SELECT unnest(previous_blues) EXCEPT SELECT unnest(${nonSessionUsers}::integer[]))
        WHERE assigned_red = ANY(${nonSessionUsers}::integer[]) OR assigned_blue = ANY(${nonSessionUsers}::integer[])
      `
      
      // Clear passphrase missions
      await sql`
        UPDATE passphrase_missions
        SET assigned_receiver = CASE WHEN assigned_receiver = ANY(${nonSessionUsers}::integer[]) THEN NULL ELSE assigned_receiver END,
            assigned_sender_1 = CASE WHEN assigned_sender_1 = ANY(${nonSessionUsers}::integer[]) THEN NULL ELSE assigned_sender_1 END,
            assigned_sender_2 = CASE WHEN assigned_sender_2 = ANY(${nonSessionUsers}::integer[]) THEN NULL ELSE assigned_sender_2 END,
            previous_receivers = array(SELECT unnest(previous_receivers) EXCEPT SELECT unnest(${nonSessionUsers}::integer[])),
            previous_senders = array(SELECT unnest(previous_senders) EXCEPT SELECT unnest(${nonSessionUsers}::integer[]))
        WHERE assigned_receiver = ANY(${nonSessionUsers}::integer[]) 
           OR assigned_sender_1 = ANY(${nonSessionUsers}::integer[])
           OR assigned_sender_2 = ANY(${nonSessionUsers}::integer[])
      `
      
      // Clear object missions
      await sql`
        UPDATE object_missions
        SET assigned_agent = CASE WHEN assigned_agent = ANY(${nonSessionUsers}::integer[]) THEN NULL ELSE assigned_agent END,
            past_assigned_agents = array(SELECT unnest(past_assigned_agents) EXCEPT SELECT unnest(${nonSessionUsers}::integer[])),
            assigned_now = CASE WHEN assigned_agent = ANY(${nonSessionUsers}::integer[]) THEN false ELSE assigned_now END
        WHERE assigned_agent = ANY(${nonSessionUsers}::integer[])
      `
      
      return { success: true, cleared: nonSessionUsers.length }
    } catch (error) {
      console.error('Error clearing missions for non-session users:', error)
      throw error
    }
  },

  // End a session
  async endSession(sessionId) {
    try {
      const session = await sql`
        SELECT * FROM sessions WHERE id = ${sessionId}
      `
      
      if (session.length === 0) {
        throw new Error('Session not found')
      }
      
      if (session[0].status === 'ended') {
        throw new Error('Session is already ended')
      }

      // Update session status to ended
      await sql`
        UPDATE sessions
        SET status = 'ended', ended_at = NOW()
        WHERE id = ${sessionId}
      `
      
      // Clear missions for all users (no active session exists now)
      await this.clearMissionsForNonSessionUsers()
      
      return { success: true }
    } catch (error) {
      console.error('Error ending session:', error)
      throw error
    }
  },

  // Check if missions can be assigned (only if there's an active session)
  async canAssignMissions() {
    try {
      const activeSession = await this.getActiveSession()
      return activeSession !== null
    } catch (error) {
      console.error('Error checking if missions can be assigned:', error)
      return false
    }
  }
};

