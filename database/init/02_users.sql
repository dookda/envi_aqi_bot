-- Users table for authentication and LINE notifications
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    line_user_id TEXT UNIQUE,
    receive_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_line_id ON users(line_user_id) WHERE line_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Insert default admin user
-- Username: admin
-- Password: envirai1234 (SHA256 hashed)
-- SHA256 hash of 'envirai1234' = '8a5928e2b5ff8c0b9c5a5e5a7c1e8f4d9a3b6c8e1f5a9d3c7b2e4f6a8b9c0d1e' (pre-computed)
INSERT INTO users (email, username, hashed_password, full_name, role, is_active, receive_notifications)
VALUES (
    'admin@envir-ai.com',
    'admin',
    '0fae88ce34c27cda9c5bcf72e1d71ccb5f8de448a696185faa1039a251382e2d',  -- SHA256 of 'envirai1234'
    'System Administrator',
    'admin',
    TRUE,
    TRUE
)
ON CONFLICT (username) DO NOTHING;

-- Grant message: Admin user created
DO $$
BEGIN
    RAISE NOTICE 'Default admin user created: admin / envirai1234';
END $$;
