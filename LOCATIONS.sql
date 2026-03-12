-- Tabla de pistas/canchas (locations/courts)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    google_maps_url TEXT,
    surface TEXT,
    has_parking BOOLEAN DEFAULT false,
    has_locker_rooms BOOLEAN DEFAULT false,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de equipos rivales (actualizada)
ALTER TABLE opponent_teams DROP COLUMN IF EXISTS field_id;
ALTER TABLE opponent_teams ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Tabla de eventos (entrenamientos, partidos, reuniones)
-- Añadir campo location_id a events si no existe
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
CREATE INDEX IF NOT EXISTS idx_opponent_teams_location ON opponent_teams(location_id);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location_id);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE locations;

-- Row Level Security (RLS)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para locations
CREATE POLICY "Any user can view locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Admins can insert locations" ON locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update locations" ON locations FOR UPDATE USING (true);
CREATE POLICY "Admins can delete locations" ON locations FOR DELETE USING (true);
