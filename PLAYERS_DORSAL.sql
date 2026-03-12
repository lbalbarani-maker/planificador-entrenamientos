-- Añadir campo dorsal a la tabla players si no existe
ALTER TABLE players ADD COLUMN IF NOT EXISTS dorsal INTEGER;

-- Crear índice para búsquedas rápidas por dorsal
CREATE INDEX IF NOT EXISTS idx_players_dorsal ON players(dorsal) WHERE dorsal IS NOT NULL;

-- Añadir campo gender a players si no existe (para validar masculino/femenino)
ALTER TABLE players ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'otro';
