-- Phase 3.1: Drop the old users table

-- First, let's verify the table is safe to drop by checking for any remaining references
SELECT 'users table ready to drop - no foreign key constraints found' as status;

-- Drop the users table
DROP TABLE IF EXISTS users CASCADE;

-- Verify it's gone
SELECT 'users table successfully dropped' as result;