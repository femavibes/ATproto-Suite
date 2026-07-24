-- Feed project model + draft/live feed logic support.

CREATE TABLE IF NOT EXISTS feed_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_did TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE feeds
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES feed_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assignment_rules_draft JSONB,
  ADD COLUMN IF NOT EXISTS assignment_rules_live JSONB;

UPDATE feeds
SET assignment_rules_draft = COALESCE(assignment_rules_draft, assignment_rules),
    assignment_rules_live = COALESCE(assignment_rules_live, assignment_rules),
    updated_at = NOW()
WHERE assignment_rules IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feeds_project_slug_unique
  ON feeds(project_id, slug)
  WHERE project_id IS NOT NULL AND slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feeds_project
  ON feeds(project_id);
