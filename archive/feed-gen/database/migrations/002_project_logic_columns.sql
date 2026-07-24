-- Store draft/live graph logic at project scope.

ALTER TABLE feed_projects
  ADD COLUMN IF NOT EXISTS assignment_rules_draft JSONB,
  ADD COLUMN IF NOT EXISTS assignment_rules_live JSONB;

UPDATE feed_projects
SET assignment_rules_draft = COALESCE(assignment_rules_draft, '{"version":2,"nodes":[],"edges":[]}'::jsonb),
    assignment_rules_live = COALESCE(assignment_rules_live, '{"version":2,"nodes":[],"edges":[]}'::jsonb),
    updated_at = NOW();
