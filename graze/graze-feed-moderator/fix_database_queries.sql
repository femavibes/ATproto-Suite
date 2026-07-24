-- Fix all remaining queries that reference the old users table instead of user_profiles

-- This script will be used to identify what needs to be changed in the code
-- The moderation routes have several hardcoded SQL queries that need updating

-- 1. In backfill-removal route:
-- UPDATE users SET backfill_count = 0, backfill_reset_date = $1 WHERE id = $2
-- Should be: UPDATE user_profiles SET backfill_count = 0, backfill_reset_date = $1 WHERE id = $2

-- 2. In backfill-removal route:
-- UPDATE users SET backfill_count = backfill_count + 1 WHERE id = $1
-- Should be: UPDATE user_profiles SET backfill_count = backfill_count + 1 WHERE id = $1

-- 3. In trending-removals route:
-- LEFT JOIN users u ON u.id = $3
-- Should be: LEFT JOIN user_profiles u ON u.id = $3

-- 4. In trending-banned-users route:
-- LEFT JOIN users u ON u.id = $3
-- Should be: LEFT JOIN user_profiles u ON u.id = $3

-- 5. In user-history route:
-- LEFT JOIN users u ON f.user_id = u.id
-- Should be: LEFT JOIN user_profiles u ON f.user_id = u.id

-- 6. In post-reports route:
-- (SELECT handle FROM users WHERE did = pr.reporter_did LIMIT 1)
-- Should be: (SELECT handle FROM user_profiles WHERE did = pr.reporter_did LIMIT 1)

-- 7. In user-reports route:
-- (SELECT handle FROM users WHERE did = ur.reporter_did LIMIT 1)
-- Should be: (SELECT handle FROM user_profiles WHERE did = ur.reporter_did LIMIT 1)