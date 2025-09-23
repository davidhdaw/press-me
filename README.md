# Press Me - Spy Game Application

A React-based spy game application with a PostgreSQL backend, featuring team-based missions, agent authentication, and real-time mission tracking.

## 🎯 Game Overview

Press Me is an interactive spy game where players take on the role of secret agents competing in teams. Players receive missions, complete objectives, and earn points for their team while avoiding detection by opposing agents.

### Key Features
- **Team-based gameplay** (Red vs Blue teams)
- **Dynamic mission assignment** with 15-minute time limits
- **Agent authentication** with codename system
- **Real-time mission tracking** and completion
- **Intelligence sharing** between team members
- **Mission categories**: Social, Sabotage, Team, and Object missions

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**

### 1. Clone the Repository
```bash
git clone <repository-url>
cd press-me
```

### 2. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd server
npm install
cd ..
```

### 3. Database Setup

**Install PostgreSQL:**
- **macOS**: `brew install postgresql && brew services start postgresql`
- **Ubuntu/Debian**: `sudo apt install postgresql postgresql-contrib`
- **Windows**: Download from [PostgreSQL website](https://www.postgresql.org/download/windows/)

**Create Database User:**
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create user and database
CREATE USER spy_user WITH PASSWORD 'spy_password';
ALTER USER spy_user CREATEDB;
CREATE DATABASE spy_database OWNER spy_user;
\q
```

**Configure Environment:**
```bash
cd server
cp env.example .env
```

Edit `server/.env`:
```env
DB_USER=spy_user
DB_HOST=localhost
DB_NAME=spy_database
DB_PASSWORD=spy_password
DB_PORT=5432
PORT=3001
NODE_ENV=development
```

**Initialize Database:**
```bash
# Setup database tables
node setup.js

# Insert mission data
node insert-missions.js

# (Optional) Reset users if needed
node reset-users.js
```

### 4. Start the Application

**Terminal 1 - Backend Server:**
```bash
cd server
npm start
```
Server runs on: http://localhost:3001

**Terminal 2 - Frontend:**
```bash
npm run dev
```
Frontend runs on: http://localhost:5173

### 5. Access the Game
1. Open http://localhost:5173 in your browser
2. You'll be assigned a random agent codename
3. Enter the password: `password123`
4. Complete your mission briefing
5. Access the dashboard to view and accept missions

## 🎮 How to Play

### Agent Login
- Each player gets a random agent codename (e.g., "SHADOWFOX", "SILVERWOLF")
- All agents use the same password: `password123`
- Failed login attempts are logged and tracked

### Mission System
- **Mission Types:**
  - **Social**: Interact with other players
  - **Sabotage**: Disrupt other players' activities
  - **Team**: Coordinate with teammates
  - **Object**: Find or identify specific items

- **Mission Assignment:**
  - Missions are assigned for 15 minutes
  - Use "REFRESH MISSIONS" to get new assignments
  - Each mission has a success key for completion

### Team Competition
- **Red Team** vs **Blue Team**
- Complete missions to earn points for your team
- Track team progress and compete for victory

## 🛠️ Development

### Project Structure
```
press-me/
├── src/                    # React frontend
│   ├── App.jsx            # Main app component
│   ├── Dashboard.jsx      # Mission dashboard
│   ├── Login.jsx          # Authentication
│   ├── Mission.jsx        # Mission briefing
│   └── App.css            # Styles
├── server/                # Express backend
│   ├── server.js          # Main server file
│   ├── setup.js           # Database setup
│   ├── insert-missions.js # Mission data
│   ├── reset-users.js     # User management
│   └── database.sql       # Database schema
└── public/                # Static assets
```

### API Endpoints

**Authentication:**
- `POST /api/auth/login` - Agent login

**Missions:**
- `GET /api/missions` - All missions
- `GET /api/missions/available` - Available missions
- `POST /api/missions/refresh` - Get new missions (15-min timer)
- `PUT /api/missions/:id/assign` - Assign mission
- `PUT /api/missions/:id/complete` - Complete mission

**Teams:**
- `GET /api/teams/:team/points` - Team points
- `PUT /api/teams/:team/points` - Update points

**Users:**
- `GET /api/users` - All users
- `GET /api/users/random` - Random agent
- `GET /api/users/team/:team` - Team members

### Database Schema

**Missions Table:**
- `id` - Mission ID
- `title` - Mission name
- `mission_body` - Description
- `success_key` - Completion answer
- `type` - Mission category
- `assigned_agent` - Current assignee
- `mission_expires` - Expiration time
- `completed` - Status

**Users Table:**
- `id` - Agent ID
- `codename` - Agent name
- `real_name` - Real name
- `team` - Red/Blue
- `password` - Auth password

## 🔧 Configuration

### Environment Variables
Create `server/.env`:
```env
DB_USER=your_db_user
DB_HOST=localhost
DB_NAME=spy_database
DB_PASSWORD=your_password
DB_PORT=5432
PORT=3001
NODE_ENV=development
```

### Adding New Missions
1. Edit `server/insert-missions.js`
2. Add mission objects to the `missions` array
3. Run `node insert-missions.js` to update database

### Customizing Agents
1. Edit `server/database.sql` or `server/setup.js`
2. Modify the user insertion queries
3. Run `node setup.js` to recreate database

## 🐛 Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check credentials in `.env` file
- Verify database exists: `psql -U spy_user -d spy_database`

### Port Conflicts
- Change `PORT` in `server/.env` if 3001 is in use
- Update frontend API calls if server port changes

### Mission Issues
- Check mission data with: `node insert-missions.js`
- Reset missions: `node insert-missions.js`
- Reset users: `node reset-users.js`

### Frontend Issues
- Clear browser cache
- Check browser console for errors
- Ensure backend is running on correct port

## 📝 Game Customization

### Mission Types
The game supports 4 mission types:
- **Social**: Player interaction missions
- **Sabotage**: Disruption missions  
- **Team**: Team coordination missions
- **Object**: Item identification missions

### Time Limits
- Mission assignment: 15 minutes
- Configurable in `server/server.js`

### Team System
- Two teams: Red and Blue
- Point-based scoring
- Team-specific missions available

## 🔒 Security Notes

- Passwords are stored in plain text (development only)
- Login attempts are logged with IP addresses
- No rate limiting implemented
- CORS enabled for development

## 📄 License

This project is for educational and entertainment purposes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the server logs
3. Check database connectivity
4. Verify all dependencies are installed

---

**Happy Spying! 🕵️‍♂️🕵️‍♀️**