-- Add bounding box columns to locations table
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS bbox_south DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS bbox_west DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS bbox_north DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS bbox_east DECIMAL(10, 7);

-- Add index for bbox queries
CREATE INDEX IF NOT EXISTS idx_locations_bbox ON locations(bbox_south, bbox_west, bbox_north, bbox_east);

-- Add comment
COMMENT ON COLUMN locations.bbox_south IS 'Southern boundary of city bounding box';
COMMENT ON COLUMN locations.bbox_west IS 'Western boundary of city bounding box';
COMMENT ON COLUMN locations.bbox_north IS 'Northern boundary of city bounding box';
COMMENT ON COLUMN locations.bbox_east IS 'Eastern boundary of city bounding box';
