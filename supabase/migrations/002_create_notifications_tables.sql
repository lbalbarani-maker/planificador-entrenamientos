-- =============================================
-- NOTIFICATIONS LOG TABLE
-- =============================================

-- Tabla para registrar todas las notificaciones enviadas
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('goal', 'convocation', 'match_change', 'training', 'lottery', 'sponsored', 'announcement')),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  team_ids UUID[] DEFAULT '{}',
  sent_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notif_log_club ON notifications_log(club_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_type ON notifications_log(type);
CREATE INDEX IF NOT EXISTS idx_notif_log_created ON notifications_log(created_at DESC);

-- Tabla para tracking de clics
CREATE TABLE IF NOT EXISTS notification_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications_log(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para clics
CREATE INDEX IF NOT EXISTS idx_clicks_notification ON notification_clicks(notification_id);
CREATE INDEX IF NOT EXISTS idx_clicks_user ON notification_clicks(user_id);

-- Trigger para actualizar click_count en notifications_log
CREATE OR REPLACE FUNCTION increment_notification_click_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE notifications_log 
  SET click_count = click_count + 1 
  WHERE id = NEW.notification_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_notification_click_increment
  AFTER INSERT ON notification_clicks
  FOR EACH ROW
  EXECUTE FUNCTION increment_notification_click_count();
