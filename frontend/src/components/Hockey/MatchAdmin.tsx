import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { hockeyApi } from '../../lib/supabaseHockey';
import { convocationApi } from '../../lib/supabaseTeams';
import { supabase } from '../../lib/supabase';
import { HockeyMatch, HockeyPlayer, HockeyGoal, HockeySave } from '../../types/hockey';

const MatchAdmin: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [match, setMatch] = useState<HockeyMatch | null>(null);
  const [players, setPlayers] = useState<HockeyPlayer[]>([]);
  const [goals, setGoals] = useState<HockeyGoal[]>([]);
  const [saves, setSaves] = useState<HockeySave[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalTeam, setGoalTeam] = useState<'team1' | 'team2' | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [customPlayerName, setCustomPlayerName] = useState('');
  const [customPlayerNumber, setCustomPlayerNumber] = useState('');
  
  const [displayTime, setDisplayTime] = useState(0);
  const [pinAttempts, setPinAttempts] = useState(0);
  
  const [showManagePlayersModal, setShowManagePlayersModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<'team1' | 'team2' | null>(null);
  const [editingPlayers, setEditingPlayers] = useState<HockeyPlayer[]>([]);

  useEffect(() => {
    if (id) loadMatch();
  }, [id]);

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
  }, [match?.running, match?.remaining_time, match?.quarter_duration, match?.start_time]);

  // Suscripción a Supabase Realtime para sincronización
  useEffect(() => {
    if (!id) return;
    
    const channel = supabase
      .channel(`hockey-match-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hockey_matches',
          filter: `id=eq.${id}`,
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
          filter: `match_id=eq.${id}`,
        },
        () => {
          hockeyApi.getMatchGoals(id!).then(setGoals);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'hockey_goals',
          filter: `match_id=eq.${id}`,
        },
        () => {
          hockeyApi.getMatchGoals(id!).then(setGoals);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hockey_saves',
          filter: `match_id=eq.${id}`,
        },
        () => {
          hockeyApi.getMatchSaves(id!).then(setSaves);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const loadMatch = async () => {
    try {
      const matchData = await hockeyApi.getMatch(id!);
      if (!matchData) {
        alert('Partido no encontrado');
        navigate('/hockey');
        return;
      }
      
      setMatch(matchData);
      setDisplayTime(matchData.remaining_time);

      const [playersData, goalsData, savesData] = await Promise.all([
        hockeyApi.getMatchPlayers(id!),
        hockeyApi.getMatchGoals(id!),
        hockeyApi.getMatchSaves(id!),
      ]);
      
      setPlayers(playersData);
      setGoals(goalsData);
      setSaves(savesData);

      if (!matchData.admin_pin_hash) {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error loading match:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!pinInput.trim()) return;
    
    const isValid = await hockeyApi.verifyPin(id!, pinInput);
    if (isValid) {
      setIsAdmin(true);
      setShowPinModal(false);
    } else {
      alert('PIN incorrecto');
    }
    setPinInput('');
  };

  const startMatch = async () => {
    if (!match || !isAdmin) return;
    const now = Date.now();
    await hockeyApi.updateMatch(match.id, {
      running: true,
      status: 'active',
      start_time: now,
    });
    setMatch(prev => prev ? { ...prev, running: true, status: 'active', start_time: now } : null);
  };

  const pauseMatch = async () => {
    if (!match || !isAdmin || !match.running) return;
    const elapsed = match.start_time ? Math.floor((Date.now() - match.start_time) / 1000) : 0;
    const newRemaining = Math.max(0, match.remaining_time - elapsed);
    await hockeyApi.updateMatch(match.id, {
      running: false,
      status: 'paused',
      remaining_time: newRemaining,
      start_time: null,
    });
    setMatch(prev => prev ? { ...prev, running: false, status: 'paused', remaining_time: newRemaining, start_time: null } : null);
    setDisplayTime(newRemaining);
  };

  const resetQuarter = async () => {
    if (!match || !isAdmin) return;
    await hockeyApi.updateMatch(match.id, {
      remaining_time: match.quarter_duration,
      running: false,
      start_time: null,
    });
    setMatch(prev => prev ? { ...prev, remaining_time: match.quarter_duration, running: false, start_time: null } : null);
    setDisplayTime(match.quarter_duration);
  };

  const setQuarter = async (q: number) => {
    if (!match || !isAdmin) return;
    await hockeyApi.updateMatch(match.id, {
      quarter: q,
      remaining_time: match.quarter_duration,
      running: false,
      start_time: null,
    });
    setMatch(prev => prev ? { ...prev, quarter: q, remaining_time: match.quarter_duration, running: false, start_time: null } : null);
    setDisplayTime(match.quarter_duration);
  };

  const handlePlus = (team: 'team1' | 'team2') => {
    setGoalTeam(team);
    setShowGoalModal(true);
    setSelectedPlayer('');
    setCustomPlayerName('');
    setCustomPlayerNumber('');
  };

  const handleMinus = async (team: 'team1' | 'team2') => {
    if (!isAdmin || goals.length === 0) return;
    
    const teamGoals = goals.filter(g => g.team === team);
    if (teamGoals.length === 0) return;
    
    const lastGoal = teamGoals[teamGoals.length - 1];
    await hockeyApi.removeGoal(lastGoal.id);
    
    const updatedGoals = await hockeyApi.getMatchGoals(id!);
    setGoals(updatedGoals);
    
    const updatedMatch = await hockeyApi.getMatch(id!);
    if (updatedMatch) setMatch(updatedMatch);
  };

  const confirmGoal = async () => {
    if (!match || !goalTeam || !isAdmin) return;

    const qDuration = match.quarter_duration;
    const elapsedInQuarter = qDuration - displayTime;
    const secondsBefore = (match.quarter - 1) * qDuration;
    const matchMinute = Math.floor((secondsBefore + elapsedInQuarter) / 60);

    const selected = players.find(p => p.id === selectedPlayer && p.team === goalTeam);

    await hockeyApi.addGoal(match.id, {
      team: goalTeam,
      player_id: selected?.id,
      player_name: customPlayerName || selected?.player_name || 'Anónimo',
      dorsal: customPlayerNumber || selected?.dorsal,
      quarter: match.quarter,
      elapsed_in_quarter: elapsedInQuarter,
      match_minute: matchMinute,
      is_penalty: false,
    });

    const [updatedGoals, updatedMatch] = await Promise.all([
      hockeyApi.getMatchGoals(id!),
      hockeyApi.getMatch(id!),
    ]);
    
    setGoals(updatedGoals);
    if (updatedMatch) setMatch(updatedMatch);
    
    setShowGoalModal(false);
    setGoalTeam(null);
  };

  const triggerSave = async () => {
    if (!match || !isAdmin) return;
    
    const qDuration = match.quarter_duration;
    const elapsedInQuarter = qDuration - displayTime;
    const secondsBefore = (match.quarter - 1) * qDuration;
    const matchMinute = Math.floor((secondsBefore + elapsedInQuarter) / 60);

    await hockeyApi.addSave(match.id, {
      team: 'team1',
      player_name: 'Portera',
      quarter: match.quarter,
      match_minute: matchMinute,
    });

    const updatedSaves = await hockeyApi.getMatchSaves(id!);
    setSaves(updatedSaves);
  };

  const finishMatch = async () => {
    if (!match || !isAdmin) return;
    if (!window.confirm('¿Finalizar el partido?')) return;
    
    await hockeyApi.updateMatch(match.id, {
      running: false,
      status: 'finished',
    });
    setMatch(prev => prev ? { ...prev, running: false, status: 'finished' } : null);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/hockey/${match?.share_token}/watch`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Enlace copiado al portapapeles');
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getTeamPlayers = (team: 'team1' | 'team2') => {
    return players.filter(p => p.team === team);
  };

  const openManagePlayers = async (team: 'team1' | 'team2') => {
    const teamPlayers = getTeamPlayers(team);
    
    // Si es el equipo 1 (nuestro club) y hay un event_id, intentar cargar convocatorias
    if (team === 'team1' && match?.event_id) {
      try {
        const convocations = await convocationApi.getConvocation(match.event_id);
        const acceptedPlayers = convocations.filter(c => c.status === 'accepted');
        
        if (acceptedPlayers.length > 0) {
          const playersFromConvocation: HockeyPlayer[] = acceptedPlayers.map(c => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2),
            match_id: id!,
            team: 'team1',
            player_name: c.player?.full_name || 'Jugador',
            dorsal: c.player?.dorsal?.toString() || '',
            is_goalkeeper: false,
          }));
          
          await hockeyApi.setMatchPlayers(id!, playersFromConvocation);
          await loadMatch();
          alert(`Se han añadido ${playersFromConvocation.length} jugadores de la convocatoria`);
          return;
        } else {
          alert('No hay jugadores aceptados en la convocatoria. Añádelos manualmente.');
        }
      } catch (error) {
        console.error('Error loading convocation:', error);
        alert('Error al cargar la convocatoria. Añade los jugadores manualmente.');
      }
    }
    
    // Para equipo 2 o si falló lo anterior, abrir modal manual
    setEditingTeam(team);
    setEditingPlayers(teamPlayers);
    setShowManagePlayersModal(true);
  };

  const handleSavePlayers = async () => {
    if (!editingTeam || !id) return;
    try {
      const playersToSave = editingPlayers.map(p => ({
        ...p,
        match_id: id,
        team: editingTeam,
      }));
      await hockeyApi.setMatchPlayers(id, playersToSave);
      await loadMatch();
      setShowManagePlayersModal(false);
      setEditingTeam(null);
      setEditingPlayers([]);
      alert('Jugadores guardados');
    } catch (error) {
      console.error('Error saving players:', error);
      alert('Error al guardar jugadores');
    }
  };

  const addNewPlayer = () => {
    const newPlayer: HockeyPlayer = {
      id: Date.now().toString(),
      match_id: id!,
      team: editingTeam!,
      player_name: '',
      dorsal: '',
      position: '',
      is_goalkeeper: false,
    };
    setEditingPlayers([...editingPlayers, newPlayer]);
  };

  const updateEditingPlayer = (playerId: string, field: string, value: string) => {
    setEditingPlayers(editingPlayers.map(p => 
      p.id === playerId ? { ...p, [field]: value } : p
    ));
  };

  const removeEditingPlayer = (playerId: string) => {
    setEditingPlayers(editingPlayers.filter(p => p.id !== playerId));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando partido...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Partido no encontrado</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">🔐 Acceso Admin</h2>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 mb-4"
            placeholder="Introduce el PIN"
          />
          <button
            onClick={handleVerifyPin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold"
          >
            Verificar PIN
          </button>
          <button
            onClick={() => navigate('/hockey')}
            className="w-full mt-3 bg-gray-600 text-white py-2 rounded-lg"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">🏑 Partido de Hockey</h1>
            <p className="text-gray-300">
              <span className="font-mono bg-black/30 px-2 py-1 rounded">{match.id.slice(0, 8)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyShareLink}
              className="bg-green-600 text-white px-4 py-2 rounded-lg"
            >
              📤 Compartir
            </button>
            <button
              onClick={() => navigate('/hockey')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Marcador */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <div className="flex justify-between items-center mb-4">
            {/* Equipo 1 */}
            <div className="flex-1 text-center">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-2 flex items-center justify-center text-3xl"
                style={{ backgroundColor: match.team1_color + '40' }}
              >
                {match.team1_logo_url ? (
                  <img src={match.team1_logo_url} alt="logo" className="w-16 h-16 object-contain" />
                ) : (
                  <span className="text-2xl font-bold text-white">{match.team1_name.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white">{match.team1_name}</h3>
              <div className="text-6xl font-bold text-white my-4">{match.score_team1}</div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handlePlus('team1')}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold"
                >
                  +1 Gol
                </button>
                <button
                  onClick={() => handleMinus('team1')}
                  disabled={match.score_team1 === 0}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                >
                  -
                </button>
              </div>
            </div>

            {/* Tiempo */}
            <div className="text-center px-6">
              <div className="text-sm text-gray-400 mb-2">CUARTO</div>
              <div className="text-4xl font-bold text-white mb-2">{match.quarter}/4</div>
              <div className="text-6xl font-mono font-bold text-yellow-400">{formatTime(displayTime)}</div>
              <div className="mt-4 flex gap-2 justify-center">
                {!match.running ? (
                  <button
                    onClick={startMatch}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    ▶ Iniciar
                  </button>
                ) : (
                  <button
                    onClick={pauseMatch}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    ⏸ Pausar
                  </button>
                )}
                <button
                  onClick={resetQuarter}
                  className="bg-gray-600 text-white px-3 py-2 rounded-lg"
                >
                  🔄
                </button>
              </div>
            </div>

            {/* Equipo 2 */}
            <div className="flex-1 text-center">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-2 flex items-center justify-center text-3xl"
                style={{ backgroundColor: match.team2_color + '40' }}
              >
                {match.team2_logo_url ? (
                  <img src={match.team2_logo_url} alt="logo" className="w-16 h-16 object-contain" />
                ) : (
                  <span className="text-2xl font-bold text-white">{match.team2_name.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white">{match.team2_name}</h3>
              <div className="text-6xl font-bold text-white my-4">{match.score_team2}</div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handlePlus('team2')}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold"
                >
                  +1 Gol
                </button>
                <button
                  onClick={() => handleMinus('team2')}
                  disabled={match.score_team2 === 0}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                >
                  -
                </button>
              </div>
            </div>
          </div>

          {/* Selector de cuarto */}
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3, 4].map(q => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={`px-4 py-2 rounded-lg font-bold ${
                  match.quarter === q
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Q{q}
              </button>
            ))}
          </div>

          {/* Botones para gestionar jugadores por equipo */}
          <div className="mt-6 p-4 bg-yellow-600/20 rounded-xl border border-yellow-600">
            <p className="text-yellow-300 text-center mb-3">Gestión de jugadores</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {getTeamPlayers('team1').length === 0 && (
                <button
                  onClick={() => openManagePlayers('team1')}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-bold"
                >
                  👥 Añadir {match.team1_name}
                </button>
              )}
              {getTeamPlayers('team2').length === 0 && (
                <button
                  onClick={() => openManagePlayers('team2')}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-bold"
                >
                  👥 Añadir {match.team2_name}
                </button>
              )}
              {getTeamPlayers('team1').length > 0 && getTeamPlayers('team2').length > 0 && (
                <p className="text-green-400 text-center w-full">✓ Todos los equipos tienen jugadores</p>
              )}
            </div>
          </div>
        </div>

        {/* Controles adicionales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white/10 rounded-xl p-4 border border-white/10">
            <h3 className="text-white font-bold mb-3">🧤 Paradas del Portero</h3>
            <button
              onClick={triggerSave}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg"
            >
              🧤 Registrar Parada
            </button>
            <p className="text-gray-400 text-sm mt-2">
              Paradas registradas: {saves.length}
            </p>
          </div>

          <div className="bg-white/10 rounded-xl p-4 border border-white/10">
            <h3 className="text-white font-bold mb-3">⚙️ Acciones</h3>
            <div className="space-y-2">
              <button
                onClick={finishMatch}
                disabled={match.status === 'finished'}
                className="w-full bg-red-600 text-white py-2 rounded-lg font-bold disabled:opacity-50"
              >
                🏁 Finalizar Partido
              </button>
              <a
                href={`/hockey/${match.share_token}/watch`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-purple-600 text-white py-2 rounded-lg font-bold text-center"
              >
                👀 Vista Espectador
              </a>
            </div>
          </div>
        </div>

        {/* Historial de goles */}
        <div className="bg-white/10 rounded-xl p-4 border border-white/10">
          <h3 className="text-white font-bold mb-3">🏑 Historial de Goles ({goals.length})</h3>
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
                      {goal.team === 'team1' ? match.team1_name : match.team2_name}
                    </span>
                    <span className="text-white">
                      {goal.player_name} {goal.dorsal && `#${goal.dorsal}`}
                    </span>
                  </div>
                  <button
                    onClick={() => hockeyApi.removeGoal(goal.id).then(loadMatch)}
                    className="text-red-400 hover:text-red-300"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal de gol */}
        {showGoalModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#071025] rounded-2xl p-6 max-w-md w-full border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">
                🏑 Registrar Gol - {goalTeam === 'team1' ? match.team1_name : match.team2_name}
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">Seleccionar jugador</label>
                <select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
                >
                  <option value="">-- Seleccionar --</option>
                  {getTeamPlayers(goalTeam!).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.player_name} {p.dorsal && `#${p.dorsal}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">O escribir nombre manual</label>
                <input
                  type="text"
                  value={customPlayerName}
                  onChange={(e) => setCustomPlayerName(e.target.value)}
                  className="w-full p-2 rounded bg-white/10 text-white border border-white/20 mb-2"
                  placeholder="Nombre del jugador"
                />
                <input
                  type="text"
                  value={customPlayerNumber}
                  onChange={(e) => setCustomPlayerNumber(e.target.value)}
                  className="w-full p-2 rounded bg-white/10 text-white border border-white/20"
                  placeholder="Dorsal (opcional)"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowGoalModal(false)}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmGoal}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold"
                >
                  Confirmar Gol
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para gestionar jugadores */}
        {showManagePlayersModal && editingTeam && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#071025] rounded-2xl p-6 max-w-lg w-full border border-white/10 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-white mb-4">
                👥 Jugadores - {editingTeam === 'team1' ? match.team1_name : match.team2_name}
              </h3>

              <div className="space-y-3 mb-4">
                {editingPlayers.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No hay jugadores. Añade uno.</p>
                ) : (
                  editingPlayers.map((player, index) => (
                    <div key={player.id} className="flex gap-2 items-center bg-white/5 p-2 rounded-lg">
                      <span className="text-white w-6">{index + 1}.</span>
                      <input
                        type="text"
                        value={player.player_name}
                        onChange={(e) => updateEditingPlayer(player.id, 'player_name', e.target.value)}
                        placeholder="Nombre del jugador"
                        className="flex-1 p-2 rounded bg-white/10 text-white border border-white/20 text-sm"
                      />
                      <input
                        type="text"
                        value={player.dorsal || ''}
                        onChange={(e) => updateEditingPlayer(player.id, 'dorsal', e.target.value)}
                        placeholder="Dorsal"
                        className="w-16 p-2 rounded bg-white/10 text-white border border-white/20 text-sm text-center"
                      />
                      <button
                        onClick={() => removeEditingPlayer(player.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={addNewPlayer}
                className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
              >
                + Añadir Jugador
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowManagePlayersModal(false); setEditingTeam(null); setEditingPlayers([]); }}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePlayers}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchAdmin;
