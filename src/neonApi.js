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

  // Reset all missions (book, passphrase, and object) and assign until each user has 3 missions total
  async resetAndAssignAllMissions() {
    try {
      // Reset book missions
      await sql`
        UPDATE book_missions
        SET assigned_red = NULL,
            assigned_blue = NULL,
            previous_reds = ARRAY[]::integer[],
            previous_blues = ARRAY[]::integer[],
            red_completed = false,
            blue_completed = false
      `
      
      // Reset passphrase missions - reset all missions regardless of completion status
      await sql`
        UPDATE passphrase_missions
        SET assigned_receiver = NULL,
            assigned_sender_1 = NULL,
            assigned_sender_2 = NULL,
            previous_receivers = ARRAY[]::integer[],
            previous_senders = ARRAY[]::integer[],
            completed = false
      `
      
      // Reset object missions - reset all missions regardless of completion status
      await sql`
        UPDATE object_missions
        SET assigned_agent = NULL,
            past_assigned_agents = ARRAY[]::integer[],
            assigned_now = false,
            completed = false
      `
      
      // Get all users who are present
      const users = await sql`SELECT id, team FROM users WHERE ishere = true ORDER BY id`
      
      if (users.length === 0) {
        return { assigned: 0, reason: 'No users available' }
      }
      
      // Track mission counts per user (total across all types, max 3)
      const missionCounts = new Map()
      const missionTypesByUser = new Map() // { userId: ['book', 'passphrase', 'object', ...] }
      users.forEach(user => {
        missionCounts.set(user.id, 0)
        missionTypesByUser.set(user.id, [])
      })
      
      // Helper function to pick random element
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
      
      // Helper function to determine which mission type user needs
      // Ensures: exactly 3 missions, at least 2 different types
      const getNeededMissionType = (userId) => {
        const userMissions = missionTypesByUser.get(userId) || []
        const uniqueTypes = new Set(userMissions)
        const bookCount = userMissions.filter(t => t === 'book').length
        const passphraseCount = userMissions.filter(t => t === 'passphrase').length
        const objectCount = userMissions.filter(t => t === 'object').length
        
        if (userMissions.length === 0) {
          // First mission: any type
          const types = ['book', 'passphrase', 'object']
          return types[Math.floor(Math.random() * types.length)]
        } else if (userMissions.length === 1) {
          // Second mission: MUST be a different type to ensure at least 2 types
          const usedType = userMissions[0]
          if (usedType === 'book') {
            return Math.random() < 0.5 ? 'passphrase' : 'object'
          } else if (usedType === 'passphrase') {
            return Math.random() < 0.5 ? 'book' : 'object'
          } else {
            return Math.random() < 0.5 ? 'book' : 'passphrase'
          }
        } else if (userMissions.length === 2) {
          // Third mission: if they already have 2 different types, any type is fine
          // If they have 2 of the same type, MUST get a different type
          if (uniqueTypes.size === 1) {
            // They have 2 of the same type, need a different one
            const currentType = userMissions[0]
            if (currentType === 'book') {
              return Math.random() < 0.5 ? 'passphrase' : 'object'
            } else if (currentType === 'passphrase') {
              return Math.random() < 0.5 ? 'book' : 'object'
            } else {
              return Math.random() < 0.5 ? 'book' : 'passphrase'
            }
          } else {
            // They already have 2 different types, third can be any
            const allTypes = ['book', 'passphrase', 'object']
            return allTypes[Math.floor(Math.random() * allTypes.length)]
          }
        }
        return null // User has 3 missions already
      }
      
      // Helper to check if user needs a specific type to meet requirements
      const needsTypeForDiversity = (userId, type) => {
        const userMissions = missionTypesByUser.get(userId) || []
        const uniqueTypes = new Set(userMissions)
        
        // If user has less than 2 missions, they need different types
        if (userMissions.length < 2) {
          return !userMissions.includes(type)
        }
        
        // If user has 2 missions of the same type, they need a different type
        if (userMissions.length === 2 && uniqueTypes.size === 1) {
          return !userMissions.includes(type)
        }
        
        // Otherwise any type is fine
        return true
      }
      
      // Get available missions (excluding completed ones)
      const getAvailableMissions = async () => {
        const bookResult = await sql`SELECT * FROM book_missions WHERE (assigned_red IS NULL OR assigned_blue IS NULL) AND (red_completed = false AND blue_completed = false)`
        const passphraseResult = await sql`SELECT * FROM passphrase_missions WHERE assigned_receiver IS NULL AND assigned_sender_1 IS NULL AND assigned_sender_2 IS NULL AND completed = false`
        const objectResult = await sql`SELECT * FROM object_missions WHERE assigned_agent IS NULL AND completed = false`
        return {
          book: bookResult,
          passphrase: passphraseResult,
          object: objectResult
        }
      }
      
      // Helper to get available users for assignment
      const getAvailableUsers = (excludeIds = []) => {
        return users.filter(u => 
          !excludeIds.includes(u.id) && 
          (missionCounts.get(u.id) || 0) < 3
        )
      }
      
      let iterations = 0
      const maxIterations = users.length * 10 // Safety limit
      let availableMissions = await getAvailableMissions()
      
      // Main assignment loop - iterate until all users have exactly 3 missions
      while (iterations < maxIterations) {
        iterations++
        
        // Find users who still need missions, prioritize those with fewer missions
        const usersNeedingMissions = users
          .filter(u => (missionCounts.get(u.id) || 0) < 3)
          .sort((a, b) => {
            const countA = missionCounts.get(a.id) || 0
            const countB = missionCounts.get(b.id) || 0
            // Prioritize users with fewer missions
            return countA - countB
          })
        
        if (usersNeedingMissions.length === 0) {
          break // All users have 3 missions
        }
        
        // Refresh available missions periodically
        if (iterations % 10 === 0) {
          availableMissions = await getAvailableMissions()
        }
        
        // Try to assign a mission - prioritize users with fewer missions
        const user = usersNeedingMissions[0] // Start with user who needs most missions
        const neededType = getNeededMissionType(user.id)
        
        let assigned = false
        
        // Prioritize the needed type, but consider available missions
        let missionTypeToTry = null
        
        // Check what types are actually available and needed
        const availableTypes = []
        if (neededType === 'book' && availableMissions.book.length > 0 && needsTypeForDiversity(user.id, 'book')) {
          availableTypes.push('book')
        }
        if (neededType === 'passphrase' && availableMissions.passphrase.length > 0 && needsTypeForDiversity(user.id, 'passphrase')) {
          availableTypes.push('passphrase')
        }
        if (neededType === 'object' && availableMissions.object.length > 0 && needsTypeForDiversity(user.id, 'object')) {
          availableTypes.push('object')
        }
        
        // If preferred type isn't available, try alternatives that meet diversity requirements
        if (availableTypes.length === 0) {
          if (availableMissions.book.length > 0 && needsTypeForDiversity(user.id, 'book')) {
            availableTypes.push('book')
          }
          if (availableMissions.passphrase.length > 0 && needsTypeForDiversity(user.id, 'passphrase')) {
            availableTypes.push('passphrase')
          }
          if (availableMissions.object.length > 0 && needsTypeForDiversity(user.id, 'object')) {
            availableTypes.push('object')
          }
        }
        
        if (availableTypes.length > 0) {
          // Prefer the needed type, but randomly pick from available if it's not in the list
          if (availableTypes.includes(neededType)) {
            missionTypeToTry = neededType
          } else {
            missionTypeToTry = pick(availableTypes)
          }
        } else {
          missionTypeToTry = null // No available missions
        }
        
        // Try to assign book mission
        if (missionTypeToTry === 'book' && availableMissions.book.length > 0) {
          // Filter out missions user has had before
          const eligibleBookMissions = availableMissions.book.filter(m => {
            const prevReds = Array.isArray(m.previous_reds) ? m.previous_reds : []
            const prevBlues = Array.isArray(m.previous_blues) ? m.previous_blues : []
            const userHadBefore = (user.team === 'red' && prevReds.includes(user.id)) || 
                                  (user.team === 'blue' && prevBlues.includes(user.id))
            return !userHadBefore && !m.red_completed && !m.blue_completed
          })
          
          // Find a book mission for this user's team
          let bookMission = eligibleBookMissions.find(m => {
            if (user.team === 'red' && m.assigned_red === null) return true
            if (user.team === 'blue' && m.assigned_blue === null) return true
            return false
          })
          
          // If no team-specific match, find any book mission needing assignment
          if (!bookMission) {
            bookMission = eligibleBookMissions.find(m => 
              m.assigned_red === null || m.assigned_blue === null
            )
          }
          
          if (bookMission) {
            // Verify mission is still available and not completed before assigning
            const verifyMission = await sql`
              SELECT id, assigned_red, assigned_blue, red_completed, blue_completed
              FROM book_missions
              WHERE id = ${bookMission.id}
                AND (assigned_red IS NULL OR assigned_blue IS NULL)
                AND red_completed = false
                AND blue_completed = false
            `
            
            if (verifyMission.length === 0) {
              // Mission was completed or assigned, skip it
              availableMissions.book = availableMissions.book.filter(m => m.id !== bookMission.id)
              continue
            }
            
            // Find a partner for the opposite team
            const oppositeTeam = user.team === 'red' ? 'blue' : 'red'
            const availableOppositeTeam = getAvailableUsers([user.id]).filter(u => u.team === oppositeTeam)
            
            if (availableOppositeTeam.length > 0) {
              const partner = pick(availableOppositeTeam)
              
              // Assign both users - verify not completed before updating
              let updateSuccess = false
              if (user.team === 'red') {
                const updateResult = await sql`
                  UPDATE book_missions 
                  SET assigned_red = ${user.id}, 
                      previous_reds = array_append(COALESCE(previous_reds, ARRAY[]::integer[]), ${user.id}),
                      assigned_blue = ${partner.id}, 
                      previous_blues = array_append(COALESCE(previous_blues, ARRAY[]::integer[]), ${partner.id})
                  WHERE id = ${bookMission.id}
                    AND assigned_red IS NULL
                    AND red_completed = false
                    AND blue_completed = false
                  RETURNING id
                `
                updateSuccess = updateResult.length > 0
              } else {
                const updateResult = await sql`
                  UPDATE book_missions 
                  SET assigned_blue = ${user.id}, 
                      previous_blues = array_append(COALESCE(previous_blues, ARRAY[]::integer[]), ${user.id}),
                      assigned_red = ${partner.id}, 
                      previous_reds = array_append(COALESCE(previous_reds, ARRAY[]::integer[]), ${partner.id})
                  WHERE id = ${bookMission.id}
                    AND assigned_blue IS NULL
                    AND red_completed = false
                    AND blue_completed = false
                  RETURNING id
                `
                updateSuccess = updateResult.length > 0
              }
              
              if (updateSuccess) {
                missionCounts.set(user.id, (missionCounts.get(user.id) || 0) + 1)
                missionCounts.set(partner.id, (missionCounts.get(partner.id) || 0) + 1)
                missionTypesByUser.get(user.id).push('book')
                missionTypesByUser.get(partner.id).push('book')
                
                // Remove from available
                availableMissions.book = availableMissions.book.filter(m => m.id !== bookMission.id)
                assigned = true
              } else {
                // Mission was completed or assigned while we were trying to assign, skip it
                availableMissions.book = availableMissions.book.filter(m => m.id !== bookMission.id)
              }
            }
          }
        }
        
        // Try to assign passphrase mission
        if ((missionTypeToTry === 'passphrase' || !assigned) && availableMissions.passphrase.length > 0) {
          // Filter out missions user has had before
          const eligiblePassphraseMissions = availableMissions.passphrase.filter(m => {
            const prevReceivers = Array.isArray(m.previous_receivers) ? m.previous_receivers : []
            const prevSenders = Array.isArray(m.previous_senders) ? m.previous_senders : []
            const userHadBefore = prevReceivers.includes(user.id) || prevSenders.includes(user.id)
            return !userHadBefore && !m.completed
          })
          
          if (eligiblePassphraseMissions.length > 0) {
            const passphraseMission = eligiblePassphraseMissions[0]
            
            // Verify mission is still available and not completed before assigning
            const verifyPassphrase = await sql`
              SELECT id, assigned_receiver, assigned_sender_1, assigned_sender_2, completed
              FROM passphrase_missions
              WHERE id = ${passphraseMission.id}
                AND assigned_receiver IS NULL
                AND assigned_sender_1 IS NULL
                AND assigned_sender_2 IS NULL
                AND completed = false
            `
            
            if (verifyPassphrase.length === 0) {
              // Mission was completed or assigned, skip it
              availableMissions.passphrase = availableMissions.passphrase.filter(m => m.id !== passphraseMission.id)
              continue
            }
            
            const availableForSenders = getAvailableUsers([user.id])
            
            if (availableForSenders.length >= 2) {
              const sender1 = pick(availableForSenders)
              const remainingAfterSender1 = availableForSenders.filter(u => u.id !== sender1.id)
              const sender2 = pick(remainingAfterSender1)
              
              const updateResult = await sql`
                UPDATE passphrase_missions 
                SET assigned_receiver = ${user.id}, 
                    assigned_sender_1 = ${sender1.id},
                    assigned_sender_2 = ${sender2.id},
                    previous_receivers = array_append(COALESCE(previous_receivers, ARRAY[]::integer[]), ${user.id}),
                    previous_senders = array_append(array_append(COALESCE(previous_senders, ARRAY[]::integer[]), ${sender1.id}), ${sender2.id})
                WHERE id = ${passphraseMission.id}
                  AND assigned_receiver IS NULL
                  AND assigned_sender_1 IS NULL
                  AND assigned_sender_2 IS NULL
                  AND completed = false
                RETURNING id
              `
              
              if (updateResult.length > 0) {
                missionCounts.set(user.id, (missionCounts.get(user.id) || 0) + 1)
                missionCounts.set(sender1.id, (missionCounts.get(sender1.id) || 0) + 1)
                missionCounts.set(sender2.id, (missionCounts.get(sender2.id) || 0) + 1)
                
                missionTypesByUser.get(user.id).push('passphrase')
                missionTypesByUser.get(sender1.id).push('passphrase')
                missionTypesByUser.get(sender2.id).push('passphrase')
                
                availableMissions.passphrase = availableMissions.passphrase.filter(m => m.id !== passphraseMission.id)
                assigned = true
              } else {
                // Mission was completed or assigned while we were trying to assign, skip it
                availableMissions.passphrase = availableMissions.passphrase.filter(m => m.id !== passphraseMission.id)
              }
            }
          }
        }
        
        // Try to assign object mission
        if ((missionTypeToTry === 'object' || !assigned) && availableMissions.object.length > 0) {
          // Filter out missions user has had before and that are completed
          const eligibleObjectMissions = availableMissions.object.filter(m => {
            const pastAssigned = Array.isArray(m.past_assigned_agents) ? m.past_assigned_agents : []
            return !pastAssigned.includes(user.id) && !m.completed
          })
          
          if (eligibleObjectMissions.length > 0) {
            const objectMission = pick(eligibleObjectMissions)
            
            // Verify mission is still available and not completed before assigning
            const verifyObject = await sql`
              SELECT id, assigned_agent, completed
              FROM object_missions
              WHERE id = ${objectMission.id}
                AND assigned_agent IS NULL
                AND completed = false
            `
            
            if (verifyObject.length === 0) {
              // Mission was completed or assigned, skip it
              availableMissions.object = availableMissions.object.filter(m => m.id !== objectMission.id)
              continue
            }
            
            const updateResult = await sql`
              UPDATE object_missions 
              SET assigned_agent = ${user.id},
                  past_assigned_agents = array_append(COALESCE(past_assigned_agents, ARRAY[]::integer[]), ${user.id}),
                  assigned_now = true
              WHERE id = ${objectMission.id}
                AND assigned_agent IS NULL
                AND completed = false
              RETURNING id
            `
            
            if (updateResult.length > 0) {
              missionCounts.set(user.id, (missionCounts.get(user.id) || 0) + 1)
              missionTypesByUser.get(user.id).push('object')
              
              availableMissions.object = availableMissions.object.filter(m => m.id !== objectMission.id)
              assigned = true
            } else {
              // Mission was completed or assigned while we were trying to assign, skip it
              availableMissions.object = availableMissions.object.filter(m => m.id !== objectMission.id)
            }
          }
        }
        
        // If no assignment was made this iteration, try next user
        if (!assigned) {
          // If we've tried all users and no assignments, check if we're stuck
          if (usersNeedingMissions.length > 0) {
            // Try cycling through users instead of breaking
            continue
          }
        }
        
        // If we can't make progress and all missions are exhausted, break
        if (!assigned && (availableMissions.book.length === 0 && availableMissions.passphrase.length === 0 && availableMissions.object.length === 0)) {
          console.log('No more missions available and no assignments made')
          break
        }
      }
      
      // Check final status
      const usersWith3Missions = users.filter(u => (missionCounts.get(u.id) || 0) === 3)
      const usersWithFewerMissions = users.filter(u => (missionCounts.get(u.id) || 0) < 3)
      
      console.log(`Assignment complete: ${usersWith3Missions.length}/${users.length} users have 3 missions`)
      if (usersWithFewerMissions.length > 0) {
        console.log(`Warning: ${usersWithFewerMissions.length} users have fewer than 3 missions`)
      }
      
      // Update the assignment timestamp after successful assignment
      await this.updateAssignmentTimestamp();
      
      return { 
        assigned: Array.from(missionCounts.values()).reduce((sum, count) => sum + count, 0),
        users_assigned: users.length,
        users_with_3_missions: usersWith3Missions.length,
        total_users: users.length
      }
    } catch (error) {
      console.error('Error resetting and assigning all missions (Neon):', error)
      throw error
    }
  }
  ,

  // Get passphrase missions for a specific agent
  async getPassphraseMissionsForAgent(agentId) {
    try {
      const rows = await sql`
        SELECT id, passphrase_template, correct_answer, incorrect_answer, assigned_receiver, assigned_sender_1, assigned_sender_2, completed
        FROM passphrase_missions
        WHERE assigned_receiver = ${agentId} OR assigned_sender_1 = ${agentId} OR assigned_sender_2 = ${agentId}
        ORDER BY id
      `
      // Normalize for UI consumption
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
          mission_body: mission_body,
          role: isReceiver ? 'receiver' : (isSender1 ? 'sender1' : 'sender2'),
          correct_answer: r.correct_answer,
          incorrect_answer: r.incorrect_answer,
          completed: r.completed
        }
      })
    } catch (error) {
      console.error('Error fetching passphrase missions for agent:', error)
      throw error
    }
  }
  ,

  // Get object missions for a specific agent
  async getObjectMissionsForAgent(agentId) {
    try {
      const rows = await sql`
        SELECT id, title, mission_body, success_key, completed, assigned_agent
        FROM object_missions
        WHERE assigned_agent = ${agentId} AND completed = false
        ORDER BY id
      `
      // Normalize for UI consumption
      return rows.map(r => ({
        id: r.id,
        type: 'object',
        title: r.title,
        mission_body: r.mission_body,
        success_key: r.success_key,
        completed: r.completed
      }))
    } catch (error) {
      console.error('Error fetching object missions for agent:', error)
      throw error
    }
  }
  ,

  // Get all missions (both book, passphrase, and object) for a specific agent
  async getAllMissionsForAgent(agentId) {
    try {
      const bookMissions = await this.getBookMissionsForAgent(agentId)
      const passphraseMissions = await this.getPassphraseMissionsForAgent(agentId)
      const objectMissions = await this.getObjectMissionsForAgent(agentId)
      
      // Add type field to book missions if not present
      const bookMissionsWithType = bookMissions.map(m => ({
        ...m,
        type: 'book'
      }))
      
      // Combine and return
      return [...bookMissionsWithType, ...passphraseMissions, ...objectMissions]
    } catch (error) {
      console.error('Error fetching all missions for agent:', error)
      throw error
    }
  }
  ,

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
      // console.log('[SHOULD-REASSIGN] Checking last assignment timestamp...');
      const lastAssigned = await this.getLastAssignmentTimestamp();
      
      if (!lastAssigned) {
        // No timestamp exists, should assign
        // console.log('[SHOULD-REASSIGN] No timestamp found, returning true');
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
        // If it's already a Date object, get its UTC time
        // The Date object represents a moment in time, so we can use getTime() for accurate comparison
        lastAssignedDate = lastAssigned;
      } else if (typeof lastAssigned === 'string') {
        // If it's a string, parse it
        lastAssignedDate = new Date(lastAssigned);
      } else {
        // Try to parse as-is
        lastAssignedDate = new Date(lastAssigned);
      }
      
      // console.log('[SHOULD-REASSIGN] Current time (UTC):', nowUTC.toISOString());
      // console.log('[SHOULD-REASSIGN] Last assigned (raw):', lastAssigned);
      // console.log('[SHOULD-REASSIGN] Last assigned (as Date):', lastAssignedDate.toISOString());
      // console.log('[SHOULD-REASSIGN] Current time getTime():', now.getTime());
      // console.log('[SHOULD-REASSIGN] Last assigned getTime():', lastAssignedDate.getTime());
      
      // Use getTime() for accurate millisecond comparison (timezone-independent)
      // getTime() returns milliseconds since epoch in UTC, so it's timezone-independent
      const diffMs = now.getTime() - lastAssignedDate.getTime();
      
      // console.log('[SHOULD-REASSIGN] Difference in milliseconds:', diffMs);
      
      // Handle negative differences (timezone issues)
      // If negative and large absolute value (~8 hours = 480 minutes), it's a timezone issue
      let diffMinutes = diffMs / (1000 * 60);
      
      // If difference is negative and approximately 8 hours (timezone mismatch), adjust it
      // The database stored PST time but it's being interpreted as UTC
      // So if we see ~-480 minutes, the actual elapsed time is very small (near 0)
      if (diffMs < 0 && Math.abs(diffMinutes) > 400 && Math.abs(diffMinutes) < 500) {
        // console.log('[SHOULD-REASSIGN] Negative difference ~8 hours - timezone issue detected');
        // The stored time is actually in PST, so the real elapsed time is much smaller
        // We need to add the offset back: if diff is -480 min, real elapsed is ~0 min (just the seconds difference)
        // Calculate actual elapsed by adding the timezone offset (8 hours = 480 minutes)
        const timezoneOffsetMinutes = 480; // PST is UTC-8
        const actualElapsedMs = diffMs + (timezoneOffsetMinutes * 60 * 1000);
        diffMinutes = actualElapsedMs / (1000 * 60);
        // console.log('[SHOULD-REASSIGN] Adjusted difference in minutes (added 8-hour offset back):', diffMinutes);
      } else if (diffMinutes < 0) {
        // For other negative values, use absolute value (shouldn't happen normally)
        // console.log('[SHOULD-REASSIGN] Negative difference (not timezone offset), using absolute value');
        diffMinutes = Math.abs(diffMinutes);
      }
      
      // console.log('[SHOULD-REASSIGN] Final difference in minutes:', diffMinutes);
      // console.log('[SHOULD-REASSIGN] Threshold (minutes):', 1);
      
      // Normal case: check if enough time has passed
      const shouldReassign = diffMinutes >= 1;
      // console.log('[SHOULD-REASSIGN] Should reassign?', shouldReassign);
      
      // Return true if 1 or more minutes have passed (testing - normally 15)
      return shouldReassign;
    } catch (error) {
      // console.error('[SHOULD-REASSIGN] Error checking if missions should be reassigned:', error);
      // console.error('[SHOULD-REASSIGN] Error stack:', error.stack);
      // On error, default to should reassign
      return true;
    }
  }
};
