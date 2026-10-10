// Give someone a staff PIN (and optionally a staff role) so they can sign in
// at /staff. Use this to set up the first hosts; after that, hosts can set
// PINs and roles from the admin dashboard's Edit player screen.
//
// Usage: cd server && npm run set-staff-pin -- "First Last" 123456 [--host] [--banker]
import { sql } from './db.js';
import { hashPin, isValidPin, randomHex } from '../src/api/pin.js';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const [name, pin] = args.filter(a => !a.startsWith('--'));

if (!name || !pin) {
  console.error('Usage: npm run set-staff-pin -- "First Last" 123456 [--host] [--banker]');
  process.exit(1);
}
if (!isValidPin(pin)) {
  console.error('Staff PIN must be 4 to 8 digits');
  process.exit(1);
}

const parts = name.trim().split(/\s+/);
const users = await sql`
  SELECT id, firstname, lastname, is_admin, is_banker FROM users
  WHERE LOWER(firstname) = LOWER(${parts[0]}) AND LOWER(lastname) = LOWER(${parts.slice(1).join(' ')})
`;
if (users.length !== 1) {
  console.error(users.length === 0 ? `No user named ${name}` : `More than one user named ${name}`);
  process.exit(1);
}
const user = users[0];

const isAdmin = user.is_admin || flags.has('--host');
const isBanker = user.is_banker || flags.has('--banker');
if (!isAdmin && !isBanker) {
  console.error(`${name} is neither a host nor a banker. Add --host or --banker.`);
  process.exit(1);
}

const salt = randomHex(16);
await sql`
  UPDATE users
  SET staff_pin_hash = ${await hashPin(pin, salt)}, staff_pin_salt = ${salt},
      is_admin = ${isAdmin}, is_banker = ${isBanker}
  WHERE id = ${user.id}
`;
console.log(`✓ ${user.firstname} ${user.lastname} can sign in at /staff (${[isAdmin && 'host', isBanker && 'banker'].filter(Boolean).join(' + ')})`);
