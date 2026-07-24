-- Set default password_type for existing users with null values
UPDATE user_profiles 
SET password_type = 'basic' 
WHERE password_type IS NULL AND bsky_password IS NOT NULL;
