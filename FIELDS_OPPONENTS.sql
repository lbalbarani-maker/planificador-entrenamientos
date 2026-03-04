-- Tabla de campos/pistas
CREATE TABLE IF NOT EXISTS fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    google_maps_url TEXT,
    surface TEXT,
    has_parking BOOLEAN DEFAULT false,
    has_locker_rooms BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de equipos rivales
CREATE TABLE IF NOT EXISTS opponent_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fields_club ON fields(club_id);
CREATE INDEX IF NOT EXISTS idx_opponent_teams_club ON opponent_teams(club_id);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE fields;
ALTER PUBLICATION supabase_realtime ADD TABLE opponent_teams;
