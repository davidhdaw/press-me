import { sql } from './db.js';
import { normalizePassphrase, passphraseMatchesStored } from './passphrase.js';

// ── Admin CRUD ──────────────────────────────────────────────────────────────

export async function createPhaseMission({
  phase, title, missionBody, completionType,
  successKey, signoffPromptTemplate, variablePool,
  variableSource, signerConstraint, sameSignerMissionId, sortOrder, bounty, isCulminating, firstOnly,
  paymentType, paymentMin
}) {
  try {
    const result = await sql`
      INSERT INTO phase_missions (
        phase, title, mission_body, completion_type,
        success_key, signoff_prompt_template, variable_pool,
        variable_source, signer_constraint, same_signer_mission_id, sort_order, bounty, is_culminating,
        culminating_first_only, payment_type, payment_min
      ) VALUES (
        ${phase}, ${title}, ${missionBody}, ${completionType},
        ${successKey || null}, ${signoffPromptTemplate || null},
        ${variablePool ? JSON.stringify(variablePool) : null}::jsonb,
        ${variableSource || 'pool'}, ${signerConstraint || null}, ${sameSignerMissionId || null},
        ${sortOrder || 0}, ${bounty || 0}, ${!!isCulminating},
        ${!!isCulminating && !!firstOnly}, ${paymentType || null}, ${paymentType ? (paymentMin || 0) : null}
      ) RETURNING *
    `;
    return result[0];
  } catch (error) {
    console.error('Error creating phase mission:', error);
    throw error;
  }
}

export async function getPhaseMissions(phase = null) {
  try {
    if (phase !== null && phase !== undefined) {
      return await sql`
        SELECT * FROM phase_missions
        WHERE phase = ${phase}
        ORDER BY sort_order, id
      `;
    }
    return await sql`
      SELECT * FROM phase_missions
      ORDER BY phase, sort_order, id
    `;
  } catch (error) {
    console.error('Error fetching phase missions:', error);
    throw error;
  }
}

export async function updatePhaseMission(missionId, updates) {
  try {
    const mission = await sql`SELECT * FROM phase_missions WHERE id = ${missionId}`;
    if (mission.length === 0) throw new Error('Mission not found');

    const m = mission[0];
    const result = await sql`
      UPDATE phase_missions SET
        title = ${updates.title ?? m.title},
        mission_body = ${updates.missionBody ?? m.mission_body},
        completion_type = ${updates.completionType ?? m.completion_type},
        success_key = ${updates.successKey !== undefined ? updates.successKey : m.success_key},
        signoff_prompt_template = ${updates.signoffPromptTemplate !== undefined ? updates.signoffPromptTemplate : m.signoff_prompt_template},
        variable_pool = ${updates.variablePool !== undefined ? (updates.variablePool ? JSON.stringify(updates.variablePool) : null) : m.variable_pool}::jsonb,
        variable_source = ${updates.variableSource !== undefined ? updates.variableSource : m.variable_source},
        signer_constraint = ${updates.signerConstraint !== undefined ? updates.signerConstraint : m.signer_constraint},
        same_signer_mission_id = ${updates.sameSignerMissionId !== undefined ? updates.sameSignerMissionId : m.same_signer_mission_id},
        sort_order = ${updates.sortOrder ?? m.sort_order},
        bounty = ${updates.bounty !== undefined ? updates.bounty : m.bounty},
        is_culminating = ${updates.isCulminating !== undefined ? !!updates.isCulminating : m.is_culminating},
        culminating_first_only = ${(updates.isCulminating ?? m.is_culminating) && (updates.firstOnly !== undefined ? !!updates.firstOnly : m.culminating_first_only)},
        payment_type = ${updates.paymentType !== undefined ? (updates.paymentType || null) : m.payment_type},
        payment_min = ${updates.paymentType !== undefined ? (updates.paymentType ? (updates.paymentMin || 0) : null) : (updates.paymentMin !== undefined ? updates.paymentMin : m.payment_min)}
      WHERE id = ${missionId}
      RETURNING *
    `;
    return result[0];
  } catch (error) {
    console.error('Error updating phase mission:', error);
    throw error;
  }
}

export async function deletePhaseMission(missionId) {
  try {
    await sql`DELETE FROM player_missions WHERE mission_id = ${missionId}`;
    await sql`DELETE FROM phase_missions WHERE id = ${missionId}`;
    return { success: true };
  } catch (error) {
    console.error('Error deleting phase mission:', error);
    throw error;
  }
}

// ── Culminating missions ────────────────────────────────────────────────────
// A culminating mission is hidden from the player until they've completed every
// other (non-culminating) mission in the same phase. Unlock state is derived
// from completions, so admin force-completes and sign-offs both count.

// A "first agent only" culminating mission goes only to whoever finished the
// phase's regular missions first (same rule as the First Past the Post award;
// ties go to the lower user id). Returns { phase: userId }.
async function firstFinishers(sessionId) {
  const rows = await sql`
    WITH per_player AS (
      SELECT pm.user_id, ph.phase,
             bool_and(pm.completed) AS done, MAX(pm.completed_at) AS finished_at
      FROM player_missions pm
      JOIN phase_missions ph ON ph.id = pm.mission_id
      WHERE pm.session_id = ${sessionId} AND NOT ph.is_culminating
      GROUP BY pm.user_id, ph.phase
    )
    SELECT DISTINCT ON (phase) phase, user_id
    FROM per_player WHERE done
    ORDER BY phase, finished_at, user_id
  `;
  return Object.fromEntries(rows.map(r => [r.phase, r.user_id]));
}

// Is this player's culminating mission row available to them?
function culminatingState(r, unlocked, firsts) {
  if (!r.is_culminating) return { culminatingUnlocked: false, culminatingClaimed: false };
  const phaseDone = unlocked.has(r.phase);
  if (!r.culminating_first_only) return { culminatingUnlocked: phaseDone, culminatingClaimed: false };
  const first = firsts[r.phase];
  return {
    culminatingUnlocked: phaseDone && first === r.user_id,
    // Finished the phase, but another agent got there first
    culminatingClaimed: phaseDone && first !== undefined && first !== r.user_id,
  };
}

// rows: one player's missions, each with { phase, isCulminating, completed }.
// Returns a Set of phases whose culminating missions are unlocked.
function unlockedPhases(rows) {
  const phases = new Set(rows.map(r => r.phase));
  const unlocked = new Set();
  for (const phase of phases) {
    const regular = rows.filter(r => r.phase === phase && !r.isCulminating);
    if (regular.every(r => r.completed)) unlocked.add(phase);
  }
  return unlocked;
}

async function assertCulminatingUnlocked(mission) {
  if (!mission.is_culminating) return;
  const remaining = await sql`
    SELECT count(*)::int AS n
    FROM player_missions pm
    JOIN phase_missions ph ON pm.mission_id = ph.id
    WHERE pm.session_id = ${mission.session_id}
      AND pm.user_id = ${mission.user_id}
      AND ph.phase = ${mission.phase}
      AND NOT ph.is_culminating
      AND NOT pm.completed
  `;
  if (remaining[0].n > 0) {
    throw new Error(`Complete your other Phase ${mission.phase} missions first`);
  }
  if (mission.culminating_first_only) {
    const firsts = await firstFinishers(mission.session_id);
    if (firsts[mission.phase] !== mission.user_id) {
      throw new Error('Another agent finished this phase first');
    }
  }
}

// ── Player Mission Assignment ───────────────────────────────────────────────

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function assignVariables(pool, playerCount) {
  if (!pool || pool.length === 0) return new Array(playerCount).fill(null);
  const shuffled = shuffleArray(pool);
  return Array.from({ length: playerCount }, (_, i) => shuffled[i % shuffled.length]);
}

// Pair players mutually (if A gets B, B gets A). With an odd count, the last
// player is also assigned the second-to-last player's partner pairing.
function pairPlayers(playerIds) {
  const pairOrder = shuffleArray(playerIds);
  const partnerMap = {};
  for (let i = 0; i + 1 < pairOrder.length; i += 2) {
    partnerMap[pairOrder[i]] = pairOrder[i + 1];
    partnerMap[pairOrder[i + 1]] = pairOrder[i];
  }
  if (pairOrder.length % 2 === 1 && pairOrder.length > 1) {
    partnerMap[pairOrder[pairOrder.length - 1]] = pairOrder[pairOrder.length - 2];
  }
  return partnerMap;
}

// Give each participant a player_missions row for every mission in `phase`.
// Pass `onlyUserIds` to assign just those players (late joiners) and leave
// everyone else's existing assignments untouched.
export async function assignPhaseToPlayers(sessionId, phase, onlyUserIds = null) {
  try {
    const sessionResult = await sql`
      SELECT participant_user_ids FROM sessions WHERE id = ${sessionId}
    `;
    if (sessionResult.length === 0) throw new Error('Session not found');

    const allPlayerIds = sessionResult[0].participant_user_ids;
    if (!allPlayerIds || allPlayerIds.length === 0) throw new Error('No participants in session');

    const playerIds = onlyUserIds
      ? allPlayerIds.filter(id => onlyUserIds.map(Number).includes(id))
      : allPlayerIds;
    if (playerIds.length === 0) return { success: true, phase, playerCount: 0, missionCount: 0 };

    const missions = await sql`
      SELECT * FROM phase_missions
      WHERE phase = ${phase}
      ORDER BY sort_order, id
    `;

    if (missions.length === 0) return { success: true, phase, playerCount: playerIds.length, missionCount: 0 };

    // Pre-fetch participant names for dynamic variable assignment
    const participants = await sql`
      SELECT id, firstname, lastname FROM users
      WHERE id = ANY(${allPlayerIds}::integer[])
    `;
    const nameMap = {};
    for (const p of participants) {
      nameMap[p.id] = `${p.firstname} ${p.lastname}`;
    }

    const shuffledPlayerIds = shuffleArray(playerIds);

    for (const mission of missions) {
      let variables;

      if (mission.variable_source === 'participants') {
        // Late joiners pair with each other first; a leftover one gets a random
        // existing participant (who keeps their own original partner).
        const partnerMap = pairPlayers(playerIds);
        const others = allPlayerIds.filter(id => !playerIds.includes(id));
        for (const id of playerIds) {
          if (partnerMap[id] === undefined && others.length > 0) {
            partnerMap[id] = others[Math.floor(Math.random() * others.length)];
          }
        }
        variables = shuffledPlayerIds.map(playerId => {
          const partner = partnerMap[playerId];
          if (partner === undefined) return null;
          return nameMap[partner] || String(partner);
        });
      } else {
        variables = assignVariables(mission.variable_pool, shuffledPlayerIds.length);
      }

      for (let i = 0; i < shuffledPlayerIds.length; i++) {
        await sql`
          INSERT INTO player_missions (session_id, user_id, mission_id, variable_value)
          VALUES (${sessionId}, ${shuffledPlayerIds[i]}, ${mission.id}, ${variables[i]})
          ON CONFLICT (session_id, user_id, mission_id) DO NOTHING
        `;
      }
    }

    return { success: true, phase, playerCount: playerIds.length, missionCount: missions.length };
  } catch (error) {
    console.error('Error assigning phase to players:', error);
    throw error;
  }
}

// ── Player Mission Queries ──────────────────────────────────────────────────

export async function getPlayerMissions(sessionId, userId) {
  try {
    const sessionResult = await sql`
      SELECT current_phase FROM sessions WHERE id = ${sessionId}
    `;
    if (sessionResult.length === 0) throw new Error('Session not found');
    const currentPhase = sessionResult[0].current_phase;

    const rows = await sql`
      SELECT
        pm.id as player_mission_id,
        pm.user_id,
        pm.variable_value,
        pm.completed,
        pm.completed_at,
        pm.signed_off_by,
        pm.signed_off_at,
        pm.phrase_answer,
        pm.bounty_awarded,
        ph.id as mission_id,
        ph.phase,
        ph.title,
        ph.mission_body,
        ph.completion_type,
        ph.success_key,
        ph.signoff_prompt_template,
        ph.variable_pool,
        ph.signer_constraint,
        ph.same_signer_mission_id,
        ph.sort_order,
        ph.bounty,
        ph.is_culminating,
        ph.culminating_first_only,
        ph.payment_type,
        ph.payment_min,
        signer.firstname as signer_firstname,
        signer.lastname as signer_lastname
      FROM player_missions pm
      JOIN phase_missions ph ON pm.mission_id = ph.id
      LEFT JOIN users signer ON pm.signed_off_by = signer.id
      WHERE pm.session_id = ${sessionId} AND pm.user_id = ${userId}
      ORDER BY ph.phase, ph.sort_order, ph.id
    `;

    const unlocked = unlockedPhases(rows.map(r => ({
      phase: r.phase, isCulminating: r.is_culminating, completed: r.completed
    })));
    const firsts = rows.some(r => r.culminating_first_only) ? await firstFinishers(sessionId) : {};

    return rows.map(r => {
      let missionBody = r.mission_body;
      if (r.variable_value) {
        missionBody = missionBody.replace(/\{variable\}/g, r.variable_value);
      }
      let signoffPrompt = r.signoff_prompt_template;
      if (signoffPrompt && r.variable_value) {
        signoffPrompt = signoffPrompt.replace(/\{variable\}/g, r.variable_value);
      }

      return {
        playerMissionId: r.player_mission_id,
        missionId: r.mission_id,
        phase: r.phase,
        title: r.title,
        missionBody,
        completionType: r.completion_type,
        successKey: r.success_key,
        signoffPromptTemplate: signoffPrompt,
        variableValue: r.variable_value,
        signerConstraint: r.signer_constraint,
        sameSignerMissionId: r.same_signer_mission_id,
        completed: r.completed,
        completedAt: r.completed_at,
        signedOffBy: r.signed_off_by,
        signedOffAt: r.signed_off_at,
        bounty: r.bounty || 0,
        bountyAwarded: r.bounty_awarded || 0,
        signerName: r.signer_firstname ? `${r.signer_firstname} ${r.signer_lastname}` : null,
        phaseLocked: r.phase < currentPhase,
        isCulminating: r.is_culminating,
        firstOnly: r.culminating_first_only,
        ...culminatingState(r, unlocked, firsts),
        paymentType: r.payment_type,
        paymentMin: r.payment_min,
        currentPhase
      };
    });
  } catch (error) {
    console.error('Error fetching player missions:', error);
    throw error;
  }
}

// ── Phrase Completion ───────────────────────────────────────────────────────

export async function completePhaseMission(playerMissionId, answer, userId) {
  try {
    const rows = await sql`
      SELECT pm.*, ph.completion_type, ph.success_key, ph.phase,
             ph.bounty, ph.is_culminating, ph.culminating_first_only, s.current_phase
      FROM player_missions pm
      JOIN phase_missions ph ON pm.mission_id = ph.id
      JOIN sessions s ON pm.session_id = s.id
      WHERE pm.id = ${playerMissionId}
    `;

    if (rows.length === 0) throw new Error('Mission not found');
    const mission = rows[0];

    if (mission.user_id !== userId) throw new Error('Mission not assigned to you');
    if (mission.completed) throw new Error('Mission already completed');
    if (mission.completion_type !== 'phrase') throw new Error('This mission requires a sign-off, not a phrase');
    if (mission.phase < mission.current_phase) throw new Error('This phase is locked');
    await assertCulminatingUnlocked(mission);

    const answerLower = answer?.toLowerCase().trim();
    const correctLower = mission.success_key?.toLowerCase().trim();

    if (!answerLower || !correctLower) throw new Error('Answer required');

    const isCorrect = correctLower === answerLower ||
                      correctLower.includes(answerLower) ||
                      answerLower.includes(correctLower);

    if (!isCorrect) throw new Error('Incorrect answer. Try again or talk to your handler.');

    await sql`
      UPDATE player_missions
      SET completed = true, completed_at = NOW(), phrase_answer = ${answer},
          bounty_awarded = ${mission.bounty || 0}
      WHERE id = ${playerMissionId}
    `;

    return {
      message: 'Mission completed successfully',
      bounty: mission.bounty || 0
    };
  } catch (error) {
    console.error('Error completing phase mission:', error);
    throw error;
  }
}

// ── Sign-off Completion ─────────────────────────────────────────────────────

// Sign-off that also moves money (e.g. the witness buys the player's "art").
// One transaction: lock the mission, take the money from the witness only if
// the mission is still open and they can afford it, pay the player (unless it
// goes to MacGuffin Toys), and complete the mission only if the payment
// happened. Either all of it happens or none of it does.
async function payForSignOff(mission, signer, signerName, requested) {
  const min = mission.payment_min || 0;
  const amount = requested === undefined || requested === null || requested === '' ? min : Number(requested);
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Enter a whole-dollar amount');
  if (amount < min) throw new Error(`The payment must be at least $${min.toLocaleString()}`);

  const owner = (await sql`SELECT firstname, lastname FROM users WHERE id = ${mission.user_id}`)[0];
  const ownerName = `${owner.firstname} ${owner.lastname}`;
  const toPlayer = mission.payment_type === 'witness_to_player';
  const id = mission.id;
  const sessionId = mission.session_id;

  const results = await sql.transaction([
    sql`SELECT id FROM player_missions WHERE id = ${id} FOR UPDATE`,
    sql`
      INSERT INTO bank_transactions (session_id, user_id, amount, kind, note, player_mission_id)
      SELECT ${sessionId}, ${signer.id}, ${-amount}, 'payment',
             ${`${mission.title}: paid ${toPlayer ? ownerName : 'MacGuffin Toys'}`}, ${id}
      WHERE EXISTS (SELECT 1 FROM player_missions WHERE id = ${id} AND NOT completed)
        AND COALESCE((SELECT SUM(amount) FROM bank_ledger
                      WHERE session_id = ${sessionId} AND user_id = ${signer.id}), 0) >= ${amount}::int
      RETURNING id`,
    ...(toPlayer ? [sql`
      INSERT INTO bank_transactions (session_id, user_id, amount, kind, note, player_mission_id)
      SELECT ${sessionId}, ${mission.user_id}, ${amount}, 'payment',
             ${`${mission.title}: from ${signerName}`}, ${id}
      WHERE EXISTS (SELECT 1 FROM bank_transactions
                    WHERE player_mission_id = ${id} AND kind = 'payment' AND amount < 0)
      RETURNING id`] : []),
    sql`
      UPDATE player_missions
      SET completed = true, completed_at = NOW(),
          signed_off_by = ${signer.id}, signed_off_at = NOW(),
          bounty_awarded = ${mission.bounty || 0}
      WHERE id = ${id} AND completed = false AND EXISTS (SELECT 1 FROM bank_transactions
                    WHERE player_mission_id = ${id} AND kind = 'payment' AND amount < 0)
      RETURNING signed_off_at`,
  ]);

  const updated = results[results.length - 1];
  if (updated.length === 0) {
    const [state] = await sql`SELECT completed FROM player_missions WHERE id = ${id}`;
    if (state.completed) throw new Error('Mission already completed');
    const [{ balance }] = await sql`
      SELECT COALESCE(SUM(amount), 0)::int AS balance FROM bank_ledger
      WHERE session_id = ${sessionId} AND user_id = ${signer.id}`;
    throw new Error(`${signerName} doesn't have enough money: their balance is $${balance.toLocaleString()} and this costs $${amount.toLocaleString()}`);
  }
  return { updated, amount };
}

// paymentAmount: for missions with a payment_type, what the witness agreed to
// pay (at least payment_min; defaults to it)
export async function signOffMission(playerMissionId, signerPassphrase, paymentAmount) {
  try {
    const rows = await sql`
      SELECT pm.*, ph.completion_type, ph.phase, ph.signer_constraint,
             ph.same_signer_mission_id, ph.title, ph.bounty, ph.is_culminating, ph.culminating_first_only,
             ph.payment_type, ph.payment_min,
             s.current_phase, s.id as session_id, s.participant_user_ids
      FROM player_missions pm
      JOIN phase_missions ph ON pm.mission_id = ph.id
      JOIN sessions s ON pm.session_id = s.id
      WHERE pm.id = ${playerMissionId}
    `;

    if (rows.length === 0) throw new Error('Mission not found');
    const mission = rows[0];

    if (mission.completed) throw new Error('Mission already completed');
    if (mission.completion_type !== 'signoff') throw new Error('This mission requires a phrase answer, not a sign-off');
    if (mission.phase < mission.current_phase) throw new Error('This phase is locked');
    await assertCulminatingUnlocked(mission);

    const participantIds = mission.participant_user_ids;
    if (!participantIds || participantIds.length === 0) {
      throw new Error('No participants in this session');
    }

    const enteredPassphrase = normalizePassphrase(signerPassphrase || '');
    if (!enteredPassphrase) throw new Error('Passphrase required');

    const candidates = await sql`
      SELECT id, firstname, lastname, passphrase, is_admin FROM users
      WHERE id = ANY(${participantIds}::integer[])
        AND id != ${mission.user_id}
        AND ishere = true
    `;

    const matches = candidates.filter((c) => passphraseMatchesStored(c.passphrase, enteredPassphrase));

    if (matches.length === 0) {
      throw new Error(
        'No guest in this session matched that passphrase. They must be checked in and not the mission owner.'
      );
    }
    if (matches.length > 1) {
      throw new Error('That passphrase matches more than one guest. Ask a host to fix duplicate passphrases.');
    }

    const signer = matches[0];
    const signerUserId = signer.id;

    // Enforce signer constraint
    if (mission.signer_constraint === 'new_signer') {
      const previousSignoffs = await sql`
        SELECT id FROM player_missions
        WHERE session_id = ${mission.session_id}
          AND user_id = ${mission.user_id}
          AND signed_off_by = ${signerUserId}
          AND completed = true
      `;
      if (previousSignoffs.length > 0) {
        throw new Error('This person has already signed off on one of your missions. Find someone new.');
      }
    }

    if (mission.signer_constraint === 'same_signer') {
      const refMissionId = mission.same_signer_mission_id;
      if (!refMissionId) throw new Error('Same-signer constraint configured incorrectly');

      const refResult = await sql`
        SELECT signed_off_by, completed FROM player_missions
        WHERE session_id = ${mission.session_id}
          AND user_id = ${mission.user_id}
          AND mission_id = ${refMissionId}
      `;
      if (refResult.length === 0 || !refResult[0].completed) {
        throw new Error('The referenced mission has not been completed yet');
      }
      if (refResult[0].signed_off_by !== signerUserId) {
        throw new Error('Must be signed off by the same person who signed your earlier mission');
      }
    }

    if (mission.signer_constraint === 'admin_only') {
      if (!signer.is_admin) {
        throw new Error('This mission must be signed off by a host.');
      }
    }

    const signerName = `${signer.firstname} ${signer.lastname}`.trim();
    let updated;
    let payment = null;

    if (mission.payment_type) {
      payment = await payForSignOff(mission, signer, signerName, paymentAmount);
      updated = payment.updated;
    } else {
      updated = await sql`
        UPDATE player_missions
        SET completed = true, completed_at = NOW(),
            signed_off_by = ${signerUserId}, signed_off_at = NOW(),
            bounty_awarded = ${mission.bounty || 0}
        WHERE id = ${playerMissionId} AND completed = false
        RETURNING signed_off_at
      `;
    }

    if (updated.length === 0) throw new Error('Mission already completed');

    return {
      message: 'Mission signed off successfully',
      bounty: mission.bounty || 0,
      signerName,
      signedOffAt: updated[0].signed_off_at,
      payment: payment && { amount: payment.amount, type: mission.payment_type }
    };
  } catch (error) {
    console.error('Error signing off mission:', error);
    throw error;
  }
}

// ── Admin Force-Complete ────────────────────────────────────────────────────

export async function adminCompletePhaseMission(playerMissionId) {
  try {
    const rows = await sql`
      SELECT pm.*, ph.title, ph.bounty FROM player_missions pm
      JOIN phase_missions ph ON pm.mission_id = ph.id
      WHERE pm.id = ${playerMissionId}
    `;

    if (rows.length === 0) throw new Error('Mission not found');
    const mission = rows[0];

    if (mission.completed) throw new Error('Mission already completed');

    await sql`
      UPDATE player_missions
      SET completed = true, completed_at = NOW(), bounty_awarded = ${mission.bounty || 0}
      WHERE id = ${playerMissionId}
    `;

    return {
      success: true,
      message: 'Mission completed successfully',
      bounty: mission.bounty || 0
    };
  } catch (error) {
    console.error('Error admin completing phase mission:', error);
    throw error;
  }
}

// ── Get all player missions for a session (admin overview) ──────────────────

export async function getAllPlayerMissionsForSession(sessionId) {
  try {
    const rows = await sql`
      SELECT
        pm.id as player_mission_id,
        pm.user_id,
        pm.variable_value,
        pm.completed,
        pm.completed_at,
        pm.signed_off_by,
        pm.signed_off_at,
        ph.id as mission_id,
        ph.phase,
        ph.title,
        ph.mission_body,
        ph.completion_type,
        ph.bounty,
        ph.signer_constraint,
        ph.is_culminating,
        ph.culminating_first_only,
        u.firstname,
        u.lastname,
        signer.firstname as signer_firstname,
        signer.lastname as signer_lastname
      FROM player_missions pm
      JOIN phase_missions ph ON pm.mission_id = ph.id
      JOIN users u ON pm.user_id = u.id
      LEFT JOIN users signer ON pm.signed_off_by = signer.id
      WHERE pm.session_id = ${sessionId}
      ORDER BY u.firstname, u.lastname, ph.phase, ph.sort_order, ph.id
    `;

    const firsts = rows.some(r => r.culminating_first_only) ? await firstFinishers(sessionId) : {};
    const unlockedByUser = {};
    for (const userId of new Set(rows.map(r => r.user_id))) {
      unlockedByUser[userId] = unlockedPhases(rows.filter(r => r.user_id === userId).map(r => ({
        phase: r.phase, isCulminating: r.is_culminating, completed: r.completed
      })));
    }

    return rows.map(r => {
      let missionBody = r.mission_body;
      if (r.variable_value) {
        missionBody = missionBody.replace(/\{variable\}/g, r.variable_value);
      }
      return {
        playerMissionId: r.player_mission_id,
        userId: r.user_id,
        isCulminating: r.is_culminating,
        firstOnly: r.culminating_first_only,
        ...culminatingState(r, unlockedByUser[r.user_id], firsts),
        playerName: `${r.firstname} ${r.lastname}`,
        missionId: r.mission_id,
        phase: r.phase,
        title: r.title,
        missionBody,
        completionType: r.completion_type,
        signerConstraint: r.signer_constraint,
        variableValue: r.variable_value,
        completed: r.completed,
        completedAt: r.completed_at,
        bounty: r.bounty || 0,
        signedOffBy: r.signed_off_by,
        signerName: r.signer_firstname ? `${r.signer_firstname} ${r.signer_lastname}` : null
      };
    });
  } catch (error) {
    console.error('Error fetching all player missions for session:', error);
    throw error;
  }
}
