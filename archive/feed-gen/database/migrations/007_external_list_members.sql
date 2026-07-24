-- Cached external ATProto list memberships for author/mentions listUris.
CREATE TABLE IF NOT EXISTS external_list_members (
  list_uri TEXT NOT NULL,
  member_did TEXT NOT NULL,
  member_handle TEXT,
  source_type TEXT DEFAULT 'list',
  refreshed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (list_uri, member_did)
);

CREATE INDEX IF NOT EXISTS idx_external_list_members_list_uri ON external_list_members(list_uri);
CREATE INDEX IF NOT EXISTS idx_external_list_members_member_did ON external_list_members(member_did);

CREATE TABLE IF NOT EXISTS external_list_refresh_state (
  list_uri TEXT PRIMARY KEY,
  last_refreshed_at TIMESTAMP,
  last_error TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
