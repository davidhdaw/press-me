import { sql } from './db.js';

export async function createPushMission({ sessionId, targetUserId, sentByUserId, title, missionBody, bounty }) {
  try {
    const result = await sql`
      INSERT INTO push_missions (session_id, target_user_id, sent_by_user_id, title, mission_body, bounty)
      VALUES (${sessionId}, ${targetUserId}, ${sentByUserId}, ${title}, ${missionBody}, ${bounty || 0})
      RETURNING *
    `;
    return result[0];
  } catch (error) {
    console.error('Error creating push mission:', error);
    throw error;
  }
}

export async function getPendingPushMissions(sessionId, userId) {
  try {
    return await sql`
      SELECT * FROM push_missions
      WHERE session_id = ${sessionId}
        AND target_user_id = ${userId}
        AND acknowledged = false
      ORDER BY created_at ASC
    `;
  } catch (error) {
    console.error('Error getting pending push missions:', error);
    throw error;
  }
}

export async function getCompletedUnseenPushMissions(sessionId, userId) {
  try {
    return await sql`
      SELECT * FROM push_missions
      WHERE session_id = ${sessionId}
        AND target_user_id = ${userId}
        AND completed = true
        AND completion_seen = false
      ORDER BY completed_at ASC
    `;
  } catch (error) {
    console.error('Error getting completed unseen push missions:', error);
    throw error;
  }
}

export async function getAcknowledgedPushMissions(sessionId, userId) {
  try {
    return await sql`
      SELECT * FROM push_missions
      WHERE session_id = ${sessionId}
        AND target_user_id = ${userId}
        AND acknowledged = true
      ORDER BY created_at DESC
    `;
  } catch (error) {
    console.error('Error getting acknowledged push missions:', error);
    throw error;
  }
}

export async function acknowledgePushMission(pushMissionId, userId) {
  try {
    const result = await sql`
      UPDATE push_missions
      SET acknowledged = true, acknowledged_at = NOW()
      WHERE id = ${pushMissionId} AND target_user_id = ${userId}
      RETURNING *
    `;
    if (result.length === 0) throw new Error('Push mission not found or not authorized');
    return result[0];
  } catch (error) {
    console.error('Error acknowledging push mission:', error);
    throw error;
  }
}

export async function completePushMission(pushMissionId) {
  try {
    const result = await sql`
      UPDATE push_missions
      SET completed = true, completed_at = NOW()
      WHERE id = ${pushMissionId}
      RETURNING *
    `;
    if (result.length === 0) throw new Error('Push mission not found');
    return result[0];
  } catch (error) {
    console.error('Error completing push mission:', error);
    throw error;
  }
}

export async function markCompletionSeen(pushMissionId, userId) {
  try {
    const result = await sql`
      UPDATE push_missions
      SET completion_seen = true, completion_seen_at = NOW()
      WHERE id = ${pushMissionId} AND target_user_id = ${userId}
      RETURNING *
    `;
    if (result.length === 0) throw new Error('Push mission not found or not authorized');
    return result[0];
  } catch (error) {
    console.error('Error marking completion seen:', error);
    throw error;
  }
}

export async function markPushBountyPaid(pushMissionId) {
  try {
    const result = await sql`
      UPDATE push_missions
      SET bounty_paid = true
      WHERE id = ${pushMissionId} AND completed = true
      RETURNING *
    `;
    if (result.length === 0) throw new Error('Push mission not found or not completed');
    return { success: true };
  } catch (error) {
    console.error('Error marking push bounty paid:', error);
    throw error;
  }
}

export async function getAllPushMissionsForSession(sessionId) {
  try {
    return await sql`
      SELECT pm.*,
        tu.firstname AS target_firstname, tu.lastname AS target_lastname,
        su.firstname AS sender_firstname, su.lastname AS sender_lastname
      FROM push_missions pm
      JOIN users tu ON pm.target_user_id = tu.id
      JOIN users su ON pm.sent_by_user_id = su.id
      WHERE pm.session_id = ${sessionId}
      ORDER BY pm.created_at DESC
    `;
  } catch (error) {
    console.error('Error getting all push missions for session:', error);
    throw error;
  }
}
