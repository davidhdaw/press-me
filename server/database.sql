-- Create the spy database
CREATE DATABASE spy_database;

-- Connect to the spy database
\c spy_database;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    real_name VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(20) NOT NULL,
    codename VARCHAR(20) UNIQUE NOT NULL,
    team VARCHAR(4) NOT NULL,
    initial_intel TEXT,
    votes VARCHAR(10)[] DEFAULT ARRAY['none'],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create intel table
CREATE TABLE intel (
    id SERIAL PRIMARY KEY,
    clue_text TEXT NOT NULL,
    agents_who_know INTEGER[]
);

-- Create missions table
CREATE TABLE missions (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    mission_body TEXT NOT NULL,
    assigned_agent INTEGER,
    past_assigned_agents INTEGER[],
    assigned_now BOOLEAN DEFAULT FALSE,
    mission_expires TIMESTAMP
);

-- Create teams table
INSERT INTO teams (id, name, points) VALUES
    (1, 'red', 0),
    (2, 'blue', 0);

-- Create toys table
CREATE TABLE toys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    points INTEGER DEFAULT 0
);

-- Create login_logs table
CREATE TABLE login_logs (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Insert agent codenames from the JSON file
INSERT INTO users (codename, real_name, password, team) VALUES
    ('SHADOWFOX', 'Agent Shadow', 'password123', 'red'),
    ('SILVERWOLF', 'Agent Silver', 'password123', 'blue'),
    ('HONEYDEW', 'Agent Honey', 'password123', 'red'),
    ('NIGHTRAVEN', 'Agent Night', 'password123', 'blue'),
    ('STORMHAWK', 'Agent Storm', 'password123', 'red'),
    ('FROSTWIND', 'Agent Frost', 'password123', 'blue'),
    ('EMBERSTONE', 'Agent Ember', 'password123', 'red'),
    ('IRONWING', 'Agent Iron', 'password123', 'blue'),
    ('CRIMSONFALCON', 'Agent Crimson', 'password123', 'red'),
    ('STEELTALON', 'Agent Steel', 'password123', 'blue'),
    ('PHANTOMBLADE', 'Agent Phantom', 'password123', 'red'),
    ('GHOSTWALKER', 'Agent Ghost', 'password123', 'blue'),
    ('THUNDERBOLT', 'Agent Thunder', 'password123', 'red'),
    ('FIREBRAND', 'Agent Fire', 'password123', 'blue'),
    ('ICEWALKER', 'Agent Ice', 'password123', 'red'),
    ('DARKSTAR', 'Agent Dark', 'password123', 'blue'),
    ('LIGHTNINGSTRIKE', 'Agent Lightning', 'password123', 'red'),
    ('WOLFCLAW', 'Agent Wolf', 'password123', 'blue'),
    ('RAVENWING', 'Agent Raven', 'password123', 'red'),
    ('STORMCHASER', 'Agent Storm', 'password123', 'blue'),
    ('FROSTBITE', 'Agent Frost', 'password123', 'red'),
    ('EMBERHEART', 'Agent Ember', 'password123', 'blue'),
    ('SHADOWSTALKER', 'Agent Shadow', 'password123', 'red'),
    ('SILVERFANG', 'Agent Silver', 'password123', 'blue'),
    ('NIGHTWATCH', 'Agent Night', 'password123', 'red'),
    ('THUNDERWOLF', 'Agent Thunder', 'password123', 'blue'),
    ('BLACKTHORN', 'Agent Black', 'password123', 'red'),
    ('WHITEFANG', 'Agent White', 'password123', 'blue'),
    ('REDSHADOW', 'Agent Red', 'password123', 'red'),
    ('BLUESTORM', 'Agent Blue', 'password123', 'blue'),
    ('GREENFLAME', 'Agent Green', 'password123', 'red'),
    ('SEVENHILLS', 'Agent Seven', 'password123', 'blue'),
    ('SILVERSTAR', 'Agent Silver', 'password123', 'red'),
    ('BRONZEWING', 'Agent Bronze', 'password123', 'blue'),
    ('COPPERCLAW', 'Agent Copper', 'password123', 'red'),
    ('IRONHEART', 'Agent Iron', 'password123', 'blue'),
    ('STEELWIND', 'Agent Steel', 'password123', 'red'),
    ('OBSIDIAN', 'Agent Obsidian', 'password123', 'blue'),
    ('JETSTREAM', 'Agent Jet', 'password123', 'red'),
    ('CRYSTALFANG', 'Agent Crystal', 'password123', 'blue'),
    ('DIAMONDCLAW', 'Agent Diamond', 'password123', 'red'),
    ('RUBYSTONE', 'Agent Ruby', 'password123', 'blue'),
    ('SAPPHIREWING', 'Agent Sapphire', 'password123', 'red'),
    ('EMERALDEYE', 'Agent Emerald', 'password123', 'blue'),
    ('AMETHYST', 'Agent Amethyst', 'password123', 'red'),
    ('FIRSTSTRIKE', 'Agent First', 'password123', 'blue'),
    ('ONYXWALKER', 'Agent Onyx', 'password123', 'red'),
    ('FIREHAWK', 'Agent Fire', 'password123', 'blue'),
    ('OPAL', 'Agent Opal', 'password123', 'red'),
    ('GARNET', 'Agent Garnet', 'password123', 'blue'),
    ('QUARTZSTONE', 'Agent Quartz', 'password123', 'red'),
    ('MARBLEFANG', 'Agent Marble', 'password123', 'blue'),
    ('GOLDENEYE', 'Agent Golden', 'password123', 'red');

-- Create indexes for better performance
CREATE INDEX idx_users_codename ON users(codename);
CREATE INDEX idx_users_team ON users(team);
CREATE INDEX idx_login_logs_timestamp ON login_logs(timestamp);
CREATE INDEX idx_login_logs_agent_name ON login_logs(agent_name);
CREATE INDEX idx_missions_assigned_agent ON missions(assigned_agent);
CREATE INDEX idx_missions_assigned_now ON missions(assigned_now);

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON DATABASE spy_database TO your_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user; 