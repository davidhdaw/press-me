import { sql } from './db.js';
import { passphraseLastWord } from './passphrase.js';

// Get all users
export async function getUsers() {
  try {
    const result = await sql`SELECT id, firstname, lastname, alias_1, alias_2, passphrase, ishere, is_admin FROM users ORDER BY firstname`;
    return result;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

const trimFields = ({ firstname, lastname, alias_1, alias_2, passphrase }) => ({
  firstname: firstname?.trim(),
  lastname: lastname?.trim(),
  alias_1: alias_1?.trim(),
  alias_2: alias_2?.trim(),
  passphrase: passphrase?.trim(),
});

// Names and aliases are how players sign in, and passphrases are how the app
// identifies who signed off a mission, so each must be unique across users.
async function assertUnique(fields, excludeId = null) {
  const others = await sql`
    SELECT id, firstname, lastname, alias_1, alias_2, passphrase FROM users
    WHERE ${excludeId}::integer IS NULL OR id != ${excludeId}::integer
  `;
  const lower = (v) => (v || '').toLowerCase();
  const fullName = (u) => `${lower(u.firstname)} ${lower(u.lastname)}`;
  const alias = (u) => lower(u.alias_1) + lower(u.alias_2);

  if (fields.firstname !== undefined && fields.lastname !== undefined) {
    const clash = others.find(u => fullName(u) === fullName(fields));
    if (clash) throw new Error(`Another user is already named ${clash.firstname} ${clash.lastname}`);
  }
  if (fields.alias_1 !== undefined && fields.alias_2 !== undefined) {
    const clash = others.find(u => alias(u) === alias(fields));
    if (clash) throw new Error(`${clash.firstname} ${clash.lastname} already uses the alias ${clash.alias_1} ${clash.alias_2}`);
  }
  if (fields.passphrase !== undefined) {
    const word = passphraseLastWord(fields.passphrase);
    if (!word) throw new Error('Passphrase must contain at least one letter or number');
    const clash = others.find(u => passphraseLastWord(u.passphrase) === word);
    if (clash) throw new Error(`That passphrase clashes with ${clash.firstname} ${clash.lastname}'s; pick another word`);
  }
}

function assertPresent(fields) {
  for (const key of ['firstname', 'lastname', 'alias_1', 'alias_2', 'passphrase']) {
    if (key in fields && !fields[key]) throw new Error('Name, both alias words and passphrase are required');
  }
}

// Create a new user
export async function createUser({ is_admin = false, ...input }) {
  try {
    const f = trimFields(input)
    assertPresent(f)
    await assertUnique(f)

    const result = await sql`
      INSERT INTO users (id, firstname, lastname, ishere, alias_1, alias_2, passphrase, is_admin)
      VALUES (
        (SELECT COALESCE(MAX(id), 0) + 1 FROM users),
        ${f.firstname}, ${f.lastname}, true,
        ${f.alias_1}, ${f.alias_2}, ${f.passphrase},
        ${is_admin}
      )
      RETURNING id, firstname, lastname, alias_1, alias_2, passphrase, ishere, is_admin
    `
    return result[0]
  } catch (error) {
    console.error('Error creating user:', error)
    throw error
  }
}

// Update a user's details. Safe mid-game: missions reference users by id.
// Only fields that actually change are checked for clashes, so an edit never
// fails because of some unrelated pre-existing duplicate.
export async function updateUser(userId, { firstname, lastname, alias_1, alias_2, passphrase, ishere, is_admin }) {
  try {
    const current = await sql`SELECT * FROM users WHERE id = ${userId}`
    if (current.length === 0) throw new Error('User not found')
    const u = current[0]

    const f = trimFields({ firstname, lastname, alias_1, alias_2, passphrase })
    const next = {
      firstname: f.firstname ?? u.firstname,
      lastname: f.lastname ?? u.lastname,
      alias_1: f.alias_1 ?? u.alias_1,
      alias_2: f.alias_2 ?? u.alias_2,
      passphrase: f.passphrase ?? u.passphrase,
    }
    assertPresent(next)

    const changed = {}
    if (next.firstname !== u.firstname || next.lastname !== u.lastname) {
      changed.firstname = next.firstname
      changed.lastname = next.lastname
    }
    if (next.alias_1 !== u.alias_1 || next.alias_2 !== u.alias_2) {
      changed.alias_1 = next.alias_1
      changed.alias_2 = next.alias_2
    }
    if (next.passphrase !== u.passphrase) changed.passphrase = next.passphrase
    await assertUnique(changed, u.id)

    const result = await sql`
      UPDATE users SET
        firstname = ${next.firstname},
        lastname = ${next.lastname},
        alias_1 = ${next.alias_1},
        alias_2 = ${next.alias_2},
        passphrase = ${next.passphrase},
        ishere = ${ishere ?? u.ishere},
        is_admin = ${is_admin ?? u.is_admin}
      WHERE id = ${userId}
      RETURNING id, firstname, lastname, alias_1, alias_2, passphrase, ishere, is_admin
    `
    return result[0]
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

// Get a user's passphrase by ID
export async function getUserPassphrase(userId) {
  try {
    const result = await sql`SELECT passphrase FROM users WHERE id = ${userId}`
    return result[0]?.passphrase || null
  } catch (error) {
    console.error('Error fetching user passphrase:', error)
    throw error
  }
}
