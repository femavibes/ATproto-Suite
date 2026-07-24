-- Migration 026: Interests System
-- Unified interest/tag system for both users and events
-- Replaces old event category system

-- Interest categories (creative, sports, tech, etc.)
CREATE TABLE interest_categories (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Individual interests (used by BOTH users and events)
CREATE TABLE interests (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  aliases TEXT[],
  category_id INTEGER REFERENCES interest_categories(id),
  sort_order INTEGER DEFAULT 0,
  user_count INTEGER DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  is_nsfw BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User interests (many-to-many)
CREATE TABLE user_interests (
  user_did TEXT NOT NULL,
  interest_id INTEGER REFERENCES interests(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_did, interest_id)
);

-- Event tags (unified storage for predefined interests AND custom tags)
CREATE TABLE event_tags (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(10) REFERENCES events(event_id) ON DELETE CASCADE,
  interest_id INTEGER REFERENCES interests(id) ON DELETE SET NULL,
  custom_tag TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT interest_or_custom CHECK (
    (interest_id IS NOT NULL AND custom_tag IS NULL) OR
    (interest_id IS NULL AND custom_tag IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_interests_category ON interests(category_id);
CREATE INDEX idx_interests_active ON interests(active);
CREATE INDEX idx_interests_key ON interests(key);
CREATE INDEX idx_user_interests_interest ON user_interests(interest_id);
CREATE INDEX idx_user_interests_did ON user_interests(user_did);
CREATE INDEX idx_interest_categories_active ON interest_categories(active);
CREATE INDEX idx_event_tags_event ON event_tags(event_id);
CREATE INDEX idx_event_tags_interest ON event_tags(interest_id);
CREATE INDEX idx_event_tags_custom ON event_tags(custom_tag) WHERE custom_tag IS NOT NULL;

-- Config
INSERT INTO config (key, value) VALUES ('max_interests_per_user', '15') ON CONFLICT DO NOTHING;
INSERT INTO config (key, value) VALUES ('max_tags_per_event', '5') ON CONFLICT DO NOTHING;

-- Keep old columns for backward compatibility (safe rollback)
-- Note: New system uses event_tags table, but old columns remain for safety

-- Seed categories
INSERT INTO interest_categories (key, name, sort_order) VALUES
  ('creative', 'Creative', 1),
  ('sports', 'Sports & Fitness', 2),
  ('tech', 'Technology', 3),
  ('social', 'Social & Community', 4),
  ('lifestyle', 'Lifestyle', 5),
  ('academic', 'Academic', 6);

-- Seed interests
INSERT INTO interests (key, name, description, aliases, category_id, sort_order) VALUES
  ('photography', 'Photography', 'All types of photography', ARRAY['photo', 'photos', 'photographer'], (SELECT id FROM interest_categories WHERE key = 'creative'), 1),
  ('art', 'Art', 'Visual arts, painting, drawing, sculpture', ARRAY['artist', 'artwork'], (SELECT id FROM interest_categories WHERE key = 'creative'), 2),
  ('design', 'Design', 'Graphic design, UX/UI, product design', ARRAY['designer', 'graphics'], (SELECT id FROM interest_categories WHERE key = 'creative'), 3),
  ('film', 'Film & Video', 'Filmmaking, video production, cinematography', ARRAY['video', 'cinema', 'movies'], (SELECT id FROM interest_categories WHERE key = 'creative'), 4),
  ('music', 'Music', 'Music creation, performance, and appreciation', ARRAY['musician', 'audio', 'sound'], (SELECT id FROM interest_categories WHERE key = 'creative'), 5),
  ('writing', 'Writing', 'Creative writing, journalism, blogging', ARRAY['writer', 'author', 'journalism'], (SELECT id FROM interest_categories WHERE key = 'creative'), 6),
  ('cycling', 'Cycling', 'Road cycling, mountain biking, bike commuting', ARRAY['bike', 'biking', 'bicycle'], (SELECT id FROM interest_categories WHERE key = 'sports'), 1),
  ('running', 'Running', 'Running, jogging, marathons, trail running', ARRAY['runner', 'jogging'], (SELECT id FROM interest_categories WHERE key = 'sports'), 2),
  ('hiking', 'Hiking', 'Hiking, backpacking, outdoor trails', ARRAY['hike', 'backpacking', 'trails'], (SELECT id FROM interest_categories WHERE key = 'sports'), 3),
  ('climbing', 'Climbing', 'Rock climbing, bouldering, mountaineering', ARRAY['bouldering', 'mountaineering'], (SELECT id FROM interest_categories WHERE key = 'sports'), 4),
  ('fitness', 'Fitness', 'General fitness, gym, strength training', ARRAY['gym', 'workout', 'exercise'], (SELECT id FROM interest_categories WHERE key = 'sports'), 5),
  ('programming', 'Programming', 'Software development, coding', ARRAY['coding', 'developer', 'software'], (SELECT id FROM interest_categories WHERE key = 'tech'), 1),
  ('gaming', 'Gaming', 'Video games, esports, game development', ARRAY['games', 'gamer', 'esports'], (SELECT id FROM interest_categories WHERE key = 'tech'), 2),
  ('ai', 'AI & Machine Learning', 'Artificial intelligence, machine learning, data science', ARRAY['ml', 'machinelearning', 'datascience'], (SELECT id FROM interest_categories WHERE key = 'tech'), 3),
  ('crypto', 'Crypto & Web3', 'Cryptocurrency, blockchain, decentralized tech', ARRAY['blockchain', 'web3', 'bitcoin'], (SELECT id FROM interest_categories WHERE key = 'tech'), 4),
  ('urbanism', 'Urbanism', 'City planning, public transit, walkable cities', ARRAY['urbanplanning', 'transit', 'cities'], (SELECT id FROM interest_categories WHERE key = 'social'), 1),
  ('politics', 'Politics', 'Political discussion, activism, civic engagement', ARRAY['political', 'government'], (SELECT id FROM interest_categories WHERE key = 'social'), 2),
  ('activism', 'Activism', 'Social justice, advocacy, community organizing', ARRAY['advocate', 'justice'], (SELECT id FROM interest_categories WHERE key = 'social'), 3),
  ('community', 'Community Organizing', 'Building and organizing local communities', ARRAY['organizing', 'volunteer'], (SELECT id FROM interest_categories WHERE key = 'social'), 4),
  ('food', 'Food', 'Cooking, restaurants, food culture', ARRAY['cooking', 'cuisine', 'restaurants'], (SELECT id FROM interest_categories WHERE key = 'lifestyle'), 1),
  ('coffee', 'Coffee', 'Coffee culture, brewing, cafes', ARRAY['cafe', 'espresso', 'barista'], (SELECT id FROM interest_categories WHERE key = 'lifestyle'), 2),
  ('beer', 'Beer & Brewing', 'Craft beer, brewing, beer culture', ARRAY['brewing', 'craftbeer', 'brewery'], (SELECT id FROM interest_categories WHERE key = 'lifestyle'), 3),
  ('travel', 'Travel', 'Travel, exploration, adventure', ARRAY['traveling', 'adventure', 'explore'], (SELECT id FROM interest_categories WHERE key = 'lifestyle'), 4),
  ('fashion', 'Fashion', 'Fashion, style, clothing', ARRAY['style', 'clothing'], (SELECT id FROM interest_categories WHERE key = 'lifestyle'), 5),
  ('science', 'Science', 'Scientific research, STEM fields', ARRAY['research', 'stem'], (SELECT id FROM interest_categories WHERE key = 'academic'), 1),
  ('history', 'History', 'Historical study and discussion', ARRAY['historical'], (SELECT id FROM interest_categories WHERE key = 'academic'), 2),
  ('philosophy', 'Philosophy', 'Philosophical thought and discussion', ARRAY['philosophical'], (SELECT id FROM interest_categories WHERE key = 'academic'), 3),
  ('literature', 'Literature', 'Books, reading, literary discussion', ARRAY['books', 'reading'], (SELECT id FROM interest_categories WHERE key = 'academic'), 4);
