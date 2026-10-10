# Press Me

A phone-based companion app for a live, in-person spy party game. Guests sign in on their phones and receive missions in acts ("phases"), carry them out in the room, and prove completion by getting another guest to sign off with their secret passphrase. Mission bounties are deposited into each player's bank account, which they spend on small prizes at a staffed bank. Hosts run the night from an admin dashboard: starting the session, advancing phases, and sending ad-hoc missions.

## Architecture

- **Frontend:** React 19 single-page app built with Vite, routed with `react-router-dom`.
- **Database:** Neon (serverless Postgres).
- **No backend.** The browser talks to Neon directly through `@neondatabase/serverless`; all game logic lives in `src/api/`. The `server/` folder only holds Node scripts you run by hand to set up and maintain the database.

> **Security model:** the database connection string is compiled into the browser bundle, passphrases are stored in plain text, and role checks happen client-side. Staff pages do require a separate sign-in (name + hashed staff PIN, a server-side session token, roles re-read from the database), which keeps guests from walking or tinkering their way in. It won't stop someone who extracts the connection string from the bundle. The app is hosted on Vercel only so guests don't need to join local wi-fi; they reach it through per-player QR/NFC login links, groups are small, and there's little to gain from attacking it, so this is an accepted trade-off. Revisit it if the game ever handles anything sensitive.

```
press-me/
├── src/
│   ├── App.jsx              # Routes; keeps the signed-in user in localStorage ('spyUser')
│   ├── Login.jsx            # Player sign-in (name or alias)
│   ├── Dashboard.jsx        # Player view: missions, sign-offs, push missions
│   ├── BankStrip.jsx        # Player's balance in the footer + statement
│   ├── MissionsTab.jsx      # Mission list grouped by phase
│   ├── AgentTab.jsx         # Reveal-on-tap passphrase
│   ├── StaffLogin.jsx       # Staff sign-in at /staff (name + staff PIN)
│   ├── StaffGate.jsx        # Guards /admin and /bank by role, checked against the DB
│   ├── AdminDashboard.jsx   # Host view: Sessions / Missions / Users / Push tabs
│   ├── BankPage.jsx         # Banker view at /bank: balances, withdrawals, corrections
│   ├── AwardsPage.jsx       # Host presenter screen at /awards for the end-of-game ceremony
│   ├── neonApi.js           # Single `neonApi` object the components call
│   └── api/
│       ├── db.js            # Neon connection (browser)
│       ├── auth.js          # Player sign-in, login logging
│       ├── staff.js         # Staff sign-in, sessions, PINs (pin.js: hashing)
│       ├── bank.js          # Statements, balances, withdrawals
│       ├── awards.js        # Ceremony awards: rankings and winner selection
│       ├── timestamps.js    # Reads DB timestamps as UTC (see Troubleshooting)
│       ├── users.js
│       ├── sessions.js      # Session lifecycle and phase advancement
│       ├── phaseMissions.js # Mission catalogue, assignment, completion, sign-off rules
│       └── pushMissions.js  # Host-to-player ad-hoc missions
├── server/                  # Database scripts (not a running server)
│   ├── db.js                # Shared connection, reads server/.env
│   ├── setup-neon.js        # Creates all tables — schema source of truth
│   ├── setup-phase-missions.js  # Seeds the mission catalogue (destructive)
│   ├── generate-login-urls.js   # Per-player one-tap login URLs for QR/NFC
│   ├── update-passphrases.js    # Reassigns single-word passphrases
│   └── set-staff-pin.js     # Gives someone a staff PIN (and role)
├── arduino/                 # Experimental button-logger sketch (not wired into the app)
├── mission_ideas.md         # Design notes for the current mission set
└── public/                  # Favicon and briefing seal image
```

## Setup

Prerequisites: Node.js 18+ and a Neon project ([neon.tech](https://neon.tech), free tier is fine).

```bash
npm install                       # frontend
cd server && npm install          # database scripts
```

### Point the app at your database

The connection string lives in **two** places:

1. `server/.env` — used by the scripts. Copy `server/env.example` and set `POSTGRES_URL`.
2. `src/api/db.js` — used by the browser. Update `DATABASE_URL` there too.

### Create the tables

```bash
cd server
npm run setup-db
```

This only creates missing tables and indexes and never touches existing data, so it is safe to re-run after pulling schema changes. Add new tables or columns here (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).

### Seed the missions

```bash
cd server
npm run seed-missions -- --yes
```

⚠️ This deletes the whole mission catalogue **and every player's mission progress in every session**, then inserts the missions defined in `setup-phase-missions.js`. Missions can also be added and edited without a reseed from the admin dashboard's **Missions** tab.

### Create the first host

A fresh database has no users, and new users are added from the admin dashboard's **Users** tab, so insert the first host by hand (Neon SQL editor or `psql`), then give them a staff PIN:

```sql
INSERT INTO users (id, firstname, lastname, alias_1, alias_2, passphrase, is_admin)
VALUES (1, 'Jane', 'Host', 'Silent', 'Owl', 'raven', true);
```

```bash
cd server
npm run set-staff-pin -- "Jane Host" 482913 --host
```

After that, hosts give other staff roles and PINs from **Users → Edit**. The same script works for anyone (`--host` and/or `--banker`).

### Run it

```bash
npm run dev       # http://localhost:5173, also exposed on your LAN for guests' phones
npm run build     # production build in dist/
npm run lint
```

`vercel.json` rewrites every path to `index.html` so client-side routes work if you deploy to Vercel.

## How the game works

### Signing in

- **Players** go to `/` and enter their real name (`First Last`) or their two-word alias (`Swift Spider`, `swift_spider`, or `SwiftSpider`). No passphrase is needed to sign in. Only users with `ishere = true` can sign in.
- **One-tap login:** `/login/<base64 of name or alias>` signs a player straight in, which is handy on a QR code or NFC tag. `cd server && npm run login-urls` prints one for every player.
- **Staff** (hosts and bankers) go to `/staff` and sign in with their name and **staff PIN**. Hosts land on `/admin`, bankers on `/bank`. A player sign-in never grants staff access, even for a host's own account.

Sign-ins are recorded in `login_logs`. The signed-in player is cached in `localStorage`, so a refresh keeps them signed in.

### Staff roles and access

| Role | Flag | Can use |
| --- | --- | --- |
| Host | `users.is_admin` | `/admin` (everything), `/bank` and `/awards` |
| Banker | `users.is_banker` | `/bank` only |

- **Staff PINs** are 4–8 digits and separate from passphrases, which players see whenever a host signs off a mission. They're stored hashed (PBKDF2), so **Show PW** can't reveal them. Set them in **Users → Edit** or with `npm run set-staff-pin`.
- Signing in creates a row in `staff_sessions` (valid 24 hours). The browser keeps only the token. `/admin` and `/bank` look up the person's current roles through it on load and every minute, so removing a role takes effect on screens that are already open. Logging out deletes the token.
- Five wrong PINs for a name within 15 minutes locks that name out for 15 minutes.
- Old `/admin/login` links redirect to `/staff`.

### Briefing

Players see the briefing ([src/Briefing.jsx](src/Briefing.jsx)) the first time they open the dashboard, and again from the **Briefing** row at any time. It includes the informant's recording, `public/honeybear-intro-message.wav`. Phones load a compressed copy, `honeybear-intro-message.m4a` (about 0.5 MB instead of 6 MB), and fall back to the WAV. If you replace the recording, regenerate the copy with `afconvert -f m4af -d aac -b 128000 public/honeybear-intro-message.wav public/honeybear-intro-message.m4a`. If neither file loads, the play button shows "Recording unavailable" and points players to the transcript. When you rewrite the briefing, change `BRIEFING_SEEN_KEY` in `Dashboard.jsx` so everyone sees the new version once.

### Passphrases and sign-offs

Every guest has a secret passphrase, which they can reveal on their **Agent** tab. Passphrases are how missions get verified: when you finish a mission, a witness types *their* passphrase into *your* phone. The app checks it against every other checked-in participant in the session to identify the signer. Matching ignores case and punctuation, and either the full phrase or just its last word is accepted.

Passphrases must be unique within a session. `npm run reassign-passphrases` previews a fresh set of distinct single words, and `-- --apply` writes them.

### Phases and missions

`phase_missions` is the global catalogue. Each mission belongs to a phase:

| Phase | Name | Current missions |
| --- | --- | --- |
| 0 | Icebreaker | Introduce yourself to three different people |
| 1 | Act I | Operation Live to Serve, House Always Wins, Thin Blue Liar, MLM, New Hire |
| 2 | Act II | Operation Lost Shirt, False Fracas, Don't I Know You?, But Is It Art?, Prodigal Son |
| 3 | Act III | Operation Foreign Investment, Stop Where You Are, Over There |

When a session starts, every participant gets all phase 0 missions. **Advance to Phase N** gives everyone the next phase's missions and locks the previous phase, so locked missions can't be completed any more. Each player's copy of a mission is a row in `player_missions`.

Mission options (editable in the **Missions** tab):

- **Completion type**
  - `signoff`: a witness confirms with their passphrase. All current missions use this.
  - `phrase`: the player types an answer that's checked against `success_key`.
- **Signer constraint** (sign-off missions only)
  - `any`: any other participant.
  - `new_signer`: someone who hasn't yet signed any of this player's missions. Used by the icebreakers.
  - `same_signer`: must be whoever signed the linked mission. Prodigal Son must be signed by the New Hire signer.
  - `admin_only`: a host must sign.
- **Variables:** `{variable}` in the mission body is filled per player.
  - `pool`: a random pick from a comma-separated list.
  - `participants`: another player's name, paired so A↔B are assigned to each other. Used by False Fracas.
- **Sign-off prompt:** the sentence the witness sees before signing, for example "`{player_name}` served me food…".
- **Culminating:** hidden until the player finishes the rest of the phase. See below.
- **Payment at sign-off** (sign-off missions only): the witness's sign-off also moves money, so a mission like "sell your art for at least $300" uses the real bank. Choose **Witness pays the player** (e.g. But Is It Art?, at least $300) or **Witness pays MacGuffin Toys** (e.g. MLM, at least $500; the money just leaves their account).
  - The phone shows the payment on the sign-off step. It starts at the minimum and the witness can raise it.
  - Payment and completion happen together or not at all: if the witness can't afford it, the sign-off fails and nothing changes.
  - A database rule means a mission can only be paid for once.
  - The host **Complete** button skips the payment. Casino missions use physical chips instead; the bank sells and cashes them.
- **Bounty:** dollars deposited into the player's bank account the moment the mission is completed. See Banking below.

### Culminating missions

A mission marked **Culminating** (a checkbox in the Missions tab) is a phase's finale. Every player is assigned it when the phase starts, but it stays hidden on their phone until they've completed every other mission in that phase. Admin force-completes count toward that.

- When it unlocks, the phone announces it ("Phase N complete … see your handler for more information") once, and the mission appears at the top of the list as a highlighted card.
- Ticking **Culminating** defaults the mission to a host sign-off (`admin_only`) with the body "See your handler for more information." Both can be changed.
- The server refuses to complete a culminating mission before it's unlocked.
- In the admin **Users** tab, a **Waiting for a handler** box lists everyone with an unlocked, unfinished culminating mission. Each player card shows the mission's progress, e.g. "hidden until 3/5 done".
- **First agent only** (a second checkbox) gives the mission only to the first agent to finish the phase's other missions, using the same rule as the First Past the Post award. Nobody else ever sees it. In the admin view, everyone who finished later shows "another agent finished first", with no Complete button.
- Like any mission, it locks when you advance past its phase.

### Push missions

From the **Push** tab a host can send a one-off mission (title, body, bounty) to a single player during an active session. It pops up on the player's phone to acknowledge. When the host marks it complete, the player sees the completion and the bounty is deposited into their bank account.

### Banking

Each player has a bank account per session (everyone starts at $0 each event), in dollars.

- **Deposits are automatic.** Completing a mission deposits its bounty, whether by sign-off, answer, or a host's **Complete** button. So does a completed push mission. The amount is recorded at completion (`player_missions.bounty_awarded`), so editing a mission's bounty later doesn't change anyone's history.
- **Players** see their balance in a **BANK** strip at the bottom of their phone. Tapping it opens their statement. The mission success screen says "$400 deposited!".
- **Bankers** use `/bank` (hosts reach it from the admin header). It's built for a busy prize table:
  - Every player row has **−$100 / −$500 / −$1,000** buttons. One tap deducts immediately, with no confirmation or note. Buttons grey out when the player can't afford them. Search narrows the list by name or alias.
  - Mistakes are fixed with **Undo** in the bar pinned to the bottom of the screen. It shows the banker's last few deductions, and Undo works for 5 minutes, only on their own deductions. An undone deduction is deleted, so it doesn't clutter the player's history.
  - **Adding money** takes more steps on purpose: tap the player's name, enter an amount and a required reason, then confirm. The same screen has **Spend another amount** for odd prices, plus the full history.
  - A balance can never go below zero; the check happens in the same database statement as the deduction. Every transaction records which banker made it, and the player sees it in their statement.
  - The bank works while the session is active or paused.
- **Sign-off payments** appear on both players' statements as "Payment", e.g. "Operation But Is It Art?: paid Katherine Ramos" and "…: from Ryan Swan".
- Balances come from the `bank_ledger` view: mission deposits + push-mission deposits + `bank_transactions`, which holds banker withdrawals and corrections.

### Award ceremony

At the end of the night a host opens **Awards** from the admin header (or `/awards`) on a laptop or TV. It defaults to the running session, and any other session can be picked from the intro screen. **Recalculate** refreshes the results.

**Controls:** tap the screen, or press Space or →, to reveal the winner, then again to move on. ← goes back, and **Fullscreen** hides the browser.

| # | Award | Winner |
| --- | --- | --- |
| 1 | Social Butterfly | Most *different* agents who signed off their missions |
| 2 | Partners in Crime | The pair with the most sign-offs between them (pairs who vouched both ways rank first) |
| 3 | The Vault | Most money left unspent in the bank |
| 4–6 | First Past the Post: Act I / II / III | First to complete every regular mission in that act |
| 7 | Top Agent | Most money earned (deposits, ignoring spending) |

- **One award each:** Top Agent, Partners in Crime, Social Butterfly and The Vault never go to someone who already won one of them. They're assigned in that order, so if a leader already has an award, it passes to the next-best player. Each slide still shows the top three, plus a note when this happens.
- **First Past the Post is exempt:** it always goes to whoever really finished first, even if they win another award or several acts.
- **Ties** go to whoever reached the score first.
- **Empty awards:** if nobody qualifies (e.g. nobody finished Act III), the slide says so.

### Running a session (hosts)

1. **Sessions → Create New Session.** Name it and pick participants. It starts as a *draft*.
2. **Start Session.** Status becomes *active* and phase 0 is assigned. Only one session can be active at a time.
3. **Advance to Phase 1 / 2 / 3** as the night progresses.
4. Watch per-player progress in the expanded session. **Complete Mission** force-completes a stuck mission.
5. **Pause / Resume** as needed, then **End Session**.
6. **Reset** (paused or ended sessions only) clears all mission progress and returns the session to draft.

Players' phones poll the database: missions and push missions every 5 seconds, session status and bank balance every 10. The admin **Users** and **Push** tabs refresh the running session every 15 seconds, the bank screen every 15, and staff sign-ins are rechecked every minute.

### Adding and editing players (including mid-game)

The **Users** tab lists every user, with an **Edit** button on each player and on each participant card in the active session.

- **Add Player** creates a new user or picks an existing one (a returning guest). If a session is active, it also adds them to it and assigns the **current phase's** missions straight away. Earlier phases are locked, so they're skipped, and later phases include them automatically when you advance. Missions that pair players ("start a fight with `{variable}`") pair late joiners with each other first; otherwise with a random existing player.
- After saving, the modal shows the player's login link, ready to copy onto a QR code or NFC tag.
- **Edit** changes name, aliases, passphrase, checked-in status, staff roles (host/banker) and staff PIN. It's safe mid-game: missions reference players by id. Changing an alias changes the player's login link. A changed passphrase appears on the player's phone the next time they open or reveal it.
- Names, aliases and passphrases (by last word) must be unique, because they're what sign-in and sign-off match on. Duplicates are rejected.
- Adding participants to a **paused** session via **Edit** also assigns them the current phase's missions.

## Database

Tables used by the app (defined in `server/setup-neon.js`):

| Table | Purpose |
| --- | --- |
| `users` | Guests and staff: name, two-word alias, passphrase, `ishere`, `is_admin` (host), `is_banker`, hashed staff PIN |
| `login_logs` | Sign-in attempts |
| `sessions` | Game nights: status, participants, `current_phase` |
| `phase_missions` | Mission catalogue |
| `player_missions` | Per-session, per-player mission state: completion, signer, `bounty_awarded` |
| `push_missions` | Host-sent ad-hoc missions and their acknowledge/complete/seen state |
| `staff_sessions` | Signed-in staff tokens (24-hour expiry) |
| `bank_transactions` | Banker withdrawals and corrections |
| `bank_ledger` (view) | Every money movement per player per session; balance = `SUM(amount)` |

The live database also contains tables left over from earlier versions of the game (`book_missions`, `agent_intel`, `teams`, `missions_legacy`, `button_events`, and others), plus unused `users.team`, `users.score`, `sessions.voting_open`, and `bounty_paid` columns (from the old cash payout). Nothing reads them.

## Troubleshooting

- **App loads but nothing works:** open the browser console. `src/api/db.js` logs whether it connected to Neon.
- **Times look hours off:** the database stores timestamps in UTC without a timezone. `src/api/timestamps.js`, registered in `src/api/db.js`, makes the app read them as UTC. Check that the registration is still there.
- **"No guest in this session matched that passphrase":** the signer must be a participant in the active session, checked in (`ishere = true`), and not the mission owner.
- **"That passphrase matches more than one guest":** two participants share a passphrase. Run `npm run reassign-passphrases`.
- **Scripts say "Missing database URL":** set `POSTGRES_URL` in `server/.env`.
