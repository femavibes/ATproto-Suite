-- Event scoring configuration table
-- Allows tuning of event visibility ranking algorithm

CREATE TABLE IF NOT EXISTS event_scoring_config (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default values
INSERT INTO event_scoring_config (config_key, config_value) VALUES
  ('absoluteWeight', '0.3'),
  ('densityWeight', '0.7'),
  ('useSquareRoot', 'true'),
  ('maxDensityScore', 'null'),
  ('minRSVPsForCompetition', '0'),
  ('applyMinWhenOversubscribed', 'true')
ON CONFLICT (config_key) DO NOTHING;
