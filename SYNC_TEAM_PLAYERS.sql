-- Sync team_players with players data (dorsal and position)
-- This ensures team_players has the same dorsal and position values as the players table

UPDATE team_players tp
SET 
  shirt_number = p.dorsal,
  position = p.position
FROM players p
WHERE tp.player_id = p.id
  AND (
    tp.shirt_number IS DISTINCT FROM p.dorsal
    OR tp.position IS DISTINCT FROM p.position
  );
