import { sql } from './db.js';
import { FINAL_PHASE } from './game.js';

// End-of-game award ceremony. getAwardsData() loads one session's raw facts;
// computeAwards() ranks players and picks winners (pure, so it's easy to test).

const ACT_NAMES = { 1: 'Act I', 2: 'Act II', 3: 'Act III' };

// Unique awards: nobody wins two of these. They're allocated in this order, so
// a more prestigious award keeps its real leader and later ones pass to the
// next-best player. First Past the Post is exempt: it always goes to whoever
// really finished first, even if they win something else or several acts.
const UNIQUE_ALLOCATION_ORDER = ['top-agent', 'partners-in-crime', 'social-butterfly', 'the-vault'];

// Presentation order: the strange ones first, Top Agent as the finale.
// One First Past the Post award per act that's actually played.
const ACTS = Array.from({ length: FINAL_PHASE }, (_, i) => i + 1);
const PRESENTATION_ORDER = ['social-butterfly', 'partners-in-crime', 'the-vault', ...ACTS.map(p => `fptp-${p}`), 'top-agent'];

export async function getAwardsData(sessionId) {
  const sessions = await sql`
    SELECT id, name, status, started_at, ended_at, participant_user_ids
    FROM sessions WHERE id = ${sessionId}
  `;
  if (sessions.length === 0) throw new Error('Session not found');
  const session = sessions[0];
  const ids = session.participant_user_ids || [];

  const [players, missions, ledger] = await Promise.all([
    sql`SELECT id, firstname, lastname FROM users WHERE id = ANY(${ids}::integer[])`,
    sql`
      SELECT pm.user_id, pm.completed, pm.completed_at, pm.signed_off_by,
             ph.phase, ph.is_culminating
      FROM player_missions pm
      JOIN phase_missions ph ON ph.id = pm.mission_id
      WHERE pm.session_id = ${sessionId}
    `,
    sql`SELECT user_id, kind, amount, created_at FROM bank_ledger WHERE session_id = ${sessionId}`,
  ]);

  return { session, players, missions, ledger };
}

const time = (t) => (t ? new Date(t).getTime() : Infinity);

// Sort by score (higher first) then by when it was reached (earlier first).
const byScoreThenTime = (a, b) => b.score - a.score || a.at - b.at;

export function computeAwards({ players, missions, ledger }) {
  const playerIds = new Set(players.map(p => p.id));
  const name = (id) => {
    const p = players.find(x => x.id === id);
    return p ? `${p.firstname} ${p.lastname}` : 'Unknown agent';
  };
  const completed = missions.filter(m => m.completed && playerIds.has(m.user_id));
  const signoffs = completed.filter(m => m.signed_off_by && playerIds.has(m.signed_off_by) && m.signed_off_by !== m.user_id);

  // Rankings: arrays of { userIds, score, at, stat } (best first)
  const rankings = {};

  // Top Agent: most money deposited (missions + special ops), not counting spending
  const earned = {};
  for (const e of ledger) {
    if (!playerIds.has(e.user_id) || !(e.kind === 'mission' || e.kind === 'push') || e.amount <= 0) continue;
    const cur = earned[e.user_id] || { score: 0, at: 0 };
    earned[e.user_id] = { score: cur.score + e.amount, at: Math.max(cur.at, time(e.created_at)) };
  }
  rankings['top-agent'] = Object.entries(earned)
    .map(([id, v]) => ({ userIds: [Number(id)], score: v.score, at: v.at, stat: `$${v.score.toLocaleString()} earned` }))
    .sort(byScoreThenTime);

  // Social Butterfly: most different people who signed off their missions
  const signers = {};
  for (const m of [...signoffs].sort((a, b) => time(a.completed_at) - time(b.completed_at))) {
    const s = signers[m.user_id] || { set: new Set(), at: 0 };
    if (!s.set.has(m.signed_off_by)) {
      s.set.add(m.signed_off_by);
      s.at = time(m.completed_at);
    }
    signers[m.user_id] = s;
  }
  rankings['social-butterfly'] = Object.entries(signers)
    .map(([id, v]) => ({ userIds: [Number(id)], score: v.set.size, at: v.at, stat: `${v.set.size} different witnesses` }))
    .sort(byScoreThenTime);

  // Partners in Crime: the pair with the most sign-offs between them, favouring
  // pairs who vouched for each other in both directions
  const pairs = {};
  for (const m of signoffs) {
    const [a, b] = [m.user_id, m.signed_off_by].sort((x, y) => x - y);
    const key = `${a}-${b}`;
    const p = pairs[key] || { userIds: [a, b], aSigned: 0, bSigned: 0, at: 0 };
    if (m.signed_off_by === a) p.aSigned++; else p.bSigned++;
    p.at = Math.max(p.at, time(m.completed_at));
    pairs[key] = p;
  }
  rankings['partners-in-crime'] = Object.values(pairs)
    .map(p => ({
      userIds: p.userIds,
      score: p.aSigned + p.bSigned,
      mutual: p.aSigned > 0 && p.bSigned > 0,
      at: p.at,
      stat: `${p.aSigned + p.bSigned} sign-offs between them`,
    }))
    .sort((x, y) => Number(y.mutual) - Number(x.mutual) || byScoreThenTime(x, y));

  // The Vault: most money left in the bank at the end
  const balances = {};
  for (const e of ledger) {
    if (!playerIds.has(e.user_id)) continue;
    const cur = balances[e.user_id] || { score: 0, at: 0 };
    balances[e.user_id] = { score: cur.score + e.amount, at: Math.max(cur.at, time(e.created_at)) };
  }
  rankings['the-vault'] = Object.entries(balances)
    .filter(([, v]) => v.score > 0)
    .map(([id, v]) => ({ userIds: [Number(id)], score: v.score, at: v.at, stat: `$${v.score.toLocaleString()} unspent` }))
    .sort(byScoreThenTime);

  // First Past the Post: first to complete every regular mission in an act
  for (const phase of ACTS) {
    const finishers = [];
    for (const id of playerIds) {
      const regular = missions.filter(m => m.user_id === id && m.phase === phase && !m.is_culminating);
      if (regular.length > 0 && regular.every(m => m.completed)) {
        const at = Math.max(...regular.map(m => time(m.completed_at)));
        finishers.push({ userIds: [id], score: 0, at, finishedAt: new Date(at).toISOString() });
      }
    }
    rankings[`fptp-${phase}`] = finishers.sort((a, b) => a.at - b.at);
  }

  // Pick winners
  const winners = {};
  const alreadyWon = new Set();
  for (const key of UNIQUE_ALLOCATION_ORDER) {
    const ranking = rankings[key];
    const pick = ranking.find(r => r.userIds.every(id => !alreadyWon.has(id)));
    winners[key] = pick || null;
    if (pick) pick.userIds.forEach(id => alreadyWon.add(id));
  }
  for (const phase of ACTS) winners[`fptp-${phase}`] = rankings[`fptp-${phase}`][0] || null;

  const meta = {
    'social-butterfly': { title: 'Social Butterfly', description: 'Got the most different agents to vouch for them.' },
    'partners-in-crime': { title: 'Partners in Crime', description: "The two agents who signed off on each other's missions the most." },
    'the-vault': { title: 'The Vault', description: 'Finished with the most money still in the bank.' },
    'top-agent': { title: 'Top Agent', description: 'Earned the most money over the whole operation.' },
  };
  for (const phase of ACTS) {
    meta[`fptp-${phase}`] = { title: `First Past the Post: ${ACT_NAMES[phase]}`, description: `First agent to complete every ${ACT_NAMES[phase]} mission.` };
  }

  const describe = (r) => r && ({
    userIds: r.userIds,
    names: r.userIds.map(name),
    stat: r.stat ?? null,
    finishedAt: r.finishedAt ?? null,
  });

  return PRESENTATION_ORDER.map(key => {
    const winner = winners[key];
    const top = rankings[key].slice(0, 3);
    return {
      key,
      ...meta[key],
      winner: describe(winner),
      // True when the stat leader was skipped because they'd already won
      passedOver: !!winner && rankings[key][0] !== winner,
      topThree: top.map(describe),
    };
  });
}

export async function getAwards(sessionId) {
  const data = await getAwardsData(sessionId);
  return { session: data.session, awards: computeAwards(data) };
}
