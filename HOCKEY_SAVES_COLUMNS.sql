-- Add new columns to hockey_saves table
ALTER TABLE hockey_saves ADD COLUMN IF NOT EXISTS player_id UUID;
ALTER TABLE hockey_saves ADD COLUMN IF NOT EXISTS dorsal VARCHAR(10);
ALTER TABLE hockey_saves ADD COLUMN IF NOT EXISTS elapsed_in_quarter INTEGER;
