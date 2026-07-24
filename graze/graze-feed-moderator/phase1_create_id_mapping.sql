-- Phase 1.3: Create ID mapping table for foreign key updates

-- Create temporary mapping table
CREATE TEMP TABLE user_id_mapping AS
SELECT 
    u.id as old_users_id,
    up.id as new_user_profiles_id,
    u.did,
    u.handle
FROM users u
JOIN user_profiles up ON u.did = up.did;

-- Show the mapping for verification
SELECT * FROM user_id_mapping ORDER BY old_users_id;