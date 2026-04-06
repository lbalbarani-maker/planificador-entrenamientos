-- Add position column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS position VARCHAR DEFAULT 'Jugador';

-- Set position to 'Jugador' for all existing players (user will update manually)
UPDATE players SET position = 'Jugador' WHERE position IS NULL;
