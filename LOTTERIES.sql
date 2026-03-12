-- Tabla de loterías
CREATE TABLE IF NOT EXISTS lotteries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    draw_date TIMESTAMPTZ,
    ticket_price NUMERIC(10,2) NOT NULL,
    total_tickets INTEGER NOT NULL,
    lottery_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de bloques de números de boletos (asignados a jugadores)
CREATE TABLE IF NOT EXISTS ticket_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lottery_id UUID REFERENCES lotteries(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    start_number INTEGER NOT NULL,
    end_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de boletos individuales
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lottery_id UUID REFERENCES lotteries(id) ON DELETE CASCADE,
    ticket_block_id UUID REFERENCES ticket_blocks(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold')),
    buyer_name TEXT,
    buyer_phone TEXT,
    buyer_email TEXT,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de patrocinadores
CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    website TEXT,
    sponsor_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lotteries_club ON lotteries(club_id);
CREATE INDEX IF NOT EXISTS idx_ticket_blocks_lottery ON ticket_blocks(lottery_id);
CREATE INDEX IF NOT EXISTS idx_ticket_blocks_player ON ticket_blocks(player_id);
CREATE INDEX IF NOT EXISTS idx_tickets_lottery ON tickets(lottery_id);
CREATE INDEX IF NOT EXISTS idx_tickets_block ON tickets(ticket_block_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_sponsors_club ON sponsors(club_id);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE lotteries;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE sponsors;

-- Row Level Security (RLS)
ALTER TABLE lotteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para lotteries
CREATE POLICY "Any user can view lotteries" ON lotteries FOR SELECT USING (true);
CREATE POLICY "Admins can insert lotteries" ON lotteries FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins can update lotteries" ON lotteries FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can delete lotteries" ON lotteries FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas RLS para ticket_blocks
CREATE POLICY "Any user can view ticket_blocks" ON ticket_blocks FOR SELECT USING (true);
CREATE POLICY "Any user can insert ticket_blocks" ON ticket_blocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Any user can update ticket_blocks" ON ticket_blocks FOR UPDATE USING (true);
CREATE POLICY "Any user can delete ticket_blocks" ON ticket_blocks FOR DELETE USING (true);

-- Políticas RLS para tickets
CREATE POLICY "Any user can view tickets" ON tickets FOR SELECT USING (true);
CREATE POLICY "Any user can insert tickets" ON tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Any user can update tickets" ON tickets FOR UPDATE USING (true);

-- Políticas RLS para sponsors
CREATE POLICY "Any user can view sponsors" ON sponsors FOR SELECT USING (true);
CREATE POLICY "Admins can insert sponsors" ON sponsors FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins can update sponsors" ON sponsors FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can delete sponsors" ON sponsors FOR DELETE USING (auth.role() = 'authenticated');
