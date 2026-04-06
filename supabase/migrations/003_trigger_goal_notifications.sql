-- =============================================
-- TRIGGER FOR GOAL NOTIFICATIONS
-- =============================================

-- Función para enviar notificación cuando se marca un gol
CREATE OR REPLACE FUNCTION trigger_goal_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_match RECORD;
  v_player_name TEXT;
  v_team_name TEXT;
  v_club_id UUID;
  v_payload JSONB;
BEGIN
  -- Obtener datos del partido
  SELECT 
    hm.id, 
    hm.club_id,
    hm.team1_name,
    hm.team2_name,
    hm.score_team1,
    hm.score_team2,
    hm.share_token
  INTO v_match
  FROM hockey_matches hm
  WHERE hm.id = NEW.match_id;

  -- Obtener nombre del jugador
  SELECT full_name INTO v_player_name FROM players WHERE id = NEW.player_id;

  -- Determinar qué equipo marcó
  IF NEW.is_team1 THEN
    v_team_name := v_match.team1_name;
  ELSE
    v_team_name := v_match.team2_name;
  END IF;

  -- Construir payload
  v_payload := jsonb_build_object(
    'type', 'goal',
    'title', '⚡ ¡GOOOL!',
    'body', v_team_name || ' - Gol de ' || COALESCE(v_player_name, 'Jugador') || ' (min ' || NEW.minute || ')',
    'tag', 'goal-' || v_match.id,
    'data', jsonb_build_object(
      'match_id', v_match.id,
      'team', v_team_name,
      'player', v_player_name,
      'minute', NEW.minute,
      'score', v_match.score_team1 || '-' || v_match.score_team2,
      'share_token', v_match.share_token
    ),
    'club_id', v_match.club_id,
    'team_ids', ARRAY[NEW.team_id]::UUID[]
  );

  -- Llamar a la Edge Function de forma asíncrona
  -- Nota: Esto requiere configurar la URL de la Edge Function en secrets
  PERFORM net.http_post(
    url := current_setting('app.settings.push_function_url', true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := v_payload::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para ejecutarse después de insertar un gol
DROP TRIGGER IF EXISTS on_goal_created ON hockey_goals;
CREATE TRIGGER on_goal_created
  AFTER INSERT ON hockey_goals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_goal_notification();
