import { sql } from './db.js';

// Log login attempt
export async function logLogin(agentName, success, ipAddress, userAgent) {
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
}

// Sign in by real name (no passphrase required).
// Accepts: "firstname lastname" — last name may be multiple words (case-insensitive).
export async function signInByName(name, userAgent) {
  try {
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length < 2) {
      return { success: false, message: 'Please enter your full name (first and last)' };
    }

    const firstname = nameParts[0];
    const lastname = nameParts.slice(1).join(' ');

    const userResult = await sql`
      SELECT id, firstname, lastname, alias_1, alias_2, passphrase
      FROM users 
      WHERE LOWER(firstname) = LOWER(${firstname})
        AND LOWER(lastname) = LOWER(${lastname})
        AND ishere = true
      LIMIT 1
    `;

    if (userResult.length === 0) {
      return { success: false, message: 'Name not found' };
    }

    const user = userResult[0];
    const displayLogin = `${user.firstname} ${user.lastname}`;
    await logLogin(displayLogin, true, null, userAgent);

    return {
      success: true,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        alias_1: user.alias_1,
        alias_2: user.alias_2,
        codename: `${user.alias_1} ${user.alias_2}`,
        passphrase: user.passphrase,
        // Player sign-in never grants staff powers; staff use /staff
        is_admin: false
      }
    };
  } catch (error) {
    console.error('Error signing in by name:', error);
    throw error;
  }
}

// Sign in by alias (no passphrase required).
// ONLY accepts: "alias_1 alias_2" (with space, underscore, or concatenated) in that order.
// Case-insensitive comparison.
export async function signInByAlias(alias, userAgent) {
  try {
    const userResult = await sql`
      SELECT id, firstname, lastname, alias_1, alias_2, passphrase
      FROM users 
      WHERE (
        LOWER(alias_1 || ' ' || alias_2) = LOWER(${alias})
        OR LOWER(alias_1 || '_' || alias_2) = LOWER(${alias})
        OR LOWER(alias_1 || alias_2) = LOWER(${alias})
      ) AND ishere = true
    `;
    
    if (userResult.length === 0) {
      return { success: false, message: 'Alias not found' };
    }

    const user = userResult[0];
    await logLogin(alias, true, null, userAgent);

    return {
      success: true,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        alias_1: user.alias_1,
        alias_2: user.alias_2,
        codename: `${user.alias_1} ${user.alias_2}`,
        passphrase: user.passphrase,
        // Player sign-in never grants staff powers; staff use /staff
        is_admin: false
      }
    };
  } catch (error) {
    console.error('Error signing in by alias:', error);
    throw error;
  }
}
