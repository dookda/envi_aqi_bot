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
-- Password: envirai1234 (bcrypt hashed)
INSERT INTO users (email, username, hashed_password, full_name, role, is_active, receive_notifications)
VALUES (
    'admin@envir-ai.com',
    'admin',
    '$2b$12$FC6ZNnC.uY3kbgC.xi63jejRIKY9i4w8zCelhU7Ptssr9sRGliApO',  -- bcrypt hash of 'envirai1234'
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
