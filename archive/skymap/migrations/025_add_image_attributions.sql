-- Add attribution fields for city images

ALTER TABLE locations 
ADD COLUMN pin_image_attribution VARCHAR(500),
ADD COLUMN card_image_attribution VARCHAR(500);
