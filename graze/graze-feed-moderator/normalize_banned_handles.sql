-- Normalize existing banned handles to lowercase to prevent duplicates

-- Update all banned handles to lowercase
UPDATE banned_users SET banned_handle = LOWER(banned_handle);

-- Remove any duplicates that may have been created (keep the most recent one)
DELETE FROM banned_users bu1
WHERE bu1.id < (
  SELECT MAX(bu2.id)
  FROM banned_users bu2
  WHERE bu2.user_id = bu1.user_id
  AND bu2.banned_handle = bu1.banned_handle
  AND bu2.list_type = bu1.list_type
  AND (bu2.list_identifier = bu1.list_identifier OR (bu2.list_identifier IS NULL AND bu1.list_identifier IS NULL))
);

-- Update hidden trending banned users to lowercase as well
UPDATE hidden_trending_banned_users SET banned_handle = LOWER(banned_handle);

-- Remove duplicates from hidden trending banned users
DELETE FROM hidden_trending_banned_users htbu1
WHERE htbu1.id < (
  SELECT MAX(htbu2.id)
  FROM hidden_trending_banned_users htbu2
  WHERE htbu2.user_id = htbu1.user_id
  AND htbu2.banned_handle = htbu1.banned_handle
);