import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YouTube from 'react-youtube';
import { hockeyApi } from '../../lib/supabaseHockey';
import { teamsApi, clubsApi, eventsApi } from '../../lib/supabaseTeams';
import { supabase } from '../../lib/supabase';
import { HockeyMatch, HockeyGoal, HockeySave, HockeyCard, PenaltyEvent, HockeyShootout } from '../../types/hockey';
import MatchEventOverlay from './MatchEventOverlay';
import FloatingReactions, { FloatingReactionsRef } from './FloatingReactions';

const MatchSpectator: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [match, setMatch] = useState<HockeyMatch | null>(null);
  const [goals, setGoals] = useState<HockeyGoal[]>([]);
  const [saves, setSaves] = useState<HockeySave[]>([]);
  const [cards, setCards] = useState<HockeyCard[]>([]);
  const [penalties, setPenalties] = useState<PenaltyEvent[]>([]);
  const [shootouts, setShootouts] = useState<HockeyShootout[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);
  const [visibleEvent, setVisibleEvent] = useState<'goal' | 'save' | 'rival_goal' | null>(null);
  const [eventTeam, setEventTeam] = useState<'team1' | 'team2' | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(30);
  const [team1Logo, setTeam1Logo] = useState<string>('');
  const [team2Logo, setTeam2Logo] = useState<string>('');
  const [team1Category, setTeam1Category] = useState<string>('');
  const [team2Category, setTeam2Category] = useState<string>('');
  const playerRef = useRef<any>(null);
  const floatingReactionsRef = useRef<FloatingReactionsRef>(null);
  const [lastGoalInfo, setLastGoalInfo] = useState<{player_name?: string; dorsal?: string; quarter?: number} | null>(null);
  const isInitialLoad = useRef(true);
  const previousGoalsLength = useRef(0);
  const previousSavesLength = useRef(0);

  const sendReaction = async (type: string) => {
    if (!match?.id) return;
    
    console.log("📤 Sending reaction:", type, "for match:", match.id);
    
    // Mostrar reacción local inmediatamente
    floatingReactionsRef.current?.addReaction(type);
    
    try {
      const { data, error } = await supabase.from("match_reactions").insert({
        match_id: match.id,
        type,
      });
      
      if (error) {
        console.error("❌ Error sending reaction:", error);
      } else {
        console.log("✅ Reaction saved to DB:", type, data);
      }
    } catch (error) {
      console.error("❌ Error sending reaction:", error);
    }
  };

  useEffect(() => {
    if (token) loadMatch();
  }, [token]);

  useEffect(() => {
    if (!match) return;
    
    const interval = setInterval(() => {
      if (match.running && match.start_time) {
        const elapsed = Math.floor((Date.now() - match.start_time) / 1000);
        const newTime = Math.max(0, match.remaining_time - elapsed);
        setDisplayTime(newTime);
      } else {
        setDisplayTime(match.remaining_time);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [match?.running, match?.remaining_time, match?.start_time]);

  // Suscripción a Supabase Realtime
  useEffect(() => {
    if (!match) return;

    const channel = supabase
      .channel(`match-${match.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "hockey_matches",
          filter: `id=eq.${match.id}`,
        },
        (payload: any) => {
          if (payload.new) {
            setMatch((prev) => prev ? { ...prev, ...payload.new } : payload.new);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hockey_goals",
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            loadMatch();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hockey_saves",
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            loadMatch();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_cards",
          filter: `match_id=eq.${match.id}`,
        },
        () => {
          hockeyApi.getMatchCards(match.id).then(setCards);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_events",
          filter: `match_id=eq.${match.id}`,
        },
        () => {
          hockeyApi.getMatchPenalties(match.id).then(setPenalties);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match?.id]);

  useEffect(() => {
    if (isInitialLoad.current) return;
    if (goals.length > previousGoalsLength.current) {
      const lastGoal = goals[goals.length - 1];
      setVisibleEvent(lastGoal.team === 'team1' ? 'goal' : 'rival_goal');
      setEventTeam(lastGoal.team);
      setLastGoalInfo({
        player_name: lastGoal.player_name,
        dorsal: lastGoal.dorsal,
        quarter: lastGoal.quarter
      });
      const timer = setTimeout(() => setVisibleEvent(null), 3000);
      return () => clearTimeout(timer);
    }
    previousGoalsLength.current = goals.length;
  }, [goals.length, isInitialLoad.current]);

  useEffect(() => {
    if (isInitialLoad.current) return;
    if (saves.length > previousSavesLength.current) {
      const lastSave = saves[saves.length - 1];
      if (!visibleEvent) {
        setVisibleEvent('save');
        setEventTeam(lastSave.team);
        const timer = setTimeout(() => setVisibleEvent(null), 3000);
        return () => clearTimeout(timer);
      }
    }
    previousSavesLength.current = saves.length;
  }, [saves.length, isInitialLoad.current]);

  const loadMatch = async () => {
    try {
      // Guardar longitudes anteriores ANTES de actualizar
      const prevGoalsLen = previousGoalsLength.current;
      const prevSavesLen = previousSavesLength.current;
      
      const matchData = await hockeyApi.getMatchByToken(token!);
      if (!matchData) {
        alert('Partido no encontrado');
        navigate('/match');
        return;
      }
      
      setMatch(matchData);
      setDisplayTime(matchData.remaining_time);

      // Cargar logos de equipos/clubes
      const [teamsData, clubsData] = await Promise.all([
        teamsApi.getTeams(),
        clubsApi.getClubs()
      ]);
      
      // Buscar logo y categoría del equipo 1
      let logo1 = matchData.team1_logo_url || '';
      let category1 = '';
      
      // Obtener categoría desde el evento vinculado
      if (matchData.event_id) {
        const eventData = await eventsApi.getEvent(matchData.event_id);
        if (eventData?.team) {
          category1 = eventData.team.name; // Nombre del equipo (ej: Cadete Femenina)
          // Obtener logo desde el club del equipo
          if (eventData.team.club?.logo_url) {
            logo1 = eventData.team.club.logo_url;
          }
        }
      }
      
      // Fallback: buscar por nombre de club si no hay evento
      if (!logo1 || !category1) {
        const club1 = clubsData.find(c => c.name === matchData.team1_name);
        if (club1?.logo_url) logo1 = club1.logo_url;
        // Si no tenemos categoría del equipo, usar el nombre del club
        if (!category1) category1 = matchData.team1_name;
      }
      
      // Equipo 2 (rival) - usar nombre directo
      let logo2 = matchData.team2_logo_url || '';
      if (!logo2) {
        const club2 = clubsData.find(c => c.name === matchData.team2_name);
        logo2 = club2?.logo_url || '';
      }
      const category2 = matchData.team2_name; // El rival se muestra por su nombre de club
      
      setTeam1Logo(logo1);
      setTeam2Logo(logo2);
      setTeam1Category(category1);
      setTeam2Category(category2);

      const [goalsData, savesData, cardsData, penaltiesData, shootoutsData] = await Promise.all([
        hockeyApi.getMatchGoals(matchData.id),
        hockeyApi.getMatchSaves(matchData.id),
        hockeyApi.getMatchCards(matchData.id),
        hockeyApi.getMatchPenalties(matchData.id),
        hockeyApi.getMatchShootouts(matchData.id),
      ]);
      
      setGoals(goalsData);
      setSaves(savesData);
      setCards(cardsData);
      setPenalties(penaltiesData);
      setShootouts(shootoutsData);
      
      // Restaurar previous lengths usando los valores guardados
      // Solo actualizar si no es la carga inicial
      if (!isInitialLoad.current) {
        previousGoalsLength.current = prevGoalsLen;
        previousSavesLength.current = prevSavesLen;
      } else {
        previousGoalsLength.current = goalsData.length;
        previousSavesLength.current = savesData.length;
        isInitialLoad.current = false;
      }
    } catch (error) {
      console.error('Error loading match:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const toggleMute = () => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.setVolume(volume);
        playerRef.current.unMute();
      } else {
        playerRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
      setVolume(newVolume);
    }
  };

  const handlePlayerReady = (event: any) => {
    playerRef.current = event.target;
    event.target.mute();
    event.target.playVideo();
  };

  const handleVideoEnd = (event: any) => {
    if (playerRef.current) {
      playerRef.current.seekTo(0);
      playerRef.current.playVideo();
    }
  };

  const youtubeOpts = {
    playerVars: {
      autoplay: 1,
      mute: 1,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      playsinline: 1,
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando partido...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-white text-xl">Partido no encontrado</div>
      </div>
    );
  }

  const isFinished = match.status === 'finished';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 p-4">
      <style>{`
        .youtube-embed iframe {
          border-radius: 12px;
        }
        .youtube-embed .ytp-chrome-top,
        .youtube-embed .ytp-chrome-bottom,
        .youtube-embed .ytp-gradient-top,
        .youtube-embed .ytp-gradient-bottom,
        .youtube-embed .ytp-pause-overlay {
          display: none !important;
          opacity: 0 !important;
        }
      `}</style>
      {/* YouTube Embed */}
      {match.youtube_url && getYouTubeVideoId(match.youtube_url) && (
        <div className="max-w-4xl mx-auto mb-6 relative">
          <div className="relative pb-[56.25%] h-0 overflow-hidden rounded-xl bg-black youtube-embed">
            <YouTube
              videoId={getYouTubeVideoId(match.youtube_url)!}
              opts={youtubeOpts}
              onReady={handlePlayerReady}
              onEnd={handleVideoEnd}
              className="absolute top-0 left-0 w-full h-full"
              iframeClassName="w-full h-full"
              style={{ borderRadius: '12px' }}
            />
            <div 
              className="absolute inset-0 z-10 cursor-default"
              onContextMenu={(e) => e.preventDefault()}
              style={{ pointerEvents: 'all' }}
            />
          </div>
          <button
            onClick={toggleMute}
            className="absolute bottom-4 right-4 z-20 bg-black/70 text-white p-3 rounded-full hover:bg-black/90 transition-colors"
          >
            {isMuted ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          {!isMuted && (
            <div className="absolute bottom-4 left-4 z-20 bg-black/70 text-white px-3 py-2 rounded-full flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                className="w-20 h-1 accent-sanse-blue"
              />
              <span className="text-xs">{volume}%</span>
            </div>
          )}
        </div>
      )}

      {/* Header con sponsor */}
      <div className="max-w-4xl mx-auto mb-4">
        {match.sponsor_logo_url && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 text-center mb-4">
            <p className="text-gray-400 text-sm mb-1">Partido patrocinado por</p>
            <img src={match.sponsor_logo_url} alt="sponsor" className="h-12 mx-auto object-contain" />
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">
            {team1Category || match.team1_name}
          </h1>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            isFinished ? 'bg-gray-500' : 
            match.running ? 'bg-green-500' : 'bg-yellow-500'
          } text-white`}>
            {isFinished ? 'Finalizado' : match.running ? 'En juego' : 'Pausado'}
          </span>
        </div>
      </div>

      {/* Marcador principal */}
      <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl p-3 md:p-6 border border-white/20 mb-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-2">
          {/* Equipo 1 */}
          <div className="flex-1 text-center w-full md:w-auto">
            <div
              className="w-16 h-16 md:w-24 md:h-24 rounded-full mx-auto mb-2 flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: match.team1_color + '40' }}
            >
              {team1Logo ? (
                <img src={team1Logo} alt="logo" className="w-14 h-14 md:w-20 md:h-20 object-contain rounded-full" />
              ) : (
                <span className="text-xl md:text-2xl font-bold text-white">{match.team1_name.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            <h3 className="text-base md:text-xl font-bold text-white truncate max-w-full px-2">{match.team1_name}</h3>
            <div className="text-4xl md:text-7xl font-bold text-white my-2">{match.score_team1}</div>
          </div>

          {/* Tiempo */}
          <div className="text-center px-2 md:px-6 order-first md:order-none">
            <div className="text-xs md:text-sm text-gray-400 mb-1">CUARTO</div>
            <div className="text-2xl md:text-5xl font-bold text-white mb-1">{match.quarter}/4</div>
            <div className="text-3xl md:text-7xl font-mono font-bold text-yellow-400">{formatTime(displayTime)}</div>
          </div>

          {/* Equipo 2 */}
          <div className="flex-1 text-center w-full md:w-auto">
            <div
              className="w-16 h-16 md:w-24 md:h-24 rounded-full mx-auto mb-2 flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: match.team2_color + '40' }}
            >
              {team2Logo ? (
                <img src={team2Logo} alt="logo" className="w-14 h-14 md:w-20 md:h-20 object-contain rounded-full" />
              ) : (
                <span className="text-xl md:text-2xl font-bold text-white">{match.team2_name.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            <h3 className="text-base md:text-xl font-bold text-white truncate max-w-full px-2">{match.team2_name}</h3>
            <div className="text-4xl md:text-7xl font-bold text-white my-2">{match.score_team2}</div>
          </div>
        </div>
      </div>

      {/* Sponsor text */}
      {match.sponsor_text && (
        <div className="max-w-4xl mx-auto text-center mb-4 md:mb-6">
          <p className="text-gray-400 text-sm md:text-lg">{match.sponsor_text}</p>
        </div>
      )}

      {/* Historial de goles */}
      <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-white/20 mb-2">
        <h3 className="text-white font-bold mb-2 text-sm md:text-base">🏑 Goles ({goals.length})</h3>
        <div className="space-y-1 md:space-y-2 max-h-32 md:max-h-48 overflow-y-auto">
          {goals.length === 0 ? (
            <p className="text-gray-400 text-xs md:text-sm">Sin goles registrados</p>
          ) : (
            goals.map(goal => (
              <div key={goal.id} className="flex items-center justify-between bg-white/5 p-2 rounded text-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-yellow-400 font-bold text-xs md:text-sm whitespace-nowrap">
                    Q{goal.quarter} - {goal.match_minute}'
                  </span>
                  <span
                    className="px-1 md:px-2 py-0.5 rounded text-xs font-bold"
                    style={{ 
                      backgroundColor: goal.team === 'team1' ? match.team1_color + '40' : match.team2_color + '40',
                      color: goal.team === 'team1' ? match.team1_color : match.team2_color
                    }}
                  >
                    {goal.team === 'team1' ? match.team1_name : match.team2_name}
                  </span>
                  <span className="text-white text-xs md:text-sm">
                    {goal.player_name} {goal.dorsal && `#${goal.dorsal}`}
                  </span>
                  {goal.is_penalty && (
                    <span className="text-yellow-400 text-xs font-bold">(PC)</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Paradas */}
      <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-white/20">
        <h3 className="text-white font-bold mb-2 text-sm md:text-base">🧤 Paradas ({saves.length})</h3>
        {saves.length > 0 ? (
          <div className="space-y-1 md:space-y-2 max-h-32 md:max-h-48 overflow-y-auto">
            {saves.map(save => (
              <div key={save.id} className="flex items-center justify-between bg-white/5 p-2 rounded text-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-blue-400 font-bold text-xs md:text-sm whitespace-nowrap">
                    Q{save.quarter} - {save.match_minute}'
                  </span>
                  <span className="text-white text-xs md:text-sm">
                    {save.player_name || 'Portero'} {save.dorsal && `#${save.dorsal}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-xs md:text-sm">Sin paradas registradas</p>
        )}
      </div>

      {/* Tarjetas */}
      <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-white/20 mt-2">
        <h3 className="text-white font-bold mb-2 text-sm md:text-base">🟨 Tarjetas ({cards.length})</h3>
        {cards.length > 0 ? (
          <div className="space-y-1 md:space-y-2 max-h-32 md:max-h-48 overflow-y-auto">
            {cards.map(card => (
              <div key={card.id} className="flex items-center justify-between bg-white/5 p-2 rounded text-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">
                    {card.card_type === 'green' ? '🟢' : card.card_type === 'yellow' ? '🟡' : '🔴'}
                  </span>
                  <span className="text-white text-xs md:text-sm">
                    {card.player_name || 'Anónimo'} {card.dorsal && `#${card.dorsal}`}
                  </span>
                  <span
                    className="px-1 md:px-2 py-0.5 rounded text-xs font-bold"
                    style={{ 
                      backgroundColor: card.team === 'team1' ? match.team1_color + '40' : match.team2_color + '40',
                      color: card.team === 'team1' ? match.team1_color : match.team2_color
                    }}
                  >
                    {card.team === 'team1' ? match.team1_name : match.team2_name}
                  </span>
                  <span className="text-gray-400 text-xs">
                    Q{card.quarter} - {card.match_minute}'
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-xs md:text-sm">Sin tarjetas registradas</p>
        )}
      </div>

      {/* Penalty corner / Stroke */}
      <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-white/20 mt-2">
        <h3 className="text-white font-bold mb-2 text-sm md:text-base">🎯 Penalty corner / Stroke</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-sm text-gray-400">Penalty corner</div>
            <div className="text-xl font-bold text-white">
              {penalties.filter(p => p.event_type === 'penalty_goal').length}/
              {penalties.filter(p => p.event_type.includes('penalty')).length}
            </div>
            <div className="text-xs text-gray-500">
              goles / intentos
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-sm text-gray-400">Stroke</div>
            <div className="text-xl font-bold text-white">
              {penalties.filter(p => p.event_type === 'stroke_goal').length}/
              {penalties.filter(p => p.event_type.includes('stroke')).length}
            </div>
            <div className="text-xs text-gray-500">
              goles / intentos
            </div>
          </div>
        </div>
        {penalties.length > 0 && (
          <div className="mt-3 space-y-1 max-h-24 overflow-y-auto">
            {penalties.map(penalty => (
              <div key={penalty.id} className="flex items-center gap-2 bg-white/5 p-2 rounded text-sm">
                <span className="text-lg">
                  {penalty.event_type === 'penalty_goal' || penalty.event_type === 'stroke_goal' ? '✅' : '❌'}
                </span>
                <span
                  className="px-1 md:px-2 py-0.5 rounded text-xs font-bold"
                  style={{ 
                    backgroundColor: penalty.team === 'team1' ? match.team1_color + '40' : match.team2_color + '40',
                    color: penalty.team === 'team1' ? match.team1_color : match.team2_color
                  }}
                >
                  {penalty.team === 'team1' ? match.team1_name : match.team2_name}
                </span>
                <span className="text-gray-300 text-xs">
                  {penalty.event_type.includes('penalty') ? 'PC' : 'Stroke'}
                </span>
                <span className="text-gray-400 text-xs">
                  Q{penalty.quarter} - {penalty.match_minute}'
                </span>
              </div>
            ))}
          </div>
        )}
        {penalties.length === 0 && (
          <p className="text-gray-400 text-xs text-center mt-2">Sin penalties/strokes registrados</p>
        )}
      </div>

      {/* Shootouts */}
      {shootouts.length > 0 && (
        <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-white/20 mt-2">
          <h3 className="text-white font-bold mb-2 text-sm md:text-base">🎯 Shootouts</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="text-center bg-white/10 rounded p-2">
              <div className="text-xs text-gray-400">{match.team1_name}</div>
              <div className="text-2xl font-bold text-green-400">
                {shootouts.filter(s => s.team === 'team1' && s.scored).length}
              </div>
            </div>
            <div className="text-center bg-white/10 rounded p-2">
              <div className="text-xs text-gray-400">{match.team2_name}</div>
              <div className="text-2xl font-bold text-green-400">
                {shootouts.filter(s => s.team === 'team2' && s.scored).length}
              </div>
            </div>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {shootouts.map((s) => (
              <div key={s.id} className="flex justify-between items-center py-1 px-2 text-sm bg-white/5 rounded">
                <span className={s.team === 'team1' ? 'text-blue-400' : 'text-red-400'} style={{ minWidth: '80px' }}>
                  {s.team === 'team1' ? match.team1_name : match.team2_name}
                </span>
                <span className="text-white text-xs">{s.player_name} {s.dorsal && `#${s.dorsal}`}</span>
                <span>{s.scored ? '✅' : '❌'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overlay de eventos animados */}
      <MatchEventOverlay
        event={visibleEvent}
        eventTeam={eventTeam}
        match={match}
        onFinish={() => setVisibleEvent(null)}
      />

      {/* Reacciones flotantes */}
      <FloatingReactions ref={floatingReactionsRef} matchId={match?.id || ''} />

      {/* Botones de reacción */}
      <div className="fixed bottom-4 left-4 flex gap-2 z-50">
        <button
          onClick={() => sendReaction('clap')}
          className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full text-2xl transition-all"
        >
          👏
        </button>
        <button
          onClick={() => sendReaction('heart')}
          className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full text-2xl transition-all"
        >
          ❤️
        </button>
        <button
          onClick={() => sendReaction('fire')}
          className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full text-2xl transition-all"
        >
          🔥
        </button>
        <button
          onClick={() => sendReaction('muscle')}
          className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full text-2xl transition-all"
        >
          💪
        </button>
      </div>
    </div>
  );
};

export default MatchSpectator;
