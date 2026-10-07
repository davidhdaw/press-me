import { sql } from './db.js';

// Player bank accounts, one per player per session, in dollars. Deposits come
// from completed missions automatically; bankers record withdrawals (prizes)
// and corrections. See the bank_ledger view in server/setup-neon.js.

export async function getStatement(sessionId, userId) {
  try {
    const entries = await sql`
      SELECT l.kind, l.ref_id, l.amount, l.note, l.created_at,
             u.firstname AS by_firstname, u.lastname AS by_lastname
      FROM bank_ledger l
      LEFT JOIN users u ON u.id = l.created_by AND l.kind IN ('withdrawal', 'adjustment')
      WHERE l.session_id = ${sessionId} AND l.user_id = ${userId}
      ORDER BY l.created_at DESC, l.ref_id DESC
    `;
    return {
      balance: entries.reduce((sum, e) => sum + e.amount, 0),
      entries: entries.map(e => ({
        kind: e.kind,
        id: `${e.kind}-${e.ref_id}`,
        amount: e.amount,
        note: e.note,
        createdAt: e.created_at,
        byName: e.by_firstname ? `${e.by_firstname} ${e.by_lastname}` : null,
      })),
    };
  } catch (error) {
    console.error('Error fetching bank statement:', error);
    throw error;
  }
}

// Every participant in the session with their balance, for the banker.
export async function getBalances(sessionId) {
  try {
    const rows = await sql`
      SELECT u.id, u.firstname, u.lastname, u.alias_1, u.alias_2,
             COALESCE(SUM(l.amount) FILTER (WHERE l.amount > 0), 0)::int AS earned,
             COALESCE(-SUM(l.amount) FILTER (WHERE l.amount < 0), 0)::int AS spent,
             COALESCE(SUM(l.amount), 0)::int AS balance
      FROM sessions s
      JOIN users u ON u.id = ANY(s.participant_user_ids)
      LEFT JOIN bank_ledger l ON l.session_id = s.id AND l.user_id = u.id
      WHERE s.id = ${sessionId}
      GROUP BY u.id
      ORDER BY u.firstname, u.lastname
    `;
    return rows;
  } catch (error) {
    console.error('Error fetching balances:', error);
    throw error;
  }
}

// kind 'withdrawal': amount is what the player spends (positive number).
// kind 'adjustment': signed correction (+ adds money, - removes it).
// Refuses anything that would take the balance below zero, in the same
// statement as the insert.
export async function recordTransaction({ sessionId, userId, kind, amount, note, createdBy }) {
  try {
    const value = Number(amount);
    if (!Number.isInteger(value) || value === 0) throw new Error('Enter a whole-dollar amount');
    if (kind === 'withdrawal' && value < 0) throw new Error('Withdrawal amount must be positive');
    if (kind !== 'withdrawal' && kind !== 'adjustment') throw new Error('Unknown transaction type');
    if (!createdBy) throw new Error('Banker required');
    const delta = kind === 'withdrawal' ? -value : value;
    const cleanNote = note?.trim() || null;

    const inserted = await sql`
      INSERT INTO bank_transactions (session_id, user_id, amount, kind, note, created_by)
      SELECT ${sessionId}, ${userId}, ${delta}, ${kind}, ${cleanNote}, ${createdBy}
      WHERE COALESCE((
        SELECT SUM(amount) FROM bank_ledger
        WHERE session_id = ${sessionId} AND user_id = ${userId}
      ), 0) + ${delta}::int >= 0
      RETURNING id
    `;
    if (inserted.length === 0) {
      const { balance } = await getStatement(sessionId, userId);
      throw new Error(`Not enough money: balance is $${balance.toLocaleString()}`);
    }
    return getStatement(sessionId, userId);
  } catch (error) {
    console.error('Error recording bank transaction:', error);
    throw error;
  }
}
