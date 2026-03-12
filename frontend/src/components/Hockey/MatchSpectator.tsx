import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YouTube from 'react-youtube';
import { hockeyApi } from '../../lib/supabaseHockey';
import { supabase } from '../../lib/supabase';
import { HockeyMatch, HockeyGoal, HockeySave } from '../../types/hockey';

const MatchSpectator: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [match, setMatch] = useState<HockeyMatch | null>(null);
  const [goals, setGoals] = useState<HockeyGoal[]>([]);
  const [saves, setSaves] = useState<HockeySave[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);
  const [visibleEvent, setVisibleEvent] = useState<'goal' | 'save' | null>(null);
  const [eventTeam, setEventTeam] = useState<'team1' | 'team2' | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(30);
  const playerRef = useRef<any>(null);

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
    if (!match?.id) return;
    
    const channel = supabase
      .channel(`hockey-spectator-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hockey_matches',
          filter: `id=eq.${match.id}`,
        },
        (payload) => {
          if (payload.new) {
            const newData = payload.new as HockeyMatch;
            setMatch(prev => prev ? { ...prev, ...newData } : newData);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hockey_goals',
          filter: `match_id=eq.${match.id}`,
        },
        () => {
          hockeyApi.getMatchGoals(match.id).then(setGoals);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hockey_saves',
          filter: `match_id=eq.${match.id}`,
        },
        () => {
          hockeyApi.getMatchSaves(match.id).then(setSaves);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match?.id]);

  useEffect(() => {
    if (goals.length > 0) {
      const lastGoal = goals[goals.length - 1];
      setVisibleEvent('goal');
      setEventTeam(lastGoal.team);
      const timer = setTimeout(() => setVisibleEvent(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [goals.length]);

  useEffect(() => {
    if (saves.length > 0) {
      const lastSave = saves[saves.length - 1];
      if (!visibleEvent) {
        setVisibleEvent('save');
        setEventTeam(lastSave.team);
        const timer = setTimeout(() => setVisibleEvent(null), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [saves.length]);

  const loadMatch = async () => {
    try {
      const matchData = await hockeyApi.getMatchByToken(token!);
      if (!matchData) {
        alert('Partido no encontrado');
        navigate('/match');
        return;
      }
      
      setMatch(matchData);
      setDisplayTime(matchData.remaining_time);

      const [goalsData, savesData] = await Promise.all([
        hockeyApi.getMatchGoals(matchData.id),
        hockeyApi.getMatchSaves(matchData.id),
      ]);
      
      setGoals(goalsData);
      setSaves(savesData);
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
      {/* YouTube Embed */}
      {match.youtube_url && getYouTubeVideoId(match.youtube_url) && (
        <div className="max-w-4xl mx-auto mb-6 relative">
          <div className="relative pb-[56.25%] h-0 overflow-hidden rounded-xl bg-black">
            <YouTube
              videoId={getYouTubeVideoId(match.youtube_url)!}
              opts={youtubeOpts}
              onReady={handlePlayerReady}
              className="absolute top-0 left-0 w-full h-full"
              iframeClassName="w-full h-full"
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
            {match.team1_name} vs {match.team2_name}
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
      <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
        <div className="flex justify-between items-center">
          {/* Equipo 1 */}
          <div className="flex-1 text-center">
            <div
              className="w-24 h-24 rounded-full mx-auto mb-3 flex items-center justify-center text-4xl"
              style={{ backgroundColor: match.team1_color + '40' }}
            >
              {match.team1_logo_url ? (
                <img src={match.team1_logo_url} alt="logo" className="w-20 h-20 object-contain" />
              ) : (
                '🏠'
              )}
            </div>
            <h3 className="text-xl font-bold text-white">{match.team1_name}</h3>
            <div className="text-7xl font-bold text-white my-4">{match.score_team1}</div>
          </div>

          {/* Tiempo */}
          <div className="text-center px-6">
            <div className="text-sm text-gray-400 mb-2">CUARTO</div>
            <div className="text-5xl font-bold text-white mb-2">{match.quarter}/4</div>
            <div className="text-7xl font-mono font-bold text-yellow-400">{formatTime(displayTime)}</div>
          </div>

          {/* Equipo 2 */}
          <div className="flex-1 text-center">
            <div
              className="w-24 h-24 rounded-full mx-auto mb-3 flex items-center justify-center text-4xl"
              style={{ backgroundColor: match.team2_color + '40' }}
            >
              {match.team2_logo_url ? (
                <img src={match.team2_logo_url} alt="logo" className="w-20 h-20 object-contain" />
              ) : (
                '✈️'
              )}
            </div>
            <h3 className="text-xl font-bold text-white">{match.team2_name}</h3>
            <div className="text-7xl font-bold text-white my-4">{match.score_team2}</div>
          </div>
        </div>
      </div>

      {/* Sponsor text */}
      {match.sponsor_text && (
        <div className="max-w-4xl mx-auto text-center mb-6">
          <p className="text-gray-400 text-lg">{match.sponsor_text}</p>
        </div>
      )}

      {/* Historial de goles */}
      <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
        <h3 className="text-white font-bold mb-3">⚽ Goles ({goals.length})</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {goals.length === 0 ? (
            <p className="text-gray-400 text-sm">No hay goles todavía</p>
          ) : (
            goals.map(goal => (
              <div key={goal.id} className="flex items-center justify-between bg-white/5 p-2 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 font-bold">Q{goal.quarter}'</span>
                  <span
                    className="px-2 py-1 rounded text-sm font-bold"
                    style={{ 
                      backgroundColor: goal.team === 'team1' ? match.team1_color + '40' : match.team2_color + '40',
                      color: goal.team === 'team1' ? match.team1_color : match.team2_color
                    }}
                  >
                    {goal.team === 'team1' ? match.team1_name.slice(0, 10) : match.team2_name.slice(0, 10)}
                  </span>
                  <span className="text-white">
                    {goal.player_name} {goal.dorsal && `#${goal.dorsal}`}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Paradas */}
      <div className="max-w-4xl mx-auto mt-4 bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
        <h3 className="text-white font-bold mb-3">🧤 Paradas ({saves.length})</h3>
        <p className="text-gray-400 text-sm">
          {saves.length > 0 
            ? `El portero ha realizado ${saves.length} parada${saves.length > 1 ? 's' : ''}`
            : 'No hay paradas registradas'
          }
        </p>
      </div>

      {/* Animación de gol equipo 1 */}
      {visibleEvent === 'goal' && eventTeam === 'team1' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="text-7xl font-extrabold text-yellow-400 drop-shadow-xl animate-wiggle">
            🎉🏑 ¡GOOOOOL! 🏑🎉
          </div>
        </div>
      )}

      {/* Animación de gol equipo 2 */}
      {visibleEvent === 'goal' && eventTeam === 'team2' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="text-6xl font-extrabold text-white drop-shadow-xl text-center">
            <div className="text-5xl">😭⚽ ¡Gol del rival! 😭</div>
          </div>
        </div>
      )}

      {/* Animación de parada */}
      {visibleEvent === 'save' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="text-6xl font-extrabold text-blue-300 drop-shadow-xl animate-wiggle text-center">
            🧤 ¡QUE ATAJADA!
          </div>
        </div>
      )}

      {/* Estilos de animación */}
      <style>{`
        @keyframes wiggle {
          0% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-8px) rotate(-6deg); }
          50% { transform: translateX(8px) rotate(6deg); }
          75% { transform: translateX(-4px) rotate(-3deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        .animate-wiggle { animation: wiggle 0.9s ease-in-out both; }
      `}</style>
    </div>
  );
};

export default MatchSpectator;
