-- Sessions Table Schema Proposal
-- This table tracks game sessions and controls when missions can be assigned

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
        -- 'draft': Session created but not started
        -- 'active': Session is running, missions can be assigned
        -- 'paused': Session temporarily paused
        -- 'ended': Session completed/ended
    participant_user_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
        -- Array of user IDs participating in this session
    created_by INTEGER,
        -- User ID of the admin who created the session
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    started_at TIMESTAMP,
        -- When the session was activated/started
    paused_at TIMESTAMP,
        -- When the session was paused (if applicable)
    ended_at TIMESTAMP,
        -- When the session was ended
    notes TEXT,
        -- Optional notes about the session
    CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'paused', 'ended'))
);

-- Create indexes for common queries
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_sessions_active ON sessions(status) WHERE status = 'active';
    -- Partial index for finding active sessions quickly

-- Optional: Add foreign key constraint for created_by
-- ALTER TABLE sessions ADD CONSTRAINT fk_sessions_created_by 
--     FOREIGN KEY (created_by) REFERENCES users(id);

-- Example queries:
-- Get active session: SELECT * FROM sessions WHERE status = 'active';
-- Get all sessions: SELECT * FROM sessions ORDER BY created_at DESC;
-- Check if a user is in active session: 
--   SELECT * FROM sessions WHERE status = 'active' AND user_id = ANY(participant_user_ids);
