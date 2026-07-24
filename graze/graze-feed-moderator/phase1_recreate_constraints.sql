-- Phase 1.4b: Recreate foreign key constraints to reference user_profiles table

ALTER TABLE feeds ADD CONSTRAINT feeds_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE daily_usage ADD CONSTRAINT daily_usage_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE banned_users ADD CONSTRAINT banned_users_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE sync_tracking ADD CONSTRAINT sync_tracking_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE hidden_trending_posts ADD CONSTRAINT hidden_trending_posts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE hidden_trending_banned_users ADD CONSTRAINT hidden_trending_banned_users_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE user_whitelists ADD CONSTRAINT user_whitelists_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE protected_posts ADD CONSTRAINT protected_posts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE user_accounts ADD CONSTRAINT user_accounts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE block_lists ADD CONSTRAINT block_lists_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE autoblock_log ADD CONSTRAINT autoblock_log_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE monitored_accounts ADD CONSTRAINT monitored_accounts_owner_user_id_fkey 
    FOREIGN KEY (owner_user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;