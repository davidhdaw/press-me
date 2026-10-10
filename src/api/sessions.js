import { sql } from './db.js';
import { assignPhaseToPlayers } from './phaseMissions.js';

// Get all sessions
export async function getAllSessions() {
  try {
    const sessions = await sql`
      SELECT * FROM sessions ORDER BY created_at DESC
    `
    return sessions
  } catch (error) {
    console.error('Error fetching sessions:', error)
    throw error
  }
}

// Get active session
export async function getActiveSession() {
  try {
    const result = await sql`
      SELECT * FROM sessions WHERE status = 'active' LIMIT 1
    `
    return result.length > 0 ? result[0] : null
  } catch (error) {
    console.error('Error fetching active session:', error)
    throw error
  }
}

// The session players' phones show: the active one, or if the hosts have
// paused the game, the most recently paused one (so missions and bank stay
// visible during a pause instead of looking like the game hasn't started)
export async function getCurrentSession() {
  try {
    const result = await sql`
      SELECT * FROM sessions
      WHERE status IN ('active', 'paused')
      ORDER BY (status = 'active') DESC, paused_at DESC NULLS LAST
      LIMIT 1
    `
    return result.length > 0 ? result[0] : null
  } catch (error) {
    console.error('Error fetching current session:', error)
    throw error
  }
}

// Create a new session (draft status - missions not assigned yet)
export async function createSession({ name, userIds, createdBy }) {
  try {
    if (!name || !userIds || userIds.length === 0) {
      throw new Error('Session name and at least one user ID required')
    }

    const userIdsArray = userIds.map(id => Number(id))

    const result = await sql`
      INSERT INTO sessions (name, status, participant_user_ids, created_by)
      VALUES (${name.trim()}, 'draft', ${userIdsArray}::integer[], ${createdBy || null})
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
}

// Update a session (only allowed for draft, paused, or ended sessions)
export async function updateSession(sessionId, { name, userIds }) {
  try {
    if (!sessionId) {
      throw new Error('Session ID required')
    }

    const session = await sql`
      SELECT * FROM sessions WHERE id = ${sessionId}
    `

    if (session.length === 0) {
      throw new Error('Session not found')
    }

    const currentStatus = session[0].status

    if (currentStatus === 'active') {
      throw new Error('Cannot edit an active session. Pause or end it first.')
    }

    if (name !== undefined && !name?.trim()) {
      throw new Error('Session name cannot be empty')
    }

    if (userIds !== undefined && (!Array.isArray(userIds) || userIds.length === 0)) {
      throw new Error('At least one user ID required')
    }

    let result
    if (name !== undefined && userIds !== undefined) {
      result = await sql`
        UPDATE sessions
        SET name = ${name.trim()},
            participant_user_ids = ${userIds.map(id => Number(id))}::integer[]
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
    }

    // Players added to a session that has already started (i.e. paused) need
    // the current phase's missions, or they'll have nothing to do on resume.
    if (userIds !== undefined && currentStatus === 'paused') {
      const before = new Set(session[0].participant_user_ids || [])
      const added = userIds.map(id => Number(id)).filter(id => !before.has(id))
      if (added.length > 0) {
        await assignPhaseToPlayers(sessionId, session[0].current_phase || 0, added)
      }
    }

    return {
      success: true,
      session: result[0]
    }
  } catch (error) {
    console.error('Error updating session:', error)
    throw error
  }
}

// Add one player to a running (active or paused) session mid-game and give them
// the current phase's missions. Earlier phases are locked, so they're skipped;
// later phases include the player automatically when the host advances.
export async function addPlayerToSession(sessionId, userId) {
  try {
    const session = await sql`
      SELECT * FROM sessions WHERE id = ${sessionId}
    `
    if (session.length === 0) throw new Error('Session not found')

    const { status, current_phase } = session[0]
    if (status !== 'active' && status !== 'paused') {
      throw new Error(`Session is ${status}; edit the session to change its players instead`)
    }

    const id = Number(userId)
    if ((session[0].participant_user_ids || []).includes(id)) {
      throw new Error('That player is already in this session')
    }

    await sql`
      UPDATE sessions
      SET participant_user_ids = array_append(participant_user_ids, ${id}::integer)
      WHERE id = ${sessionId}
    `

    const assigned = await assignPhaseToPlayers(sessionId, current_phase || 0, [id])

    return {
      success: true,
      phase: current_phase || 0,
      missionCount: assigned.missionCount
    }
  } catch (error) {
    console.error('Error adding player to session:', error)
    throw error
  }
}

// Start a session (changes status to active and assigns phase 1 missions)
export async function startSession(sessionId) {
  try {
    const session = await sql`
      SELECT * FROM sessions WHERE id = ${sessionId}
    `

    if (session.length === 0) {
      throw new Error('Session not found')
    }

    if (session[0].status !== 'draft') {
      throw new Error(`Session is already ${session[0].status}`)
    }

    const activeSession = await getActiveSession()
    if (activeSession) {
      throw new Error('There is already an active session. End it before starting a new one.')
    }

    await sql`
      UPDATE sessions
      SET status = 'active', started_at = NOW(), current_phase = 0
      WHERE id = ${sessionId}
    `

    try {
      await assignPhaseToPlayers(sessionId, 0)
    } catch (assignError) {
      await sql`
        UPDATE sessions
        SET status = 'draft', started_at = NULL, current_phase = 0
        WHERE id = ${sessionId}
      `
      throw new Error(`Failed to assign phase 1 missions: ${assignError.message}`)
    }

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
}

// Advance to the next phase
export async function advancePhase(sessionId) {
  try {
    const session = await sql`
      SELECT * FROM sessions WHERE id = ${sessionId}
    `

    if (session.length === 0) throw new Error('Session not found')
    if (session[0].status !== 'active') throw new Error('Session is not active')

    const currentPhase = session[0].current_phase || 0
    if (currentPhase >= 3) throw new Error('Already at the final phase')

    const nextPhase = currentPhase + 1

    const result = await sql`
      UPDATE sessions
      SET current_phase = ${nextPhase}
      WHERE id = ${sessionId}
      RETURNING *
    `

    await assignPhaseToPlayers(sessionId, nextPhase)

    return {
      success: true,
      session: result[0],
      newPhase: nextPhase
    }
  } catch (error) {
    console.error('Error advancing phase:', error)
    throw error
  }
}

// Pause a session
export async function pauseSession(sessionId) {
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
}

// Resume a paused session
export async function resumeSession(sessionId) {
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
}

// End a session
export async function endSession(sessionId) {
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
    
    return { success: true }
  } catch (error) {
    console.error('Error ending session:', error)
    throw error
  }
}

// Reset a session: clear all player mission assignments and completions
// Works for paused or ended sessions (does not require active session)
export async function resetSession(sessionId) {
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
    
    // Clear player_missions for this session
    await sql`
      DELETE FROM player_missions WHERE session_id = ${sessionId}
    `

    // Reset session status back to 'draft' and clear timestamps and phase
    await sql`
      UPDATE sessions
      SET status = 'draft',
          started_at = NULL,
          paused_at = NULL,
          ended_at = NULL,
          current_phase = 0
      WHERE id = ${sessionId}
    `

    return {
      success: true,
      message: 'Session reset successfully. All player missions cleared. Session status reset to draft.'
    }
  } catch (error) {
    console.error('Error resetting session:', error)
    throw error
  }
}


