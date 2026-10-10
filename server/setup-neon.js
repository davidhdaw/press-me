// Creates every table the app uses. Safe to re-run: it never drops or rewrites data.
// This file is the source of truth for the schema.
//
// Usage: cd server && npm run setup-db
import { sql } from './db.js';

async function setupNeonDatabase() {
  try {
    console.log('Setting up Neon database (non-destructive)...');

    // Players and hosts. ids are assigned by the app (MAX(id) + 1), not a sequence.
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        firstname VARCHAR(50) NOT NULL,
        lastname VARCHAR(50) NOT NULL,
        ishere BOOLEAN DEFAULT true,
        alias_1 VARCHAR(50) NOT NULL,
        alias_2 VARCHAR(50) NOT NULL,
        passphrase TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        agent_name VARCHAR(50) NOT NULL,
        success BOOLEAN NOT NULL,
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `;

    // One game night. Only one session may be 'active' at a time (enforced in the app).
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        participant_user_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        started_at TIMESTAMP,
        paused_at TIMESTAMP,
        ended_at TIMESTAMP,
        notes TEXT,
        current_phase INTEGER DEFAULT 0,
        CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'paused', 'ended'))
      )
    `;

    // The global mission catalogue (not per-session). Seeded by setup-phase-missions.js.
    await sql`
      CREATE TABLE IF NOT EXISTS phase_missions (
        id SERIAL PRIMARY KEY,
        phase INTEGER NOT NULL CHECK (phase IN (0, 1, 2, 3)),
        title TEXT NOT NULL,
        mission_body TEXT NOT NULL,
        completion_type VARCHAR(10) NOT NULL CHECK (completion_type IN ('phrase', 'signoff', 'reveal')),
        success_key TEXT,
        signoff_prompt_template TEXT,
        variable_pool JSONB,
        variable_source VARCHAR(20) DEFAULT 'pool',
        signer_constraint VARCHAR(20) CHECK (signer_constraint IN ('any', 'new_signer', 'same_signer', 'admin_only', 'ceo')),
        same_signer_mission_id INTEGER REFERENCES phase_missions(id),
        sort_order INTEGER NOT NULL DEFAULT 0,
        bounty INTEGER DEFAULT 0,
        is_culminating BOOLEAN NOT NULL DEFAULT false,
        culminating_first_only BOOLEAN NOT NULL DEFAULT false,
        payment_type VARCHAR(20) CHECK (payment_type IN ('witness_to_player', 'witness_to_house')),
        payment_min INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // One row per (session, player, catalogue mission), created as each phase starts.
    await sql`
      CREATE TABLE IF NOT EXISTS player_missions (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES sessions(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        mission_id INTEGER NOT NULL REFERENCES phase_missions(id),
        variable_value TEXT,
        completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        signed_off_by INTEGER REFERENCES users(id),
        signed_off_at TIMESTAMP,
        phrase_answer TEXT,
        bounty_paid BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(session_id, user_id, mission_id)
      )
    `;

    // Signed-in staff (hosts and bankers). The token lives in the staff
    // member's browser; roles are always re-read from users, never trusted
    // from the browser.
    await sql`
      CREATE TABLE IF NOT EXISTS staff_sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )
    `;

    // Banker withdrawals (spending at the toy table) and corrections. Mission
    // deposits aren't stored here: they're player_missions.bounty_awarded and
    // completed push_missions.bounty. Balance = deposits + SUM(amount).
    await sql`
      CREATE TABLE IF NOT EXISTS bank_transactions (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES sessions(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount INTEGER NOT NULL CHECK (amount != 0),
        kind VARCHAR(20) NOT NULL,
        note TEXT,
        created_by INTEGER REFERENCES users(id),
        player_mission_id INTEGER REFERENCES player_missions(id),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;

    // Ad-hoc missions a host sends to one player mid-game.
    await sql`
      CREATE TABLE IF NOT EXISTS push_missions (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES sessions(id),
        target_user_id INTEGER NOT NULL REFERENCES users(id),
        sent_by_user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        mission_body TEXT NOT NULL,
        bounty INTEGER DEFAULT 0,
        acknowledged BOOLEAN DEFAULT false,
        acknowledged_at TIMESTAMP,
        completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        completion_seen BOOLEAN DEFAULT false,
        completion_seen_at TIMESTAMP,
        bounty_paid BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('✓ Tables verified');

    // Columns added after the first release. ADD COLUMN IF NOT EXISTS is a no-op
    // on databases that already have them.
    await sql`ALTER TABLE phase_missions ADD COLUMN IF NOT EXISTS is_culminating BOOLEAN NOT NULL DEFAULT false`;
    // 'reveal': completed by visiting the hidden /reveal page (an NFC tag)
    await sql`ALTER TABLE phase_missions DROP CONSTRAINT IF EXISTS phase_missions_completion_type_check`;
    await sql`ALTER TABLE phase_missions ADD CONSTRAINT phase_missions_completion_type_check CHECK (completion_type IN ('phrase', 'signoff', 'reveal'))`;
    // 'ceo': only a host's passphrase (the CEO, who isn't a player) signs it off
    await sql`ALTER TABLE phase_missions DROP CONSTRAINT IF EXISTS phase_missions_signer_constraint_check`;
    await sql`ALTER TABLE phase_missions ADD CONSTRAINT phase_missions_signer_constraint_check CHECK (signer_constraint IN ('any', 'new_signer', 'same_signer', 'admin_only', 'ceo'))`;
    // Culminating mission that only the first agent to finish the phase gets
    await sql`ALTER TABLE phase_missions ADD COLUMN IF NOT EXISTS culminating_first_only BOOLEAN NOT NULL DEFAULT false`;
    // Missions where the witness's sign-off also pays money (e.g. buying the
    // player's "art"): who gets paid, and the minimum amount
    await sql`ALTER TABLE phase_missions ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20)`;
    await sql`ALTER TABLE phase_missions ADD COLUMN IF NOT EXISTS payment_min INTEGER`;
    await sql`ALTER TABLE phase_missions DROP CONSTRAINT IF EXISTS phase_missions_payment_type_check`;
    await sql`ALTER TABLE phase_missions ADD CONSTRAINT phase_missions_payment_type_check CHECK (payment_type IN ('witness_to_player', 'witness_to_house'))`;
    // Sign-off payments are bank_transactions of kind 'payment' tied to the mission
    await sql`ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS player_mission_id INTEGER REFERENCES player_missions(id)`;
    await sql`ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_kind_check`;
    await sql`ALTER TABLE bank_transactions ADD CONSTRAINT bank_transactions_kind_check CHECK (kind IN ('withdrawal', 'adjustment', 'payment'))`;
    // A mission can be paid for at most once (one debit, one credit)
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_payment_debit ON bank_transactions(player_mission_id) WHERE kind = 'payment' AND amount < 0`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_payment_credit ON bank_transactions(player_mission_id) WHERE kind = 'payment' AND amount > 0`;
    // Bounty deposited when the mission was completed (snapshot, so editing a
    // mission's bounty later doesn't rewrite anyone's bank history)
    await sql`ALTER TABLE player_missions ADD COLUMN IF NOT EXISTS bounty_awarded INTEGER`;
    // Staff roles and login. is_admin = host. Staff PINs are separate from
    // passphrases, which players see during sign-offs.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banker BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_pin_hash TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_pin_salt TEXT`;

    console.log('✓ Columns verified');

    // Every money movement for a player in a session, newest data always live.
    // Balance = SUM(amount); the app's statement and overdraft check read this.
    await sql`
      CREATE OR REPLACE VIEW bank_ledger AS
        SELECT 'mission'::text AS kind, pm.id AS ref_id, pm.session_id, pm.user_id,
               pm.bounty_awarded AS amount, ph.title AS note, NULL::integer AS created_by,
               pm.completed_at AS created_at
        FROM player_missions pm
        JOIN phase_missions ph ON ph.id = pm.mission_id
        WHERE pm.completed AND pm.bounty_awarded > 0
      UNION ALL
        SELECT 'push'::text, id, session_id, target_user_id,
               bounty, title, sent_by_user_id, completed_at
        FROM push_missions
        WHERE completed AND bounty > 0
      UNION ALL
        SELECT kind::text, id, session_id, user_id,
               amount, note, created_by, created_at
        FROM bank_transactions
    `;

    console.log('✓ Views verified');

    // Databases created by older versions of the game have a NOT NULL users.team
    // column that the app no longer writes; relax it so new users can be added.
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'team'
        ) THEN
          ALTER TABLE users ALTER COLUMN team DROP NOT NULL;
        END IF;
      END $$
    `;

    console.log('✓ Legacy columns relaxed');

    await sql`CREATE INDEX IF NOT EXISTS idx_users_alias_1 ON users(alias_1)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_alias_2 ON users(alias_2)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_ishere ON users(ishere)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_login_logs_timestamp ON login_logs(timestamp)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_login_logs_agent_name ON login_logs(agent_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(status) WHERE status = 'active'`;
    await sql`CREATE INDEX IF NOT EXISTS idx_phase_missions_phase ON phase_missions(phase)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_phase_missions_sort ON phase_missions(phase, sort_order)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_missions_session ON player_missions(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_missions_user ON player_missions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_missions_mission ON player_missions(mission_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_missions_signoff ON player_missions(signed_off_by)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_missions_lookup ON player_missions(session_id, user_id, completed)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_push_missions_target ON push_missions(target_user_id, acknowledged)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_push_missions_session ON push_missions(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_staff_sessions_user ON staff_sessions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(session_id, user_id)`;

    console.log('✓ Indexes verified');
    console.log('\n✓ Database setup completed successfully!');
  } catch (err) {
    console.error('Error setting up database:', err);
    process.exit(1);
  }
}

setupNeonDatabase();
