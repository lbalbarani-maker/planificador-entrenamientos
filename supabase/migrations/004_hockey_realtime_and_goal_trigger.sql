-- 004_hockey_realtime_and_goal_trigger.sql
--
-- Objetivo (ver docs/MATCH-LIVE-SYNC-AUDIT.md):
--   1. Deshabilitar el trigger obsoleto `on_goal_created` sobre hockey_goals.
--      La funcion desplegada en produccion construye un payload JSONB pero
--      NO envia ninguna notificacion (no llama a net.http_post) y referencia
--      NEW.club_id, que puede no estar presente en inserts recientes.
--      Es un punto de fallo latente sobre el INSERT de goles y no aporta nada.
--      Deshabilitado es reversible con:
--        ALTER TABLE hockey_goals ENABLE TRIGGER on_goal_created;
--   2. Publicar en Realtime las tablas de hockey que faltan (verificacion:
--      SELECT tablename FROM pg_publication_tables
--      WHERE pubname = 'supabase_realtime'
--        AND tablename IN ('match_cards','hockey_penalty_misses','match_shootouts');).
--
-- Idempotente: puede aplicarse varias veces sin error.

ALTER TABLE hockey_goals DISABLE TRIGGER IF EXISTS on_goal_created;

DO $$
DECLARE
  tbl_name text;
BEGIN
  FOREACH tbl_name IN ARRAY ARRAY['match_cards', 'hockey_penalty_misses', 'match_shootouts']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl_name);
    END IF;
  END LOOP;
END $$;