// Replaces the mission catalogue (phase_missions) with the missions defined below.
// DESTRUCTIVE: also deletes every player_missions row, i.e. all mission progress
// for every session. Run setup-neon.js first so the tables exist.
//
// Usage: cd server && npm run seed-missions -- --yes
import { sql } from './db.js';

if (!process.argv.includes('--yes')) {
  console.error('This deletes all phase missions and ALL player mission progress.');
  console.error('Re-run with --yes to continue:  npm run seed-missions -- --yes');
  process.exit(1);
}

async function setupPhaseMissions() {
  try {
    // Clear old data and reseed
    const existing = await sql`SELECT count(*) as cnt FROM phase_missions`;
    if (existing[0].cnt > 0) {
      console.log(`  Found ${existing[0].cnt} existing rows — clearing for reseed`);
      await sql`DELETE FROM player_missions WHERE mission_id IN (SELECT id FROM phase_missions)`;
      await sql`DELETE FROM phase_missions`;
      await sql`ALTER SEQUENCE phase_missions_id_seq RESTART WITH 1`;
    }

    console.log('Seeding phase missions...');

    // ── Phase 0: Icebreaker ──
    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (0, 'Introduction I', 'Introduce yourself to someone and learn their real name. Get them to sign off with their passphrase.', 'signoff', 'I met {player_name} and we introduced ourselves.', 'new_signer', 1, 0)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (0, 'Introduction II', 'Introduce yourself to someone new and learn their real name. Get them to sign off with their passphrase.', 'signoff', 'I met {player_name} and we introduced ourselves.', 'new_signer', 2, 0)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (0, 'Introduction III', 'Introduce yourself to a third person and learn their real name. Get them to sign off with their passphrase.', 'signoff', 'I met {player_name} and we introduced ourselves.', 'new_signer', 3, 0)`;

    // ── Phase 1 (Act I) ──
    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (1, 'Operation Live to Serve', 'Dress up in the waiter uniform and serve another guest food and/or drink. Get them to confirm the service.', 'signoff', '{player_name} served me food and/or drink while dressed as a waiter.', 'any', 1, 200)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (1, 'Operation House Always Wins', 'Put on a disguise and run the gambling table until you get a tip from another guest.', 'signoff', 'I tipped {player_name} while they were running the gambling table.', 'any', 2, 100)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (1, 'Operation Thin Blue Liar', 'Get the police badge and interrogate your hosts for information on the secret discovery.', 'signoff', '{player_name} interrogated me while wearing a police badge.', 'any', 3, 300)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (1, 'Operation MLM', 'Disguise yourself as a wealthy patron and convince a guest to give at least 500 to our hosts to invest in the toy company.', 'signoff', '{player_name} convinced me to invest in the toy company.', 'any', 4, 300)`;

    const newHire = await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (1, 'Operation New Hire', 'Create a new cover identity with an identifiable profession and convince another guest that you are an upstanding member of that profession.', 'signoff', '{player_name} convinced me they are a professional in their claimed field.', 'any', 5, 250)
      RETURNING id`;

    // ── Phase 2 (Act II) ──
    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (2, 'Operation Lost Shirt', 'Go play at the gambling table and lose at least 500.', 'signoff', '{player_name} lost at least 500 at my gambling table.', 'any', 1, 200)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, variable_source, signer_constraint, sort_order, bounty)
      VALUES (2, 'Operation False Fracas', 'Start a fight with {variable} until one of the hosts comes to check on you.', 'signoff', '{player_name} and I got into a fight and the hosts had to check on us.', 'participants', 'any', 2, 250)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (2, 'Operation Don''t I Know You?', 'Get another guest to give you their autograph and then show it to your hosts.', 'signoff', 'I gave {player_name} my autograph.', 'any', 3, 100)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (2, 'Operation But Is It Art?', 'Wear the beret and convince another guest to buy your "art" for at least 300. Get them to fill out a form confirming the purchase.', 'signoff', 'I purchased art from {player_name} for at least 300.', 'any', 4, 100)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, same_signer_mission_id, sort_order, bounty)
      VALUES (2, 'Operation Prodigal Son', 'Wear a new disguise and convince the same person who signed off on Operation New Hire that you are a long lost relative.', 'signoff', '{player_name} convinced me they are my long lost relative.', 'same_signer', ${newHire[0].id}, 5, 400)`;

    // ── Phase 3 (Act III) ──
    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (3, 'Operation Foreign Investment', 'Don a new disguise and pose as a foreign investor with an outrageous accent. Convince the hosts that they need to act normal for the "foreign investors."', 'signoff', '{player_name} posed as a foreign investor and I played along.', 'any', 1, 500)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (3, 'Operation Stop Where You Are', 'Disguise yourself as the police again and de-escalate the situation with the hosts.', 'signoff', '{player_name} de-escalated the situation while disguised as police.', 'any', 2, 500)`;

    await sql`INSERT INTO phase_missions (phase, title, mission_body, completion_type, signoff_prompt_template, signer_constraint, sort_order, bounty)
      VALUES (3, 'Operation Over There', 'Create a distraction so the current holder of The Technology can hide it or pass it to another guest.', 'signoff', '{player_name} created a distraction that helped me move The Technology.', 'any', 3, 500)`;

    // Verify
    const counts = await sql`SELECT phase, count(*) as cnt FROM phase_missions GROUP BY phase ORDER BY phase`;
    for (const row of counts) {
      console.log(`  Phase ${row.phase}: ${row.cnt} missions`);
    }

    console.log('\n✓ Phase missions seeded successfully');
  } catch (err) {
    console.error('Error setting up phase missions:', err);
    process.exit(1);
  }
}

setupPhaseMissions();
