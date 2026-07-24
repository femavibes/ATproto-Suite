-- Add column to track if main account is included in auto-block
ALTER TABLE users ADD COLUMN autoblock_main_account BOOLEAN DEFAULT true;