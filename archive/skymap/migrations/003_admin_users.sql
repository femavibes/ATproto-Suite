-- Create admin_users table for whitelist
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  handle VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_admin_users_handle ON admin_users(handle);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(active);
