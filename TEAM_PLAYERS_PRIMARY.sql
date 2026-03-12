-- Añadir columna is_primary a team_players
ALTER TABLE team_players ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
