import { sql } from './db.js';
import { hashPin, isValidPin, randomHex } from './pin.js';
import { logLogin } from './auth.js';

// Staff (hosts and bankers) sign in with their name and a staff PIN, which is
// separate from the passphrase players see during sign-offs. A successful
// sign-in creates a staff_sessions row; the browser keeps only the token, and
// every staff page re-reads the person's roles from the database through it.

const SESSION_HOURS = 24;
const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;

const toStaff = (u) => ({
  id: u.id,
  firstname: u.firstname,
  lastname: u.lastname,
  is_admin: !!u.is_admin,
  is_banker: !!u.is_banker || !!u.is_admin, // hosts can do everything a banker can
});

export async function staffLogin(name, pin, userAgent) {
  try {
    const parts = (name || '').trim().split(/\s+/);
    const logKey = `staff:${parts.join(' ').toLowerCase()}`.slice(0, 50);

    const failures = await sql`
      SELECT count(*)::int AS n FROM login_logs
      WHERE agent_name = ${logKey} AND NOT success
        AND timestamp > NOW() - (${LOCKOUT_MINUTES}::int * INTERVAL '1 minute')
    `;
    if (failures[0].n >= MAX_FAILURES) {
      return { success: false, message: `Too many wrong PINs. Wait ${LOCKOUT_MINUTES} minutes or ask a host to reset your PIN.` };
    }

    let user = null;
    if (parts.length >= 2) {
      const rows = await sql`
        SELECT * FROM users
        WHERE LOWER(firstname) = LOWER(${parts[0]})
          AND LOWER(lastname) = LOWER(${parts.slice(1).join(' ')})
          AND (is_admin OR is_banker)
        LIMIT 1
      `;
      user = rows[0] || null;
    }

    const ok = user && user.staff_pin_hash && isValidPin(pin)
      && await hashPin(pin, user.staff_pin_salt) === user.staff_pin_hash;
    if (!ok) {
      await logLogin(logKey, false, null, userAgent);
      return { success: false, message: 'Name or PIN not recognised' };
    }

    await logLogin(logKey, true, null, userAgent);
    const token = randomHex(32);
    await sql`
      INSERT INTO staff_sessions (token, user_id, expires_at)
      VALUES (${token}, ${user.id}, NOW() + (${SESSION_HOURS}::int * INTERVAL '1 hour'))
    `;
    return { success: true, token, staff: toStaff(user) };
  } catch (error) {
    console.error('Staff login error:', error);
    throw error;
  }
}

// Returns the signed-in staff member with their current roles, or null if the
// token is unknown, expired, or the person no longer has a staff role.
export async function getStaffSession(token) {
  if (!token) return null;
  try {
    const rows = await sql`
      SELECT u.* FROM staff_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token} AND s.expires_at > NOW()
        AND (u.is_admin OR u.is_banker)
    `;
    return rows.length > 0 ? toStaff(rows[0]) : null;
  } catch (error) {
    console.error('Error checking staff session:', error);
    throw error;
  }
}

export async function staffLogout(token) {
  if (!token) return;
  await sql`DELETE FROM staff_sessions WHERE token = ${token}`;
}

// Set (or clear, with pin = null) a user's staff PIN. Clearing it also signs
// them out everywhere.
export async function setStaffPin(userId, pin) {
  try {
    if (pin === null) {
      await sql`UPDATE users SET staff_pin_hash = NULL, staff_pin_salt = NULL WHERE id = ${userId}`;
      await sql`DELETE FROM staff_sessions WHERE user_id = ${userId}`;
      return { success: true };
    }
    if (!isValidPin(pin)) throw new Error('Staff PIN must be 4 to 8 digits');
    const salt = randomHex(16);
    const hash = await hashPin(pin, salt);
    const result = await sql`
      UPDATE users SET staff_pin_hash = ${hash}, staff_pin_salt = ${salt}
      WHERE id = ${userId}
      RETURNING id
    `;
    if (result.length === 0) throw new Error('User not found');
    return { success: true };
  } catch (error) {
    console.error('Error setting staff PIN:', error);
    throw error;
  }
}
