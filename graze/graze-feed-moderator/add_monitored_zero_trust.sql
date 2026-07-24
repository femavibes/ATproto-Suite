-- Add zero trust support for monitored accounts
ALTER TABLE monitored_accounts ADD COLUMN IF NOT EXISTS use_zero_trust BOOLEAN DEFAULT FALSE;
