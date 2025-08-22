# Spy Database Server

Express server with PostgreSQL backend for the spy database application.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Setup Instructions

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

### 2. Create PostgreSQL User

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create a new user (replace 'your_username' and 'your_password')
CREATE USER your_username WITH PASSWORD 'your_password';
ALTER USER your_username CREATEDB;
\q
```

### 3. Install Dependencies

```bash
cd server
npm install
```

### 4. Environment Configuration

Create a `.env` file in the server directory:

```bash
cp env.example .env
```

Edit `.env` with your database credentials:

```env
DB_USER=your_username
DB_HOST=localhost
DB_NAME=spy_database
DB_PASSWORD=your_password
DB_PORT=5432
PORT=3001
NODE_ENV=development
```

### 5. Setup Database

```bash
# Run the setup script
npm run setup-db

# Or manually run the setup script
node setup.js
```

### 6. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on port 3001 (or the port specified in your .env file).

## API Endpoints

### Authentication
- `POST /api/auth/login` - Authenticate user with codename and password
  - Body: `{ "codename": "SHADOWFOX", "password": "password123" }`
  - Returns: `{ "success": true, "user": {...} }` or `{ "success": false, "message": "..." }`

### Users
- `GET /api/users` - Get all users (id, codename, team, status)
- `GET /api/users/random` - Get a random user codename
- `GET /api/users/team/:team` - Get users by team (red/blue)

### Teams
- `GET /api/teams/:team/points` - Get team points
- `PUT /api/teams/:team/points` - Update team points
  - Body: `{ "points": 100 }`

### Missions
- `GET /api/missions` - Get all missions
- `GET /api/missions/available` - Get available (unassigned) missions
- `PUT /api/missions/:id/assign` - Assign mission to agent
  - Body: `{ "agentId": 1 }`
- `PUT /api/missions/:id/complete` - Mark mission as completed
  - Body: `{ "teamPoints": { "team": "red", "points": 50 } }`

### Intel
- `GET /api/intel` - Get all intel clues
- `POST /api/intel` - Add new intel clue
  - Body: `{ "clueText": "Secret message", "agentsWhoKnow": [1, 2, 3] }`

### Login Logs
- `POST /api/logs/login` - Log a login attempt
  - Body: `{ "agentName": "SHADOWFOX", "success": true, "ipAddress": "127.0.0.1", "userAgent": "..." }`
- `GET /api/logs/stats` - Get login statistics

### Health & Testing
- `GET /api/health` - Server health status
- `GET /api/test` - Simple test endpoint

## Database Schema

### Users Table
- `id` - Primary key
- `real_name` - Agent's real name (unique)
- `password` - Authentication password
- `codename` - Agent code name (unique)
- `team` - Team assignment (red/blue)
- `initial_intel` - Starting intelligence
- `votes` - Array of voting choices
- `created_at` - Timestamp

### Teams Table
- `id` - Primary key
- `name` - Team name (red/blue)
- `points` - Team score

### Missions Table
- `id` - Mission ID (primary key)
- `title` - Mission title
- `completed` - Completion status
- `mission_body` - Mission description
- `assigned_agent` - Currently assigned agent ID
- `past_assigned_agents` - Array of previously assigned agents
- `assigned_now` - Whether mission is currently assigned
- `mission_expires` - Mission expiration timestamp

### Intel Table
- `id` - Primary key
- `clue_text` - Intelligence clue text
- `agents_who_know` - Array of agent IDs who know this intel

### Toys Table
- `id` - Primary key
- `name` - Toy/reward name
- `points` - Point value

### Login Logs Table
- `id` - Primary key
- `agent_name` - Agent attempting login
- `success` - Login success status
- `ip_address` - IP address of login attempt
- `user_agent` - Browser/user agent string
- `timestamp` - Login attempt timestamp

## Game Features

### Team-Based System
- **Red Team** vs **Blue Team** competition
- **Point scoring** for completed missions
- **Agent assignments** to specific teams

### Mission System
- **Dynamic assignment** of missions to agents
- **Mission tracking** with completion status
- **Team points** awarded for successful completion

### Intelligence System
- **Clue sharing** between agents
- **Knowledge tracking** of who knows what
- **Strategic gameplay** elements

### Security Features
- **Authentication** against database
- **Login attempt logging** with IP tracking
- **Failed attempt counting** with lockout system

## Troubleshooting

### Connection Issues
- Verify PostgreSQL is running
- Check database credentials in .env file
- Ensure database and tables exist

### Permission Issues
- Verify PostgreSQL user has proper permissions
- Check if database exists and is accessible

### Port Conflicts
- Change PORT in .env file if 3001 is already in use
- Ensure no other services are using the same port

### Authentication Issues
- Verify user exists in database
- Check password matches stored value
- Ensure login_logs table exists

## Development

The server uses:
- **Express.js** - Web framework
- **pg** - PostgreSQL client
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management
- **nodemon** - Development auto-restart (dev dependency)

## Security Notes

- **Passwords are stored in plain text** - In production, implement proper hashing
- **IP addresses are logged** - Consider privacy implications
- **No rate limiting** - Consider implementing for production use
- **CORS enabled** - Configure appropriately for production 

## TO DO

- **Refactor to use routing** - React Router Dom sucks now so...gotta figure that out.
- **Mock out Missions Page** - Dummy data for three missions with 20 minute timers
- **Editor for adding new missions** - Can be pretty bare bones as only Nikki and I will ever see it.
- **Ability to complete missions** - Probably by entering some sort of password solution
