import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { hockeyApi } from '../../lib/supabaseHockey';
import { convocationApi, clubsApi, eventsApi } from '../../lib/supabaseTeams';
import { supabase } from '../../lib/supabase';
import { HockeyMatch, HockeyPlayer, HockeyGoal, HockeySave, HockeyCard, MatchLineup, CardType, HockeyPenaltyMiss, HockeyShootout } from '../../types/hockey';
import { generateMatchPDF } from '../../lib/pdfExport';

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

  const [team1Logo, setTeam1Logo] = useState<string>('');
  const [team2Logo, setTeam2Logo] = useState<string>('');
  const [convocationPlayers, setConvocationPlayers] = useState<{ id: string; name: string; dorsal?: string }[]>([]);
  const [finalConvocation, setFinalConvocation] = useState<string[]>([]);
  const [goalkeepers, setGoalkeepers] = useState<{ id: string; name: string; dorsal?: string }[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedGoalkeeper, setSelectedGoalkeeper] = useState<string>('');
  const [customGoalkeeperName, setCustomGoalkeeperName] = useState('');
  const [customGoalkeeperNumber, setCustomGoalkeeperNumber] = useState('');
  
  // Cards
  const [cards, setCards] = useState<HockeyCard[]>([]);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardTeam, setCardTeam] = useState<'team1' | 'team2'>('team1');
  const [cardType, setCardType] = useState<CardType>('yellow');
  const [selectedCardPlayer, setSelectedCardPlayer] = useState<string>('');
  
  // Penalty/Stroke
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [penaltyType, setPenaltyType] = useState<'penalty' | 'stroke'>('penalty');
  const [penaltyTeam, setPenaltyTeam] = useState<'team1' | 'team2'>('team1');
  const [penaltyResult, setPenaltyResult] = useState<'goal' | 'miss' | null>(null);
  const [penaltyMisses, setPenaltyMisses] = useState<HockeyPenaltyMiss[]>([]);
  const [pendingPenaltyGoal, setPendingPenaltyGoal] = useState<{type: 'penalty' | 'stroke', team: 'team1' | 'team2'} | null>(null);
  
  // Lineup
  const [lineup, setLineup] = useState<MatchLineup[]>([]);
  const [showLineupModal, setShowLineupModal] = useState(false);

  // Tie / Shootouts
  const [showTieModal, setShowTieModal] = useState(false);
  const [showShootoutModal, setShowShootoutModal] = useState(false);
  const [shootouts, setShootouts] = useState<HockeyShootout[]>([]);
  const [shootoutTeam, setShootoutTeam] = useState<'team1' | 'team2'>('team1');
  const [shootoutScored, setShootoutScored] = useState<boolean>(true);
  const [selectedShootoutPlayer, setSelectedShootoutPlayer] = useState<string>('');

  useEffect(() => {
    if (id) loadMatch();
  }, [id]);

  const clearReactions = async (matchId: string) => {
    try {
      await supabase
        .from('match_reactions')
        .delete()
        .eq('match_id', matchId);
    } catch (error) {
      console.error('Error clearing reactions:', error);
    }
  };

  // Avance automático de cuarto cuando el tiempo llega a 0
  useEffect(() => {
    if (!match || !isAdmin) return;
    if (!match.running) return;
    if (displayTime > 0) return;

    // El tiempo llegó a 0
    const handleQuarterEnd = async () => {
      try {
        if (match.quarter >= 4) {
          // Último cuarto finalizado
          const finalMatch = await hockeyApi.getMatch(match.id);
          
          if (finalMatch && finalMatch.score_team1 === finalMatch.score_team2) {
            // EMPATE - Mostrar modal de shootouts
            setShowTieModal(true);
          } else {
            // Sin empate - Finalizar partido
            await hockeyApi.updateMatch(match.id, {
              running: false,
              status: 'finished',
            });
            await clearReactions(match.id);
            setMatch(prev => prev ? { 
              ...prev, 
              running: false,
              status: 'finished'
            } : null);
          }
        } else {
          // Avanzar al siguiente cuarto
          const nextQuarter = match.quarter + 1;
          await hockeyApi.updateMatch(match.id, {
            quarter: nextQuarter,
            remaining_time: match.quarter_duration,
            running: false,
            start_time: null,
          });
          setMatch(prev => prev ? { 
            ...prev, 
            quarter: nextQuarter, 
            remaining_time: match.quarter_duration, 
            running: false, 
            start_time: null 
          } : null);
          setDisplayTime(match.quarter_duration);
        }
      } catch (error) {
        console.error('Error ending quarter:', error);
      }
    };

    // Pequeño delay para evitar múltiples llamadas
    const timer = setTimeout(handleQuarterEnd, 500);
    return () => clearTimeout(timer);
  }, [displayTime, match?.running, match?.quarter, match?.quarter_duration, isAdmin]);

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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_cards',
          filter: `match_id=eq.${id}`,
        },
        () => {
          hockeyApi.getMatchCards(id!).then(setCards);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hockey_penalty_misses',
          filter: `match_id=eq.${id}`,
        },
        () => {
          hockeyApi.getMatchPenaltyMisses(id!).then(setPenaltyMisses);
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
        navigate('/match');
        return;
      }
      
      setMatch(matchData);
      setDisplayTime(matchData.remaining_time);

      // Cargar logos de equipos/clubes
      let logo1 = matchData.team1_logo_url || '';
      let logo2 = matchData.team2_logo_url || '';
      
      const clubsData = await clubsApi.getClubs();
      
      // Logo equipo 1
      if (!logo1) {
        const club1 = clubsData.find(c => c.name === matchData.team1_name);
        if (club1?.logo_url) logo1 = club1.logo_url;
      }
      
      // Logo equipo 2 (rival)
      if (!logo2) {
        const club2 = clubsData.find(c => c.name === matchData.team2_name);
        if (club2?.logo_url) logo2 = club2.logo_url;
      }
      
      // Si hay evento, obtener logo desde el club del equipo
      if (matchData.event_id && !logo1) {
        const eventData = await eventsApi.getEvent(matchData.event_id);
        if (eventData?.team?.club?.logo_url) {
          logo1 = eventData.team.club.logo_url;
        }
        // Obtener la convocatoria final del evento
        if (eventData?.final_convocation) {
          const finalConv = JSON.parse(eventData.final_convocation);
          setFinalConvocation(finalConv);
        }
      }
      
      setTeam1Logo(logo1);
      setTeam2Logo(logo2);

      const [playersData, goalsData, savesData, cardsData, lineupData, penaltyMissesData, shootoutsData] = await Promise.all([
        hockeyApi.getMatchPlayers(id!),
        hockeyApi.getMatchGoals(id!),
        hockeyApi.getMatchSaves(id!),
        hockeyApi.getMatchCards(id!),
        hockeyApi.getLineup(id!),
        hockeyApi.getMatchPenaltyMisses(id!),
        hockeyApi.getMatchShootouts(id!),
      ]);
      
      setPlayers(playersData);
      setGoals(goalsData);
      setSaves(savesData);
      setCards(cardsData);
      setLineup(lineupData);
      setPenaltyMisses(penaltyMissesData);
      setShootouts(shootoutsData);

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

  const loadConvocationPlayers = async () => {
    if (!match?.event_id) {
      setConvocationPlayers([]);
      return;
    }
    
    try {
      // Obtener el evento directamente para tener final_convocation actualizado
      const event = await eventsApi.getEvent(match.event_id);
      const finalConvIds = event?.final_convocation 
        ? JSON.parse(event.final_convocation) 
        : [];
      
      const convocations = await convocationApi.getConvocation(match.event_id);
      
      let calledPlayers;
      
      if (finalConvIds.length > 0) {
        calledPlayers = convocations
          .filter(c => finalConvIds.includes(c.player_id))
          .filter(c => c.player?.position !== 'Portera' && c.player?.position !== 'Portero')
          .map(c => ({
            id: c.player_id || c.id,
            name: c.player?.full_name || 'Jugador',
            dorsal: c.player?.dorsal?.toString(),
          }));
      } else {
        calledPlayers = convocations
          .filter(c => c.player?.position !== 'Portera' && c.player?.position !== 'Portero')
          .map(c => ({
            id: c.player_id || c.id,
            name: c.player?.full_name || 'Jugador',
            dorsal: c.player?.dorsal?.toString(),
          }));
      }
      
      setConvocationPlayers(calledPlayers);
    } catch (error) {
      console.error('Error loading convocation:', error);
      setConvocationPlayers([]);
    }
  };

  const loadGoalkeepers = async () => {
    if (!match?.event_id) {
      setGoalkeepers([]);
      return;
    }
    
    try {
      const event = await eventsApi.getEvent(match.event_id);
      const finalConvIds = event?.final_convocation 
        ? JSON.parse(event.final_convocation) 
        : [];
      
      const convocations = await convocationApi.getConvocation(match.event_id);
      
      let gks;
      
      if (finalConvIds.length > 0) {
        gks = convocations
          .filter(c => finalConvIds.includes(c.player_id))
          .filter(c => c.player?.position === 'Portera' || c.player?.position === 'Portero')
          .map(c => ({
            id: c.player_id || c.id,
            name: c.player?.full_name || 'Portera',
            dorsal: c.player?.dorsal?.toString(),
          }));
      } else {
        gks = convocations
          .filter(c => c.player?.position === 'Portera' || c.player?.position === 'Portero')
          .map(c => ({
            id: c.player_id || c.id,
            name: c.player?.full_name || 'Portera',
            dorsal: c.player?.dorsal?.toString(),
          }));
      }
      
      setGoalkeepers(gks);
    } catch (error) {
      console.error('Error loading goalkeepers:', error);
      setGoalkeepers([]);
    }
  };

  const handlePlus = (team: 'team1' | 'team2') => {
    setGoalTeam(team);
    setShowGoalModal(true);
    setSelectedPlayer('');
    setCustomPlayerName('');
    setCustomPlayerNumber('');
    
    if (team === 'team1') {
      loadConvocationPlayers();
    }
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

    let selectedPlayerName = 'Anónimo';
    let selectedPlayerDorsal: string | undefined;
    let selectedPlayerId: string | undefined;

    if (selectedPlayer) {
      if (goalTeam === 'team1' && convocationPlayers.length > 0) {
        const convPlayer = convocationPlayers.find(p => p.id === selectedPlayer);
        if (convPlayer) {
          selectedPlayerName = convPlayer.name;
          selectedPlayerDorsal = convPlayer.dorsal;
          selectedPlayerId = convPlayer.id;
        }
      } else {
        const matchPlayer = players.find(p => p.id === selectedPlayer && p.team === goalTeam);
        if (matchPlayer) {
          selectedPlayerName = matchPlayer.player_name;
          selectedPlayerDorsal = matchPlayer.dorsal;
          selectedPlayerId = matchPlayer.id;
        }
      }
    }

    const isPenaltyGoal = pendingPenaltyGoal !== null;
    const finalPlayerName = customPlayerName || selectedPlayerName;
    const finalDorsal = customPlayerNumber || selectedPlayerDorsal;

    await hockeyApi.addGoal(match.id, {
      team: goalTeam,
      player_id: selectedPlayerId,
      player_name: finalPlayerName,
      dorsal: finalDorsal,
      quarter: match.quarter,
      elapsed_in_quarter: elapsedInQuarter,
      match_minute: matchMinute,
      is_penalty: isPenaltyGoal,
    });

    const [updatedGoals, updatedMatch] = await Promise.all([
      hockeyApi.getMatchGoals(id!),
      hockeyApi.getMatch(id!),
    ]);
    
    setGoals(updatedGoals);
    if (updatedMatch) setMatch(updatedMatch);
    
    setShowGoalModal(false);
    setGoalTeam(null);
    setPendingPenaltyGoal(null);
    setSelectedPlayer('');
    setCustomPlayerName('');
    setCustomPlayerNumber('');
  };

  const triggerSave = () => {
    if (!match || !isAdmin) return;
    
    loadGoalkeepers();
    setShowSaveModal(true);
    setSelectedGoalkeeper('');
    setCustomGoalkeeperName('');
    setCustomGoalkeeperNumber('');
  };

  const confirmSave = async () => {
    if (!match || !isAdmin) return;

    const qDuration = match.quarter_duration;
    const elapsedInQuarter = qDuration - displayTime;
    const secondsBefore = (match.quarter - 1) * qDuration;
    const matchMinute = Math.floor((secondsBefore + elapsedInQuarter) / 60);

    let selectedGoalkeeperName = 'Portera';
    let selectedGoalkeeperDorsal: string | undefined;
    let selectedGoalkeeperId: string | undefined;

    if (selectedGoalkeeper) {
      if (goalkeepers.length > 0) {
        const gk = goalkeepers.find(g => g.id === selectedGoalkeeper);
        if (gk) {
          selectedGoalkeeperName = gk.name;
          selectedGoalkeeperDorsal = gk.dorsal;
          selectedGoalkeeperId = gk.id;
        }
      }
    }

    await hockeyApi.addSave(match.id, {
      team: 'team1',
      player_id: selectedGoalkeeperId,
      player_name: customGoalkeeperName || selectedGoalkeeperName,
      dorsal: customGoalkeeperNumber || selectedGoalkeeperDorsal,
      quarter: match.quarter,
      elapsed_in_quarter: elapsedInQuarter,
      match_minute: matchMinute,
    });

    const updatedSaves = await hockeyApi.getMatchSaves(id!);
    setSaves(updatedSaves);

    setShowSaveModal(false);
    setSelectedGoalkeeper('');
    setCustomGoalkeeperName('');
    setCustomGoalkeeperNumber('');
  };

  const closeSaveModal = () => {
    setShowSaveModal(false);
    setSelectedGoalkeeper('');
    setCustomGoalkeeperName('');
    setCustomGoalkeeperNumber('');
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
            onClick={() => navigate('/match')}
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
            <h1 className="text-3xl font-bold text-white mb-2">🏑 Partido de Hockey - Admin</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={async () => {
                try {
                  await generateMatchPDF({
                    match,
                    goals,
                    saves,
                    cards,
                    penaltyMisses,
                    shootouts,
                  });
                } catch (error) {
                  console.error('Error generating PDF:', error);
                  alert('Error al generar el PDF');
                }
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700"
            >
              📄 Exportar PDF
            </button>
            <button
              onClick={() => navigate('/match')}
              className="bg-red-600 text-white px-4 py-2 rounded-lg"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Marcador */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/20 mb-4 md:mb-6">
          {/* Tiempo - Solo visible en desktop */}
          <div className="hidden md:block text-center mb-4">
            <div className="text-sm text-gray-400 mb-2">CUARTO</div>
            <div className="text-4xl font-bold text-white mb-2">{match.quarter}/4</div>
            <div className="text-5xl md:text-6xl font-mono font-bold text-yellow-400">{formatTime(displayTime)}</div>
            {match.status === 'finished' ? (
              <div className="mt-4 text-red-500 font-bold text-lg">PARTIDO FINALIZADO</div>
            ) : (
            <div className="mt-4 flex gap-2 justify-center flex-wrap">
              {!match.running ? (
                <button
                  onClick={startMatch}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm md:text-base"
                >
                  ▶ Iniciar
                </button>
              ) : (
                <button
                  onClick={pauseMatch}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold text-sm md:text-base"
                >
                  ⏸ Pausar
                </button>
              )}
              <button
                onClick={resetQuarter}
                className="bg-gray-600 text-white px-3 py-2 rounded-lg text-sm md:text-base"
              >
                🔄
              </button>
              <button
                onClick={() => { loadConvocationPlayers(); setPenaltyType('penalty'); setPenaltyTeam('team1'); setPenaltyResult(null); setShowPenaltyModal(true); }}
                className="bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm md:text-base"
                title="Penalty"
              >
                🟡
              </button>
              <button
                onClick={() => { loadConvocationPlayers(); setPenaltyType('stroke'); setPenaltyTeam('team1'); setPenaltyResult(null); setShowPenaltyModal(true); }}
                className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm md:text-base"
                title="Stroke"
              >
                🔴
              </button>
              <button
                onClick={() => { loadConvocationPlayers(); setCardTeam('team1'); setCardType('yellow'); setSelectedCardPlayer(''); setShowCardModal(true); }}
                className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm md:text-base"
                title="Tarjeta"
              >
                🟥
              </button>
            </div>
            )}
          </div>

          {/* Equipos - Mobile: stacked, Desktop: side by side */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-2">
            {/* Equipo 1 */}
            <div className="flex-1 text-center w-full md:w-auto">
              <div
                className="w-14 h-14 md:w-20 md:h-20 rounded-full mx-auto mb-2 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: match.team1_color + '40' }}
              >
                {team1Logo ? (
                  <img src={team1Logo} alt="logo" className="w-12 h-12 md:w-16 md:h-16 object-contain rounded-full" />
                ) : (
                  <span className="text-xl md:text-2xl font-bold text-white">{match.team1_name.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <h3 className="text-base md:text-xl font-bold text-white truncate max-w-full px-2">{match.team1_name}</h3>
              <div className="text-4xl md:text-6xl font-bold text-white my-2">{match.score_team1}</div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handlePlus('team1')}
                  className="bg-green-600 text-white px-4 md:px-6 py-2 rounded-lg font-bold text-sm md:text-base min-h-[44px]"
                >
                  +1 Gol
                </button>
                <button
                  onClick={() => handleMinus('team1')}
                  disabled={match.score_team1 === 0}
                  className="bg-red-600 text-white px-3 md:px-4 py-2 rounded-lg font-bold text-sm md:text-base min-h-[44px] disabled:opacity-50"
                >
                  -
                </button>
              </div>
            </div>

            {/* Tiempo - Solo visible en mobile */}
            <div className="md:hidden text-center w-full bg-white/5 rounded-xl p-3">
              <div className="text-xs text-gray-400">CUARTO {match.quarter}/4</div>
              <div className="text-4xl font-mono font-bold text-yellow-400">{formatTime(displayTime)}</div>
              <div className="mt-2 flex gap-2 justify-center">
                {!match.running ? (
                  <button
                    onClick={startMatch}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg font-bold text-sm min-h-[36px]"
                  >
                    ▶
                  </button>
                ) : (
                  <button
                    onClick={pauseMatch}
                    className="bg-yellow-600 text-white px-3 py-1 rounded-lg font-bold text-sm min-h-[36px]"
                  >
                    ⏸
                  </button>
                )}
                <button
                  onClick={resetQuarter}
                  className="bg-gray-600 text-white px-3 py-1 rounded-lg text-sm min-h-[36px]"
                >
                  🔄
                </button>
              </div>
            </div>

            {/* VS */}
            <div className="hidden md:block text-2xl font-bold text-gray-500 px-2">VS</div>

            {/* Equipo 2 */}
            <div className="flex-1 text-center w-full md:w-auto">
              <div
                className="w-14 h-14 md:w-20 md:h-20 rounded-full mx-auto mb-2 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: match.team2_color + '40' }}
              >
                {team2Logo ? (
                  <img src={team2Logo} alt="logo" className="w-12 h-12 md:w-16 md:h-16 object-contain rounded-full" />
                ) : (
                  <span className="text-xl md:text-2xl font-bold text-white">{match.team2_name.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <h3 className="text-base md:text-xl font-bold text-white truncate max-w-full px-2">{match.team2_name}</h3>
              <div className="text-4xl md:text-6xl font-bold text-white my-2">{match.score_team2}</div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handlePlus('team2')}
                  className="bg-green-600 text-white px-4 md:px-6 py-2 rounded-lg font-bold text-sm md:text-base min-h-[44px]"
                >
                  +1 Gol
                </button>
                <button
                  onClick={() => handleMinus('team2')}
                  disabled={match.score_team2 === 0}
                  className="bg-red-600 text-white px-3 md:px-4 py-2 rounded-lg font-bold text-sm md:text-base min-h-[44px] disabled:opacity-50"
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
                className={`px-3 py-2 md:px-4 md:py-2 rounded-lg font-bold text-sm md:text-base min-w-[44px] ${
                  match.quarter === q
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Q{q}
              </button>
            ))}
          </div>
        </div>

        {/* Controles adicionales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Historial de Paradas */}
          <div className="bg-white/10 rounded-xl p-3 md:p-4 border border-white/10">
            <h3 className="text-white font-bold mb-2 text-sm md:text-base">🧤 Paradas ({saves.length})</h3>
            <button
              onClick={triggerSave}
              className="w-full bg-blue-600 text-white py-2 md:py-3 rounded-lg font-bold text-sm md:text-base min-h-[44px]"
            >
              🧤 Registrar Parada
            </button>
            <div className="space-y-1 md:space-y-2 max-h-32 md:max-h-48 overflow-y-auto mt-2">
              {saves.length === 0 ? (
                <p className="text-gray-400 text-xs md:text-sm">Sin paradas registradas</p>
              ) : (
                saves.map(save => (
                  <div key={save.id} className="flex items-center justify-between bg-white/5 p-2 rounded text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-blue-400 font-bold text-xs md:text-sm whitespace-nowrap">
                        Q{save.quarter} - {save.match_minute}'
                      </span>
                      <span className="text-white text-xs md:text-sm">
                        {save.player_name || 'Portera'} {save.dorsal && `#${save.dorsal}`}
                      </span>
                    </div>
                    <button
                      onClick={() => hockeyApi.removeSave(save.id).then(loadMatch)}
                      className="text-red-400 hover:text-red-300 p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Historial de Goles */}
          <div className="bg-white/10 rounded-xl p-3 md:p-4 border border-white/10">
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
                    <button
                      onClick={() => hockeyApi.removeGoal(goal.id).then(loadMatch)}
                      className="text-red-400 hover:text-red-300 p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Historial de Tarjetas */}
        <div className="bg-white/10 rounded-xl p-3 md:p-4 border border-white/10 mb-4">
          <h3 className="text-white font-bold mb-2 text-sm md:text-base">🟨 Tarjetas ({cards.length})</h3>
          <div className="space-y-1 md:space-y-2 max-h-32 md:max-h-48 overflow-y-auto">
            {cards.length === 0 ? (
              <p className="text-gray-400 text-xs md:text-sm">Sin tarjetas registradas</p>
            ) : (
              cards.map(card => (
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
                  <button
                    onClick={async () => {
                      try {
                        await hockeyApi.removeCard(card.id);
                        const updatedCards = await hockeyApi.getMatchCards(match.id);
                        setCards(updatedCards);
                      } catch (error) {
                        console.error('Error removing card:', error);
                        alert('Error al eliminar la tarjeta');
                      }
                    }}
                    className="text-red-400 hover:text-red-300 p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Historial de Penalty corner / Stroke */}
        <div className="bg-white/10 rounded-xl p-3 md:p-4 border border-white/10 mb-4">
          <h3 className="text-white font-bold mb-2 text-sm md:text-base">🎯 Penalty corner / Stroke</h3>
          {(() => {
            // Calcular goles y misses de penalty corner
            const penaltyGoals = goals.filter(g => g.is_penalty);
            const penaltyMissList = penaltyMisses.filter(pm => pm.type === 'penalty');
            const totalPenalties = penaltyGoals.length + penaltyMissList.length;
            
            // Calcular goles y misses de stroke
            const strokeGoals = goals.filter(g => false); // Los strokes no se marcan como is_penalty en goals
            const strokeMissList = penaltyMisses.filter(pm => pm.type === 'stroke');
            const totalStrokes = strokeMissList.length; // Por ahora solo mostramos misses de stroke
            
            return (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-400">Penalty corner</div>
                    <div className="text-xl font-bold text-white">
                      {penaltyGoals.length}/{totalPenalties}
                    </div>
                    <div className="text-xs text-gray-500">
                      ({penaltyGoals.length} goles de {totalPenalties} intentos)
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-400">Stroke</div>
                    <div className="text-xl font-bold text-white">
                      0/{totalStrokes}
                    </div>
                    <div className="text-xs text-gray-500">
                      (0 goles de {totalStrokes} intentos)
                    </div>
                  </div>
                </div>
                
                {/* Lista de penalty corners */}
                {totalPenalties > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-1">Penalty corners:</div>
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {/* Goles de penalty */}
                      {penaltyGoals.map(goal => (
                        <div key={goal.id} className="flex items-center justify-between bg-white/5 p-1.5 rounded text-xs">
                          <span className={goal.team === 'team1' ? 'text-blue-400' : 'text-red-400'}>
                            {goal.team === 'team1' ? match.team1_name : match.team2_name}
                          </span>
                          <span className="text-gray-300">
                            Q{goal.quarter} - {goal.match_minute}'
                          </span>
                          <span>✅ Gol</span>
                          <span className="text-gray-400">{goal.player_name}</span>
                        </div>
                      ))}
                      {/* Misses de penalty */}
                      {penaltyMissList.map(miss => (
                        <div key={miss.id} className="flex items-center justify-between bg-white/5 p-1.5 rounded text-xs">
                          <span className={miss.team === 'team1' ? 'text-blue-400' : 'text-red-400'}>
                            {miss.team === 'team1' ? match.team1_name : match.team2_name}
                          </span>
                          <span className="text-gray-300">
                            Q{miss.quarter} - {miss.match_minute}'
                          </span>
                          <span>❌ Fallado</span>
                          <button
                            onClick={async () => {
                              await hockeyApi.removePenaltyMiss(miss.id);
                              const updatedPenaltyMisses = await hockeyApi.getMatchPenaltyMisses(match.id);
                              setPenaltyMisses(updatedPenaltyMisses);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Lista de strokes */}
                {totalStrokes > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-400 mb-1">Strokes:</div>
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {strokeMissList.map(miss => (
                        <div key={miss.id} className="flex items-center justify-between bg-white/5 p-1.5 rounded text-xs">
                          <span className={miss.team === 'team1' ? 'text-blue-400' : 'text-red-400'}>
                            {miss.team === 'team1' ? match.team1_name : match.team2_name}
                          </span>
                          <span className="text-gray-300">
                            Q{miss.quarter} - {miss.match_minute}'
                          </span>
                          <span>❌ Fallado</span>
                          <button
                            onClick={async () => {
                              await hockeyApi.removePenaltyMiss(miss.id);
                              const updatedPenaltyMisses = await hockeyApi.getMatchPenaltyMisses(match.id);
                              setPenaltyMisses(updatedPenaltyMisses);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {totalPenalties === 0 && totalStrokes === 0 && (
                  <p className="text-gray-400 text-xs text-center mt-2">Sin penalties/strokes registrados</p>
                )}
              </>
            );
          })()}
        </div>

        {/* Historial de Shootouts */}
        {shootouts.length > 0 && (
          <div className="bg-white/10 rounded-xl p-3 md:p-4 border border-white/10 mb-4">
            <h3 className="text-white font-bold mb-2 text-sm md:text-base">🎯 Shootouts</h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="text-center bg-white/5 rounded p-2">
                <div className="text-xs text-gray-400">{match.team1_name}</div>
                <div className="text-2xl font-bold text-green-400">
                  {shootouts.filter(s => s.team === 'team1' && s.scored).length}
                </div>
              </div>
              <div className="text-center bg-white/5 rounded p-2">
                <div className="text-xs text-gray-400">{match.team2_name}</div>
                <div className="text-2xl font-bold text-green-400">
                  {shootouts.filter(s => s.team === 'team2' && s.scored).length}
                </div>
              </div>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {shootouts.map((s, idx) => (
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

        {/* Modal de gol */}
        {showGoalModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 md:p-4">
            <div className="bg-[#071025] rounded-2xl p-4 md:p-6 w-full max-w-md border border-white/10 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">
                🏑 Gol - {goalTeam === 'team1' ? match.team1_name : match.team2_name}
              </h3>
              
              <div className="mb-3 md:mb-4">
                <label className="block text-sm text-gray-300 mb-1 md:mb-2">Seleccionar jugador</label>
                <select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="w-full p-3 rounded bg-white text-gray-800 border border-gray-300 text-sm md:text-base"
                >
                  <option value="">-- Seleccionar --</option>
                  {goalTeam === 'team1' && convocationPlayers.length > 0 ? (
                    convocationPlayers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.dorsal && `#${p.dorsal}`}
                      </option>
                    ))
                  ) : (
                    getTeamPlayers(goalTeam!).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.player_name} {p.dorsal && `#${p.dorsal}`}
                      </option>
                    ))
                  )}
                </select>
                {goalTeam === 'team1' && convocationPlayers.length === 0 && getTeamPlayers(goalTeam!).length === 0 && (
                  <p className="text-xs text-yellow-400 mt-1">No hay jugadoras en la convocatoria</p>
                )}
              </div>

              <div className="mb-3 md:mb-4">
                <label className="block text-sm text-gray-300 mb-1 md:mb-2">O escribir nombre manual</label>
                <input
                  type="text"
                  value={customPlayerName}
                  onChange={(e) => setCustomPlayerName(e.target.value)}
                  className="w-full p-2 md:p-3 rounded bg-white text-gray-800 border border-gray-300 mb-2 text-sm md:text-base"
                  placeholder="Nombre del jugador"
                />
                <input
                  type="text"
                  value={customPlayerNumber}
                  onChange={(e) => setCustomPlayerNumber(e.target.value)}
                  className="w-full p-2 md:p-3 rounded bg-white text-gray-800 border border-gray-300 text-sm md:text-base"
                  placeholder="Dorsal (opcional)"
                />
              </div>

              <div className="flex gap-2 md:gap-3">
                <button
                  onClick={() => setShowGoalModal(false)}
                  className="flex-1 bg-gray-600 text-white py-2 md:py-3 rounded-lg text-sm md:text-base min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmGoal}
                  className="flex-1 bg-green-600 text-white py-2 md:py-3 rounded-lg font-bold text-sm md:text-base min-h-[44px]"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de parada */}
        {showSaveModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 md:p-4">
            <div className="bg-[#071025] rounded-2xl p-4 md:p-6 w-full max-w-md border border-white/10 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">
                🧤 Parada - {match.team1_name}
              </h3>
              
              <div className="mb-3 md:mb-4">
                <label className="block text-sm text-gray-300 mb-1 md:mb-2">Seleccionar portera</label>
                <select
                  value={selectedGoalkeeper}
                  onChange={(e) => setSelectedGoalkeeper(e.target.value)}
                  className="w-full p-3 rounded bg-white text-gray-800 border border-gray-300 text-sm md:text-base"
                >
                  <option value="">-- Seleccionar --</option>
                  {goalkeepers.length > 0 ? (
                    goalkeepers.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} {g.dorsal && `#${g.dorsal}`}
                      </option>
                    ))
                  ) : (
                    getTeamPlayers('team1').filter(p => p.position === 'Portera' || p.position === 'Portero').map(p => (
                      <option key={p.id} value={p.id}>
                        {p.player_name} {p.dorsal && `#${p.dorsal}`}
                      </option>
                    ))
                  )}
                </select>
                {goalkeepers.length === 0 && getTeamPlayers('team1').filter(p => p.position === 'Portera' || p.position === 'Portero').length === 0 && (
                  <p className="text-xs text-yellow-400 mt-1">No hay porteras en la convocatoria</p>
                )}
              </div>

              <div className="mb-3 md:mb-4">
                <label className="block text-sm text-gray-300 mb-1 md:mb-2">O escribir nombre manual</label>
                <input
                  type="text"
                  value={customGoalkeeperName}
                  onChange={(e) => setCustomGoalkeeperName(e.target.value)}
                  className="w-full p-2 md:p-3 rounded bg-white text-gray-800 border border-gray-300 mb-2 text-sm md:text-base"
                  placeholder="Nombre de la portera"
                />
                <input
                  type="text"
                  value={customGoalkeeperNumber}
                  onChange={(e) => setCustomGoalkeeperNumber(e.target.value)}
                  className="w-full p-2 md:p-3 rounded bg-white text-gray-800 border border-gray-300 text-sm md:text-base"
                  placeholder="Dorsal (opcional)"
                />
              </div>

              <div className="flex gap-2 md:gap-3">
                <button
                  onClick={closeSaveModal}
                  className="flex-1 bg-gray-600 text-white py-2 md:py-3 rounded-lg text-sm md:text-base min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmSave}
                  className="flex-1 bg-green-600 text-white py-2 md:py-3 rounded-lg font-bold text-sm md:text-base min-h-[44px]"
                >
                  Confirmar
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

        {/* Modal Tarjeta */}
        {showCardModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#071025] rounded-2xl p-6 max-w-md w-full border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Tarjeta</h3>
              
              <div className="mb-4">
                <label className="text-gray-400 text-sm block mb-2">Tipo de tarjeta</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCardType('green')}
                    className={`flex-1 py-3 rounded-lg font-bold ${cardType === 'green' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    🟢 Verde
                  </button>
                  <button
                    onClick={() => setCardType('yellow')}
                    className={`flex-1 py-3 rounded-lg font-bold ${cardType === 'yellow' ? 'bg-yellow-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    🟡 Amarilla
                  </button>
                  <button
                    onClick={() => setCardType('red')}
                    className={`flex-1 py-3 rounded-lg font-bold ${cardType === 'red' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    🔴 Roja
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-gray-400 text-sm block mb-2">Equipo</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCardTeam('team1')}
                    className={`flex-1 py-2 rounded-lg ${cardTeam === 'team1' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    {match?.team1_name || 'Team 1'}
                  </button>
                  <button
                    onClick={() => setCardTeam('team2')}
                    className={`flex-1 py-2 rounded-lg ${cardTeam === 'team2' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    {match?.team2_name || 'Team 2'}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-gray-400 text-sm block mb-2">Jugadora</label>
                <select
                  value={selectedCardPlayer}
                  onChange={(e) => setSelectedCardPlayer(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white text-black border border-gray-300"
                >
                  <option value="">Seleccionar jugadora...</option>
                  {convocationPlayers.map(p => (
                    <option key={p.id} value={p.id} className="text-black">{p.name} ({p.dorsal})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCardModal(false)}
                  className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!match || !isAdmin) return;
                    try {
                      const qDuration = match.quarter_duration;
                      const elapsedInQuarter = qDuration - displayTime;
                      const secondsBefore = (match.quarter - 1) * qDuration;
                      const matchMinute = Math.floor((secondsBefore + elapsedInQuarter) / 60);

                      const player = convocationPlayers.find(p => p.id === selectedCardPlayer);
                      await hockeyApi.addCard(match.id, {
                        team: cardTeam,
                        card_type: cardType,
                        player_id: selectedCardPlayer || undefined,
                        player_name: player?.name || 'Anónimo',
                        dorsal: player?.dorsal,
                        quarter: match.quarter,
                        match_minute: matchMinute,
                      });

                      const updatedCards = await hockeyApi.getMatchCards(match.id);
                      setCards(updatedCards);
                      setShowCardModal(false);
                      setSelectedCardPlayer('');
                    } catch (error) {
                      console.error('Error adding card:', error);
                      alert('Error al registrar tarjeta: ' + error);
                    }
                  }}
                  className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-bold"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Penalty/Stroke */}
        {showPenaltyModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#071025] rounded-2xl p-6 max-w-md w-full border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">
                {penaltyType === 'penalty' ? '🟡 Penalty' : '🔴 Stroke'}
              </h3>
              
              <div className="mb-4">
                <label className="text-gray-400 text-sm block mb-2">Resultado</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPenaltyResult('miss')}
                    className={`flex-1 py-4 rounded-lg font-bold text-lg ${penaltyResult === 'miss' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    ❌ FALLADO
                  </button>
                  <button
                    onClick={() => setPenaltyResult('goal')}
                    className={`flex-1 py-4 rounded-lg font-bold text-lg ${penaltyResult === 'goal' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    ✅ GOL
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-gray-400 text-sm block mb-2">Equipo</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPenaltyTeam('team1')}
                    className={`flex-1 py-2 rounded-lg ${penaltyTeam === 'team1' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    {match?.team1_name || 'Team 1'}
                  </button>
                  <button
                    onClick={() => setPenaltyTeam('team2')}
                    className={`flex-1 py-2 rounded-lg ${penaltyTeam === 'team2' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    {match?.team2_name || 'Team 2'}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPenaltyModal(false)}
                  className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!match || !isAdmin || !penaltyResult) return;

                    if (penaltyResult === 'goal') {
                      // Para goles, abrir el modal de gol y guardar penalty después
                      setGoalTeam(penaltyTeam);
                      setPendingPenaltyGoal({ type: penaltyType, team: penaltyTeam });
                      setShowGoalModal(true);
                      setShowPenaltyModal(false);
                    } else {
                      // Guardar penalty/stroke fallado
                      try {
                        await hockeyApi.addPenaltyMiss(match.id, {
                          type: penaltyType,
                          team: penaltyTeam,
                          quarter: match.quarter,
                          match_minute: Math.floor(((match.quarter - 1) * match.quarter_duration + (match.quarter_duration - displayTime)) / 60),
                        });

                        const updatedPenaltyMisses = await hockeyApi.getMatchPenaltyMisses(match.id);
                        setPenaltyMisses(updatedPenaltyMisses);
                        setShowPenaltyModal(false);
                        setPenaltyResult(null);
                      } catch (error) {
                        console.error('Error saving penalty miss:', error);
                        alert('Error al guardar el penalty fallado');
                      }
                    }
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Empate - Shootouts */}
        {showTieModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#071025] rounded-2xl p-6 max-w-md w-full border border-white/10 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">¡EMPATE!</h2>
              <p className="text-gray-400 mb-6">
                El partido ha terminado en empate ({match?.score_team1} - {match?.score_team2})
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    if (!match) return;
                    await loadConvocationPlayers();
                    setShowTieModal(false);
                    setShowShootoutModal(true);
                    setShootoutTeam('team1');
                  }}
                  className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-green-700"
                >
                  🎯 Iniciar Shootouts
                </button>
                <button
                  onClick={async () => {
                    if (!match) return;
                    await hockeyApi.updateMatch(match.id, {
                      running: false,
                      status: 'finished',
                    });
                    await clearReactions(match.id);
                    setMatch(prev => prev ? { 
                      ...prev, 
                      running: false,
                      status: 'finished'
                    } : null);
                    setShowTieModal(false);
                  }}
                  className="w-full bg-gray-600 text-white py-3 rounded-lg font-bold hover:bg-gray-700"
                >
                  Finalizar Partido (Empate)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Shootouts */}
        {showShootoutModal && match && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#071025] rounded-2xl p-6 max-w-lg w-full border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-4 text-center">🎯 Shootouts</h2>
              
              {/* Marcador de shootouts */}
              <div className="bg-white/5 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div className="text-center flex-1">
                    <div className="text-sm text-gray-400">{match.team1_name}</div>
                    <div className="text-3xl font-bold text-white">
                      {shootouts.filter(s => s.team === 'team1' && s.scored).length}
                    </div>
                  </div>
                  <div className="text-xl text-gray-500">VS</div>
                  <div className="text-center flex-1">
                    <div className="text-sm text-gray-400">{match.team2_name}</div>
                    <div className="text-3xl font-bold text-white">
                      {shootouts.filter(s => s.team === 'team2' && s.scored).length}
                    </div>
                  </div>
                </div>
                <div className="text-center text-xs text-gray-500 mt-2">
                  Ronda {Math.floor(shootouts.length / 2) + 1}
                </div>
              </div>

              {/* Historial de shootout actual */}
              <div className="mb-4 max-h-32 overflow-y-auto">
                {shootouts.map((s, idx) => (
                  <div key={s.id} className="flex justify-between items-center py-1 px-2 text-sm">
                    <span className={s.team === 'team1' ? 'text-blue-400' : 'text-red-400'}>
                      {s.team === 'team1' ? match.team1_name : match.team2_name}
                    </span>
                    <span>
                      {s.player_name} {s.dorsal && `#${s.dorsal}`}
                    </span>
                    <span>{s.scored ? '✅' : '❌'}</span>
                  </div>
                ))}
              </div>

              {/* Turno actual */}
              <div className="mb-4">
                <div className="text-center mb-2 flex items-center justify-center gap-3">
                  <span className="text-gray-400">Turno: </span>
                  <span className={`font-bold text-lg ${shootoutTeam === 'team1' ? 'text-blue-400' : 'text-red-400'}`}>
                    {shootoutTeam === 'team1' ? match.team1_name : match.team2_name}
                  </span>
                  <button
                    onClick={() => setShootoutTeam(shootoutTeam === 'team1' ? 'team2' : 'team1')}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-sm"
                    title="Cambiar equipo"
                  >
                    🔄
                  </button>
                </div>

                {shootoutTeam === 'team1' ? (
                  <div className="mb-3">
                    <label className="text-gray-400 text-sm block mb-2">Jugadora</label>
                    <select
                      value={selectedShootoutPlayer}
                      onChange={(e) => setSelectedShootoutPlayer(e.target.value)}
                      className="w-full p-3 rounded-lg bg-white text-black border border-gray-300"
                    >
                      <option value="">Seleccionar jugadora...</option>
                      {convocationPlayers.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.dorsal && `#${p.dorsal}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mb-3 p-3 bg-white/5 rounded-lg text-center">
                    <p className="text-gray-400 text-sm">Equipo rival - Solo marca el resultado</p>
                  </div>
                )}

                <div className="mb-3">
                  <label className="text-gray-400 text-sm block mb-2">Resultado</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShootoutScored(false)}
                      className={`flex-1 py-3 rounded-lg font-bold ${!shootoutScored ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                      ❌ Fallado
                    </button>
                    <button
                      onClick={() => setShootoutScored(true)}
                      className={`flex-1 py-3 rounded-lg font-bold ${shootoutScored ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                      ✅ Gol
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (!match) return;
                    
                    // Para team1 (nuestro equipo) requiere jugadora
                    if (shootoutTeam === 'team1' && !selectedShootoutPlayer) {
                      alert('Debes seleccionar una jugadora');
                      return;
                    }
                    
                    const player = shootoutTeam === 'team1' 
                      ? convocationPlayers.find(p => p.id === selectedShootoutPlayer)
                      : null;
                    const roundNumber = Math.floor(shootouts.length / 2) + 1;
                    
                    await hockeyApi.addShootout(match.id, {
                      team: shootoutTeam,
                      player_id: shootoutTeam === 'team1' ? selectedShootoutPlayer : undefined,
                      player_name: player?.name || (shootoutTeam === 'team2' ? 'Rival' : 'Anónimo'),
                      dorsal: player?.dorsal,
                      scored: shootoutScored,
                      round_number: roundNumber,
                    });
                    
                    const updatedShootouts = await hockeyApi.getMatchShootouts(match.id);
                    setShootouts(updatedShootouts);
                    setSelectedShootoutPlayer('');
                    
                    // Cambiar equipo
                    setShootoutTeam(shootoutTeam === 'team1' ? 'team2' : 'team1');
                    setShootoutScored(true);
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold"
                >
                  Registrar
                </button>
                <button
                  onClick={async () => {
                    if (!match) return;
                    // Finalizar shootouts
                    await hockeyApi.updateMatch(match.id, {
                      running: false,
                      status: 'finished',
                    });
                    await clearReactions(match.id);
                    setMatch(prev => prev ? { 
                      ...prev, 
                      running: false,
                      status: 'finished'
                    } : null);
                    setShowShootoutModal(false);
                  }}
                  className="bg-gray-600 text-white py-3 px-4 rounded-lg font-bold"
                >
                  Finalizar
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
