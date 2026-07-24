-- Performance indexes for hot query paths

-- Composite index for map-locations JOIN (user_labels active + primary + location_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_labels_location_active_primary 
ON user_labels (location_id, active, is_primary) 
WHERE active = true;

-- Index for locations filtered by type (used by map-locations, location-lists, autocomplete)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_type_population 
ON locations (location_type, population DESC NULLS LAST) 
WHERE location_type IN ('city', 'county', 'state', 'country');

-- Index for user_labels active DID lookup (used by labels/my-labels, user-labels, label count checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_labels_did_active 
ON user_labels (did, active) 
WHERE active = true;
