-- Migration script to upgrade monitored account passwords to secure encryption
-- This will need to be run manually since we need to decrypt old passwords and re-encrypt with new method

-- First, let's add a temporary column to track migration status
ALTER TABLE monitored_accounts ADD COLUMN IF NOT EXISTS password_migrated BOOLEAN DEFAULT FALSE;

-- Note: This migration requires a Node.js script to:
-- 1. Read all monitored accounts with password_migrated = false
-- 2. Decrypt using old method (createDecipher)  
-- 3. Re-encrypt using new method (PasswordService.encryptPassword)
-- 4. Update the record and set password_migrated = true
-- 5. Remove password_migrated column when complete