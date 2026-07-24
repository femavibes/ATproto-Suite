-- Add custom image columns for cities and users

-- City images
ALTER TABLE locations 
ADD COLUMN pin_image_url VARCHAR(500),
ADD COLUMN card_image_url VARCHAR(500);

-- User profile images
ALTER TABLE user_labels 
ADD COLUMN profile_card_image_url VARCHAR(500);

-- Add indexes for performance
CREATE INDEX idx_locations_pin_image ON locations(pin_image_url) WHERE pin_image_url IS NOT NULL;
CREATE INDEX idx_user_labels_profile_image ON user_labels(profile_card_image_url) WHERE profile_card_image_url IS NOT NULL;
