-- Add group ban list columns
ALTER TABLE feed_groups ADD COLUMN IF NOT EXISTS group_ban_list TEXT;
ALTER TABLE feed_groups ADD COLUMN IF NOT EXISTS use_group_list_only BOOLEAN DEFAULT false;

COMMENT ON COLUMN feed_groups.group_ban_list IS 'Default ban list URI for the group. Used as fallback when feeds do not have their own ban list.';
COMMENT ON COLUMN feed_groups.use_group_list_only IS 'If true, only use group ban list and ignore individual feed ban lists.';
