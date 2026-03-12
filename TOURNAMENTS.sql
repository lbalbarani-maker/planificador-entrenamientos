-- Tabla de temporadas (ya existe, verificamos columnas)
-- seasons: id, club_id, name, start_date, end_date, is_active, created_at

-- Tabla tournaments (torneos)
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    modality TEXT CHECK (modality IN ('field','indoor')),
    competition_type TEXT CHECK (competition_type IN ('league','cup','friendly')),
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla matchdays (jornadas)
CREATE TABLE IF NOT EXISTS matchdays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER,
    name TEXT,
    start_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actualizar tabla events para vincular con torneos
ALTER TABLE events ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS matchday_id UUID REFERENCES matchdays(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS opponent_team_id UUID REFERENCES opponent_teams(id) ON DELETE SET NULL;

-- Tabla match_events (estadísticas de partido)
CREATE TABLE IF NOT EXISTS match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    event_type TEXT CHECK (event_type IN ('goal','green_card','yellow_card','red_card','blue_card')),
    minute INTEGER,
    is_own_goal BOOLEAN DEFAULT false,
    is_penalty BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla standings (clasificaciones)
CREATE TABLE IF NOT EXISTS standings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    team_name TEXT,
    played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    goals_for INTEGER DEFAULT 0,
    goals_against INTEGER DEFAULT 0,
    goal_difference INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, team_id)
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_tournaments_season ON tournaments(season_id);
CREATE INDEX IF NOT EXISTS idx_matchdays_tournament ON matchdays(tournament_id);
CREATE INDEX IF NOT EXISTS idx_events_tournament ON events(tournament_id);
CREATE INDEX IF NOT EXISTS idx_events_matchday ON events(matchday_id);
CREATE INDEX IF NOT EXISTS idx_match_events_event ON match_events(event_id);
CREATE INDEX IF NOT EXISTS idx_standings_tournament ON standings(tournament_id);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE matchdays;
ALTER PUBLICATION supabase_realtime ADD TABLE match_events;
ALTER PUBLICATION supabase_realtime ADD TABLE standings;

-- RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Public read tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Public insert tournaments" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update tournaments" ON tournaments FOR UPDATE USING (true);
CREATE POLICY "Public delete tournaments" ON tournaments FOR DELETE USING (true);

CREATE POLICY "Public read matchdays" ON matchdays FOR SELECT USING (true);
CREATE POLICY "Public insert matchdays" ON matchdays FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update matchdays" ON matchdays FOR UPDATE USING (true);
CREATE POLICY "Public delete matchdays" ON matchdays FOR DELETE USING (true);

CREATE POLICY "Public read match_events" ON match_events FOR SELECT USING (true);
CREATE POLICY "Public insert match_events" ON match_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update match_events" ON match_events FOR UPDATE USING (true);
CREATE POLICY "Public delete match_events" ON match_events FOR DELETE USING (true);

CREATE POLICY "Public read standings" ON standings FOR SELECT USING (true);
CREATE POLICY "Public insert standings" ON standings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update standings" ON standings FOR UPDATE USING (true);
CREATE POLICY "Public delete standings" ON standings FOR DELETE USING (true);
