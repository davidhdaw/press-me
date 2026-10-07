# Press Me

A phone-based companion app for a live, in-person spy party game. Guests sign in on their phones and receive missions in acts ("phases"), carry them out in the room, and prove completion by getting another guest to sign off with their secret passphrase. Hosts run the night from an admin dashboard: starting the session, advancing phases, sending ad-hoc missions, and paying out bounties.

## Architecture

- **Frontend:** React 19 single-page app built with Vite, routed with `react-router-dom`.
- **Database:** Neon (serverless Postgres).
- **No backend.** The browser talks to Neon directly through `@neondatabase/serverless`; all game logic lives in `src/api/`. The `server/` folder only holds Node scripts you run by hand to set up and maintain the database.

> **Security model:** the database connection string is compiled into the browser bundle, passphrases are stored in plain text, and admin checks happen client-side. The app is hosted on Vercel only so guests don't need to join local wi-fi; they reach it through per-player QR/NFC login links, groups are small, and there's little to gain from attacking it, so this is an accepted trade-off. Revisit it if the game ever handles anything sensitive.

```
press-me/
├── src/
│   ├── App.jsx              # Routes; keeps the signed-in user in localStorage ('spyUser')
│   ├── Login.jsx            # Player sign-in (name or alias)
│   ├── Dashboard.jsx        # Player view: missions, sign-offs, push missions, bounty payout
│   ├── MissionsTab.jsx      # Mission list grouped by phase
│   ├── AgentTab.jsx         # Reveal-on-tap passphrase
│   ├── AdminLogin.jsx       # Host sign-in (name + passphrase)
│   ├── AdminDashboard.jsx   # Host view: Sessions / Missions / Users / Push tabs
│   ├── neonApi.js           # Single `neonApi` object the components call
│   └── api/
│       ├── db.js            # Neon connection (browser)
│       ├── auth.js          # Player and admin sign-in, login logging
│       ├── users.js
│       ├── sessions.js      # Session lifecycle and phase advancement
│       ├── phaseMissions.js # Mission catalogue, assignment, completion, sign-off rules
│       └── pushMissions.js  # Host-to-player ad-hoc missions
├── server/                  # Database scripts (not a running server)
│   ├── db.js                # Shared connection, reads server/.env
│   ├── setup-neon.js        # Creates all tables — schema source of truth
│   ├── setup-phase-missions.js  # Seeds the mission catalogue (destructive)
│   ├── generate-login-urls.js   # Per-player one-tap login URLs for QR/NFC
│   └── update-passphrases.js    # Reassigns single-word passphrases
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

A fresh database has no users, and new users are added from the admin dashboard's **Users** tab, so insert the first host by hand (Neon SQL editor or `psql`):

```sql
INSERT INTO users (id, firstname, lastname, alias_1, alias_2, passphrase, is_admin)
VALUES (1, 'Jane', 'Host', 'Silent', 'Owl', 'raven', true);
```

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
- **Hosts** go to `/admin/login`, enter their name, see their passphrase with the last word hidden, and type the last word (or the whole phrase). Requires `is_admin = true`.

Sign-ins are recorded in `login_logs`. The signed-in user is cached in `localStorage`, so a refresh keeps them signed in.

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
- **Bounty:** play-money reward. After completion the player's phone shows the bounty, and a host taps **Mark as paid** once they've handed it over.

### Culminating missions

A mission marked **Culminating** (a checkbox in the Missions tab) is a phase's finale. Every player is assigned it when the phase starts, but it stays hidden on their phone until they've completed every other mission in that phase. Admin force-completes count toward that.

- When it unlocks, the phone announces it ("Phase N complete … see your handler for more information") once, and the mission appears at the top of the list as a highlighted card.
- Ticking **Culminating** defaults the mission to a host sign-off (`admin_only`) with the body "See your handler for more information." Both can be changed.
- The server refuses to complete a culminating mission before it's unlocked.
- In the admin **Users** tab, a **Waiting for a handler** box lists everyone with an unlocked, unfinished culminating mission. Each player card shows the mission's progress, e.g. "hidden until 3/5 done".
- Like any mission, it locks when you advance past its phase.

### Push missions

From the **Push** tab a host can send a one-off mission (title, body, bounty) to a single player during an active session. It pops up on the player's phone to acknowledge. When the host marks it complete, the player sees the completion and the bounty is paid out the same way.

### Running a session (hosts)

1. **Sessions → Create New Session.** Name it and pick participants. It starts as a *draft*.
2. **Start Session.** Status becomes *active* and phase 0 is assigned. Only one session can be active at a time.
3. **Advance to Phase 1 / 2 / 3** as the night progresses.
4. Watch per-player progress in the expanded session. **Complete Mission** force-completes a stuck mission.
5. **Pause / Resume** as needed, then **End Session**.
6. **Reset** (paused or ended sessions only) clears all mission progress and returns the session to draft.

Players' phones poll every 5 seconds for session changes, missions, and push missions.

### Adding and editing players (including mid-game)

The **Users** tab lists every user, with an **Edit** button on each player and on each participant card in the active session.

- **Add Player** creates a new user or picks an existing one (a returning guest). If a session is active, it also adds them to it and assigns the **current phase's** missions straight away. Earlier phases are locked, so they're skipped, and later phases include them automatically when you advance. Missions that pair players ("start a fight with `{variable}`") pair late joiners with each other first; otherwise with a random existing player.
- After saving, the modal shows the player's login link, ready to copy onto a QR code or NFC tag.
- **Edit** changes name, aliases, passphrase, checked-in status, or host status. It's safe mid-game: missions reference players by id. Changing an alias changes the player's login link. A changed passphrase appears on the player's phone the next time they open or reveal it.
- Names, aliases and passphrases (by last word) must be unique, because they're what sign-in and sign-off match on. Duplicates are rejected.
- Adding participants to a **paused** session via **Edit** also assigns them the current phase's missions.

## Database

Tables used by the app (defined in `server/setup-neon.js`):

| Table | Purpose |
| --- | --- |
| `users` | Guests and hosts: name, two-word alias, passphrase, `ishere`, `is_admin` |
| `login_logs` | Sign-in attempts |
| `sessions` | Game nights: status, participants, `current_phase` |
| `phase_missions` | Mission catalogue |
| `player_missions` | Per-session, per-player mission state: completion, signer, bounty paid |
| `push_missions` | Host-sent ad-hoc missions and their acknowledge/complete/seen/paid state |

The live database also contains tables left over from earlier versions of the game (`book_missions`, `agent_intel`, `teams`, `missions_legacy`, `button_events`, and others), plus unused `users.team`, `users.score`, and `sessions.voting_open` columns. Nothing reads them.

## Troubleshooting

- **App loads but nothing works:** open the browser console. `src/api/db.js` logs whether it connected to Neon.
- **"No guest in this session matched that passphrase":** the signer must be a participant in the active session, checked in (`ishere = true`), and not the mission owner.
- **"That passphrase matches more than one guest":** two participants share a passphrase. Run `npm run reassign-passphrases`.
- **Scripts say "Missing database URL":** set `POSTGRES_URL` in `server/.env`.
