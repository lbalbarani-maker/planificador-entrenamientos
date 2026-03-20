import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { teamsApi, eventsApi, convocationApi, trainingsApi, clubsApi } from '../../lib/supabaseTeams';
import { hockeyApi } from '../../lib/supabaseHockey';
import { supabase } from '../../lib/supabase';
import { Team, Event, Training } from '../../types/teams';
import BackButton from '../BackButton';

interface Location {
  id: string;
  name: string;
  address?: string;
  google_maps_url?: string;
}

interface Club {
  id: string;
  name: string;
}

const TeamsList: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedEventDetail, setSelectedEventDetail] = useState<Event | null>(null);
  const [eventConvocations, setEventConvocations] = useState<any[]>([]);
  const [loadingConvocations, setLoadingConvocations] = useState(false);
  const [eventTeamName, setEventTeamName] = useState<string>('');
  const [eventClubName, setEventClubName] = useState<string>('');
  const [showConvocationModal, setShowConvocationModal] = useState(false);
  const [convocationPlayers, setConvocationPlayers] = useState<any[]>([]);
  const [eventHasConvocation, setEventHasConvocation] = useState(false);
  const [showAddPlayersModal, setShowAddPlayersModal] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalType, setSuccessModalType] = useState<'convocation' | 'match'>('convocation');
  const [matchUrl, setMatchUrl] = useState<string>('');
  const [selectedEventForTraining, setSelectedEventForTraining] = useState<Event | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [clubColors, setClubColors] = useState<{ primary: string; secondary: string }>({ primary: '#1E40AF', secondary: '#FFFFFF' });
  const [matchData, setMatchData] = useState<any>(null);
  const [opponentData, setOpponentData] = useState<any>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [showShareSuccessModal, setShowShareSuccessModal] = useState(false);
  
  const [teamForm, setTeamForm] = useState({ name: '', category: '', gender: '' });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [recurringRange, setRecurringRange] = useState<'week' | 'year'>('week');
  const [eventForm, setEventForm] = useState({
    type: 'match' as 'match' | 'training' | 'meeting',
    title: '',
    start_datetime: '',
    convocation_time: '',
    location: '',
    location_link: '',
    kit_jersey: '',
    kit_skirt: '',
    kit_socks: '',
    notes: '',
    opponent: ''
  });

  const getDuplicateDorsals = (players: any[]): Map<number, string[]> => {
    const dorsalMap = new Map<number, string[]>();
    players.forEach(p => {
      const dorsal = p.shirt_number || p.shirtNumber;
      if (dorsal) {
        const existing = dorsalMap.get(dorsal) || [];
        existing.push(p.name || p.displayName);
        dorsalMap.set(dorsal, existing);
      }
    });
    const duplicates = new Map<number, string[]>();
    dorsalMap.forEach((names, dorsal) => {
      if (names.length > 1) {
        duplicates.set(dorsal, names);
      }
    });
    return duplicates;
  };

  const getDorsalTooltip = (dorsal: number | undefined, name: string, duplicates: Map<number, string[]>): string => {
    if (!dorsal || !duplicates.has(dorsal)) return '';
    const others = duplicates.get(dorsal)?.filter(n => n !== name).join(', ');
    return others ? `⚠️ Dorsal duplicado con: ${others}` : '';
  };

  const isGoalkeeper = (position?: string): boolean => {
    if (!position) return false;
    return position.toLowerCase().includes('porter');
  };

  useEffect(() => {
    loadData();
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      console.log('Loading teams...');
      const teamsData = await teamsApi.getTeams();
      console.log('Teams loaded:', teamsData);
      setTeams(teamsData);
      
      // Set club colors from the first team (all teams belong to the same club)
      const teamWithClub = teamsData.find(t => t.club);
      if (teamWithClub?.club) {
        setClubColors({
          primary: teamWithClub.club.primary_color || '#1E40AF',
          secondary: teamWithClub.club.secondary_color || '#FFFFFF'
        });
      }
      
      // Cargar eventos y entrenamientos por separado
      try {
        const eventsData = await eventsApi.getUpcomingEvents(20);
        setEvents(eventsData);
      } catch (eventsError) {
        console.error('Error loading events:', eventsError);
      }
      
      try {
        const trainingsData = await trainingsApi.getAllTrainings();
        setTrainings(trainingsData);
      } catch (trainingsError) {
        console.error('Error loading trainings:', trainingsError);
      }

      try {
        const { data: locationsData } = await supabase
          .from('locations')
          .select('id, name, address, google_maps_url')
          .eq('is_active', true)
          .order('name');
        setLocations(locationsData || []);
      } catch (locationsError) {
        console.error('Error loading locations:', locationsError);
      }

      try {
        const clubsData = await clubsApi.getClubs();
        setClubs(clubsData || []);
      } catch (clubsError) {
        console.error('Error loading clubs:', clubsError);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      setError(error?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTeam) {
        await teamsApi.updateTeam(editingTeam.id, teamForm);
      } else {
        await teamsApi.createTeam(teamForm);
      }
      await loadData();
      resetTeamForm();
    } catch (error) {
      console.error('Error saving team:', error);
      alert('Error al guardar el equipo');
    }
  };

  const handleDeleteTeam = async (id: string, name: string) => {
    if (window.confirm(`¿Eliminar el equipo "${name}"?`)) {
      try {
        await teamsApi.deleteTeam(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting team:', error);
        alert('Error al eliminar el equipo');
      }
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== GUARDANDO EVENTO ===');
    console.log('eventForm:', eventForm);
    console.log('selectedTeam:', selectedTeam);
    console.log('isRecurring:', isRecurring);
    console.log('recurringDays:', recurringDays);
    console.log('recurringRange:', recurringRange);
    
    try {
      const { kit_jersey, kit_skirt, kit_socks, convocation_time, ...eventFormWithoutKit } = eventForm;
      
      const baseEventData = {
        ...eventFormWithoutKit,
        kit_color: kit_jersey && kit_skirt && kit_socks 
          ? `${kit_jersey};${kit_skirt};${kit_socks}`
          : ''
      };
      
      const createEventForDate = async (date: Date, teamId: string) => {
        const eventData = {
          ...baseEventData,
          start_datetime: date.toISOString(),
          convocation_time: convocation_time ? new Date(new Date(date).getTime() - 60 * 60 * 1000).toISOString() : null
        };
        
        const newEvent = await eventsApi.createEvent({
          team_id: teamId,
          ...eventData
        });
        
        // Create convocation for matches and trainings
        if (eventData.type === 'match' || eventData.type === 'training') {
          try {
            const teamPlayers = await teamsApi.getTeamPlayers(teamId);
            const playerIds = teamPlayers.map(tp => tp.player_id);
            if (playerIds.length > 0) {
              await convocationApi.createBulkConvocation(newEvent.id, playerIds);
            }
          } catch (convError) {
            console.error('Error creating convocation:', convError);
          }
          
          // Create hockey match (only for matches, not trainings)
          if (eventData.type === 'match') {
            try {
              const selectedTeamObj = teams.find(t => t.id === teamId);
              const kitParts = (eventData.kit_color || '').split(';');
              await hockeyApi.createMatch({
                team1_name: selectedTeamObj?.club?.name || selectedTeamObj?.name || 'Equipo Local',
                team1_color: kitParts[0] || '#1E40AF',
                team2_name: eventData.opponent || 'Equipo Visitante',
                team2_color: kitParts[1] || '#FFFFFF',
                quarter_duration: 900,
                event_id: newEvent.id,
              });
            } catch (hockeyError) {
              console.error('Error creating hockey match:', hockeyError);
            }
          }
        }
        
        return newEvent;
      };
      
      if (editingEvent) {
        console.log('Updating event:', editingEvent.id);
        await eventsApi.updateEvent(editingEvent.id, {
          ...baseEventData,
          start_datetime: new Date(eventForm.start_datetime).toISOString(),
          convocation_time: convocation_time ? new Date(convocation_time).toISOString() : null
        });
      } else if (isRecurring && recurringDays.length > 0 && eventForm.type === 'training') {
        // Creating recurring training events
        console.log('Creating recurring training events');
        
        const firstDate = new Date(eventForm.start_datetime);
        const dayOfWeek = firstDate.getDay();
        const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
        
        let weeksToCreate = recurringRange === 'week' ? 1 : 52;
        let eventsCreated = 0;
        
        for (let week = 0; week < weeksToCreate; week++) {
          for (const day of recurringDays) {
            const targetDay = dayMap[day];
            let daysDiff = targetDay - dayOfWeek;
            
            if (week === 0 && daysDiff < 0) continue;
            if (week > 0 && daysDiff >= 0) daysDiff -= 7;
            
            const eventDate = new Date(firstDate);
            eventDate.setDate(firstDate.getDate() + daysDiff + (week * 7));
            eventDate.setHours(firstDate.getHours(), firstDate.getMinutes(), 0, 0);
            
            // Skip if date is in the past
            if (eventDate < new Date()) continue;
            
            await createEventForDate(eventDate, selectedTeam);
            eventsCreated++;
          }
        }
        
        console.log('Created', eventsCreated, 'recurring events');
        setShowSuccessModal(true);
        (document.querySelector('.fixed') as HTMLElement)?.querySelector('button')?.click();
      } else {
        // Single event creation (existing logic)
        console.log('Creating single event with data:', { team_id: selectedTeam, ...baseEventData });
        const eventDataToSave = {
          ...baseEventData,
          start_datetime: new Date(eventForm.start_datetime).toISOString(),
          convocation_time: convocation_time ? new Date(convocation_time).toISOString() : null
        };
        
        const newEvent = await eventsApi.createEvent({
          team_id: selectedTeam,
          ...eventDataToSave
        });
        
        console.log('Event created:', newEvent);
        
        // Auto-create convocation for match and training events
        console.log('Event type:', eventForm.type);
        if (newEvent && (eventForm.type === 'match' || eventForm.type === 'training')) {
          console.log('Creating convocation for match:', newEvent.id);
          try {
            const teamPlayers = await teamsApi.getTeamPlayers(selectedTeam);
            console.log('Team players:', teamPlayers);
            const playerIds = teamPlayers.map(tp => tp.player_id);
            console.log('Player IDs:', playerIds);
            if (playerIds.length > 0) {
              await convocationApi.createBulkConvocation(newEvent.id, playerIds);
              console.log('Convocation created successfully!');
            } else {
              console.log('No players in team - add players first');
              alert('El equipo no tiene jugadoras. Añade jugadoras al equipo primero.');
            }
          } catch (convError) {
            console.error('Error creating convocation:', convError);
          }

          // Create hockey match for live tracking (only for matches, not trainings)
          if (eventForm.type === 'match') {
            try {
              const selectedTeamObj = teams.find(t => t.id === selectedTeam);
              const kitParts = (eventDataToSave.kit_color || '').split(';');
              const hockeyMatch = await hockeyApi.createMatch({
                team1_name: selectedTeamObj?.club?.name || selectedTeamObj?.name || 'Equipo Local',
                team1_color: kitParts[0] || '#1E40AF',
                team2_name: eventDataToSave.opponent || 'Equipo Visitante',
                team2_color: kitParts[1] || '#FFFFFF',
                quarter_duration: 900,
                event_id: newEvent.id,
              });
              console.log('Hockey match created:', hockeyMatch);
              setMatchUrl(hockeyMatch.id);
              setSuccessModalType('match');
              setShowSuccessModal(true);
            } catch (hockeyError) {
              console.error('Error creating hockey match:', hockeyError);
            }
          }
        }
      }
      
      await loadData();
      resetEventForm();
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Error al guardar el evento');
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setSelectedTeam(event.team_id);
    const kitParts = (event.kit_color || '').split(';');
    const convTime = (event as any).convocation_time;
    setEventForm({
      type: event.type,
      title: event.title || '',
      start_datetime: event.start_datetime.slice(0, 16),
      convocation_time: convTime ? convTime.slice(0, 16) : '',
      location: event.location || '',
      location_link: event.location_link || '',
      kit_jersey: kitParts[0] || '',
      kit_skirt: kitParts[1] || '',
      kit_socks: kitParts[2] || '',
      notes: event.notes || '',
      opponent: event.opponent || ''
    });
    const matchedLocation = locations.find(l => l.name === event.location);
    setSelectedLocationId(matchedLocation?.id || '');
    setShowEventForm(true);
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      // Delete associated hockey match if exists
      await hockeyApi.deleteMatchByEventId(eventToDelete);
      // Delete the event
      await eventsApi.deleteEvent(eventToDelete);
      await loadData();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error al eliminar el evento');
    }
    setShowDeleteModal(false);
    setEventToDelete(null);
  };

  const openDeleteModal = (id: string) => {
    setEventToDelete(id);
    setShowDeleteModal(true);
  };

  const openEventDetailModal = async (event: Event) => {
    setSelectedEventDetail(event);
    setLoadingConvocations(true);
    setShowEventDetailModal(true);
    try {
      const convs = await convocationApi.getConvocation(event.id, event.team_id);
      setEventConvocations(convs);
      const hasConv = (event as any).final_convocation && JSON.parse((event as any).final_convocation).length > 0;
      setEventHasConvocation(hasConv);
      
      const teamData = teams.find(t => t.id === event.team_id);
      setEventTeamName(teamData?.name || '');
      setEventClubName(teamData?.club?.name || '');
    } catch (error) {
      console.error('Error loading convocations:', error);
    }
    setLoadingConvocations(false);
  };

  const openConvocationModal = async () => {
    if (!selectedEventDetail) return;
    
    const finalConv = (selectedEventDetail as any).final_convocation ? JSON.parse((selectedEventDetail as any).final_convocation) : [];
    
    let initialPlayers: any[] = [];
    
    if (finalConv.length > 0) {
      const finalConvPlayers = eventConvocations.filter(c => finalConv.includes(c.player_id));
      initialPlayers = finalConvPlayers.map(c => ({
        id: c.player_id,
        name: c.player?.full_name || c.player?.name || 'Jugadora',
        selected: true,
        shirt_number: c.player?.dorsal,
        position: c.player?.position
      }));
    } else {
      const acceptedPlayers = eventConvocations.filter(c => c.status === 'accepted');
      initialPlayers = acceptedPlayers.map(c => ({
        id: c.player_id,
        name: c.player?.full_name || c.player?.name || 'Jugadora',
        selected: true,
        shirt_number: c.player?.dorsal,
        position: c.player?.position
      }));
    }
    
    initialPlayers.sort((a, b) => a.name.localeCompare(b.name));
    setConvocationPlayers(initialPlayers);
    
    if (selectedEventDetail.type === 'match') {
      try {
        const { data: hockeyMatch } = await supabase
          .from('hockey_matches')
          .select('*')
          .eq('event_id', selectedEventDetail.id)
          .single();
        setMatchData(hockeyMatch);
        
        if (selectedEventDetail.opponent) {
          const { data: clubs } = await supabase.from('clubs').select('id, name, logo_url');
          const clubsMap: Record<string, any> = {};
          (clubs || []).forEach((c: any) => {
            if (c.logo_url) clubsMap[c.name.toLowerCase()] = c;
          });
          
          const opponentLower = selectedEventDetail.opponent?.toLowerCase() || '';
          let opponentFound = clubsMap[opponentLower];
          
          if (!opponentFound) {
            opponentFound = Object.values(clubsMap).find((c: any) => 
              c.name.toLowerCase().includes(opponentLower) || 
              opponentLower.includes(c.name.toLowerCase())
            );
          }
          
          setOpponentData(opponentFound || null);
        }
      } catch (err) {
        console.error('Error fetching match data:', err);
      }
    }
    
    setShowConvocationModal(true);
  };

  const openAddPlayersModal = async () => {
    if (!selectedEventDetail) return;
    
    try {
      const { data: teamPlayers } = await supabase
        .from('team_players')
        .select('player_id, shirt_number, position, players(full_name)')
        .eq('team_id', selectedEventDetail.team_id);
      
      const allPlayers = (teamPlayers || []).map((tp: any) => ({
        id: tp.player_id,
        name: tp.players?.full_name || 'Jugadora',
        shirt_number: tp.shirt_number,
        position: tp.position
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      const existingIds = convocationPlayers.map(p => p.id);
      const newPlayers = allPlayers.filter(p => !existingIds.includes(p.id)).map(p => ({ ...p, selected: false }));
      
      setAvailablePlayers(newPlayers);
      setShowAddPlayersModal(true);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const toggleAvailablePlayer = (playerId: string) => {
    setAvailablePlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, selected: !p.selected } : p
    ));
  };

  const addSelectedPlayers = () => {
    const playersToAdd = availablePlayers.filter(p => p.selected);
    setConvocationPlayers(prev => [...prev, ...playersToAdd.map(p => ({ ...p, selected: true }))]);
    setShowAddPlayersModal(false);
  };

  const saveConvocation = async () => {
    if (!selectedEventDetail) return;
    const selectedPlayers = convocationPlayers.filter(p => p.selected);
    
    // CREAR registros en convocation para jugadores nuevos que no existan
    const existingPlayerIds = eventConvocations.map(c => c.player_id);
    const newPlayersToAdd = selectedPlayers.filter(p => !existingPlayerIds.includes(p.id));
    
    if (newPlayersToAdd.length > 0) {
      const newConvocations = newPlayersToAdd.map(p => ({
        event_id: selectedEventDetail.id,
        player_id: p.id,
        status: 'accepted'
      }));
      await supabase.from('convocation').insert(newConvocations);
    }
    
    // Guardar final_convocation
    const selectedPlayerIds = selectedPlayers.map(p => p.id);
    await supabase
      .from('events')
      .update({ final_convocation: JSON.stringify(selectedPlayerIds) })
      .eq('id', selectedEventDetail.id);
    
    setShowConvocationModal(false);
    
    // Recargar datos
    const { data: updatedEvent } = await supabase
      .from('events')
      .select('*')
      .eq('id', selectedEventDetail.id)
      .single();
    
    if (updatedEvent) {
      setSelectedEventDetail(updatedEvent);
      const convs = await convocationApi.getConvocation(updatedEvent.id, selectedEventDetail.team_id);
      setEventConvocations(convs);
      const hasConv = updatedEvent.final_convocation && JSON.parse(updatedEvent.final_convocation).length > 0;
      setEventHasConvocation(hasConv);
    }
    
    setShowSuccessModal(true);
  };

  const togglePlayerInConvocation = (playerId: string) => {
    setConvocationPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, selected: !p.selected } : p
    ));
  };

  const shareConvocationAsImage = async () => {
    if (!shareCardRef.current) return;
    
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        useCORS: true
      } as any);
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setShowShareSuccessModal(true);
        } catch (err) {
          console.error('Error al copiar:', err);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `convocatoria-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Error generando imagen:', err);
      alert('Error al generar la imagen');
    }
  };

  const handleLinkTraining = async (trainingId: string) => {
    if (!selectedEventForTraining) return;
    try {
      await eventsApi.linkTraining(selectedEventForTraining.id, trainingId);
      await loadData();
      setShowTrainingModal(false);
      setSelectedEventForTraining(null);
      alert('Entrenamiento físico vinculado al evento');
    } catch (error) {
      console.error('Error linking training:', error);
      alert('Error al vincular entrenamiento');
    }
  };

  const handleUnlinkTraining = async (eventId: string) => {
    if (!window.confirm('¿Desvincular el entrenamiento físico de este evento?')) return;
    try {
      await eventsApi.linkTraining(eventId, null);
      await loadData();
    } catch (error) {
      console.error('Error unlinking training:', error);
      alert('Error al desvincular entrenamiento');
    }
  };

  const openTrainingModal = (event: Event) => {
    setSelectedEventForTraining(event);
    setShowTrainingModal(true);
  };

  const resetTeamForm = () => {
    setTeamForm({ name: '', category: '', gender: '' });
    setEditingTeam(null);
    setShowTeamForm(false);
  };

  const resetEventForm = () => {
    setEventForm({
      type: 'match',
      title: '',
      start_datetime: '',
      convocation_time: '',
      location: '',
      location_link: '',
      kit_jersey: '',
      kit_skirt: '',
      kit_socks: '',
      notes: '',
      opponent: ''
    });
    setEditingEvent(null);
    setShowEventForm(false);
    setSelectedLocationId('');
    setIsRecurring(false);
    setRecurringDays([]);
    setRecurringRange('week');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'match': return '🏑';
      case 'training': return '🏋️';
      case 'meeting': return '📋';
      default: return '📅';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'match': return 'Partido';
      case 'training': return 'Entrenamiento';
      case 'meeting': return 'Reunión';
      default: return type;
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <BackButton />
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sanse-blue"></div>
          <p className="mt-2 text-gray-600">Cargando datos...</p>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <BackButton />
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <BackButton />
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-sanse-blue">Gestión de Equipos</h1>
            <p className="text-gray-600">Equipos, partidos y entrenamientos</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEventForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              + Nuevo Evento
            </button>
            <button
              onClick={() => setShowTeamForm(true)}
              className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + Nuevo Equipo
            </button>
          </div>
        </div>

        {/* Próximos eventos */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📅 Próximos Eventos</h2>
          {events.length === 0 ? (
            <p className="text-gray-500">No hay eventos próximos</p>
          ) : (
            <div className="space-y-3">
              {events.map(event => (
                <div key={event.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                    <span className="text-2xl">{getEventTypeIcon(event.type)}</span>
                    <div>
                      <p className="font-semibold text-gray-800">
                        {event.type === 'match' && event.opponent 
                          ? `${event.team?.club?.name || 'Equipo Local'} vs ${event.opponent}`
                          : event.title || getEventTypeLabel(event.type)
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        {event.team?.name} • {event.location || 'Sin ubicación'}
                      </p>
                      {/* Mostrar entrenamiento vinculado */}
                      {event.type === 'training' && event.training && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                            🏋️ {event.training.name} ({event.training.totalTime} min)
                          </span>
                          <button
                            onClick={() => handleUnlinkTraining(event.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                            title="Desvincular"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-sanse-blue">{formatDate(event.start_datetime)}</p>
                      {event.kit_color && (() => {
                        const parts = event.kit_color.split(';');
                        return (
                          <div className="mt-1">
                            <span className="text-xs text-gray-500 mr-1">Equipación:</span>
                            <div className="inline-flex gap-1">
                              {parts[0] && (
                                <span 
                                  className="inline-block w-4 h-4 rounded border border-gray-300"
                                  style={{ backgroundColor: parts[0] }}
                                  title="Camiseta"
                                />
                              )}
                              {parts[1] && (
                                <span 
                                  className="inline-block w-4 h-4 rounded border border-gray-300"
                                  style={{ backgroundColor: parts[1] }}
                                  title="Pantalón"
                                />
                              )}
                              {parts[2] && (
                                <span 
                                  className="inline-block w-4 h-4 rounded border border-gray-300"
                                  style={{ backgroundColor: parts[2] }}
                                  title="Medias"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEventDetailModal(event)}
                        className="text-gray-600 hover:text-gray-800 p-1"
                        title="Ver detalles"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => openDeleteModal(event.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Equipos */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">🏅 Equipos</h2>
          {teams.length === 0 ? (
            <p className="text-gray-500">No hay equipos creados</p>
          ) : (
            <>
              {['fem', 'masc', 'mixto'].map(gender => {
                const genderTeams = teams.filter(t => t.gender === gender);
                if (genderTeams.length === 0) return null;
                const genderLabel = gender === 'fem' ? '👩 Femenino' : gender === 'masc' ? '👨 Masculino' : '👥 Mixto';
                return (
                  <div key={gender} className="mb-6">
                    <h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">{genderLabel}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {genderTeams.map(team => (
                        <div key={team.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-bold text-sanse-blue">{team.name}</h3>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingTeam(team);
                                  setTeamForm({ name: team.name, category: team.category || '', gender: team.gender || '' });
                                  setShowTeamForm(true);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteTeam(team.id, team.name)}
                                className="text-red-600 hover:text-red-800"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(`/teams/${team.id}`)}
                            className="mt-3 w-full bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700 text-sm"
                          >
                            Ver Jugadores
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {teams.filter(t => !t.gender).map(team => (
                <div key={team.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-sanse-blue">{team.name}</h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingTeam(team);
                          setTeamForm({ name: team.name, category: team.category || '', gender: team.gender || '' });
                          setShowTeamForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team.id, team.name)}
                        className="text-red-600 hover:text-red-800"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/teams/${team.id}`)}
                    className="mt-3 w-full bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Ver Jugadores
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Formulario de Equipo */}
        {showTeamForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">
                {editingTeam ? 'Editar Equipo' : 'Nuevo Equipo'}
              </h3>
              <form onSubmit={handleSaveTeam} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    value={teamForm.category}
                    onChange={(e) => setTeamForm({ ...teamForm, category: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="division_honor_a">División de Honor A</option>
                    <option value="division_honor_b">División de Honor B</option>
                    <option value="primera_a">Primera A</option>
                    <option value="primera_b">Primera B</option>
                    <option value="segunda">Segunda</option>
                    <option value="papis">Papis</option>
                    <option value="juvenil">Juvenil</option>
                    <option value="cadete">Cadete</option>
                    <option value="infantil">Infantil</option>
                    <option value="veteranas">Veteranas</option>
                    <option value="mamis">Mamis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                  <select
                    value={teamForm.gender}
                    onChange={(e) => setTeamForm({ ...teamForm, gender: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="fem">Femenino</option>
                    <option value="masc">Masculino</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    {editingTeam ? 'Actualizar' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={resetTeamForm}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Formulario de Evento */}
        {showEventForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</h3>
              <form onSubmit={handleSaveEvent} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Equipo *</label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => {
                      setSelectedTeam(e.target.value);
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seleccionar equipo...</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select
                    value={eventForm.type}
                    onChange={(e) => {
                      const newType = e.target.value as 'match' | 'training' | 'meeting';
                      if (newType === 'training') {
                        setEventForm({ 
                          ...eventForm, 
                          type: newType,
                          location: 'Club de Hockey Sanse',
                          location_link: 'https://maps.google.com/?q=Club+de+Hockey+Sanse+Alcorcon'
                        });
                      } else {
                        setEventForm({ ...eventForm, type: newType });
                      }
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="match">Partido</option>
                    <option value="training">Entrenamiento</option>
                    <option value="meeting">Reunión</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                    <input
                      type="date"
                      value={eventForm.start_datetime ? eventForm.start_datetime.split('T')[0] : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setEventForm({ ...eventForm, start_datetime: `${e.target.value}T00:00` });
                        } else {
                          setEventForm({ ...eventForm, start_datetime: '' });
                        }
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
                    <select
                      value={eventForm.start_datetime && eventForm.start_datetime.split('T')[1]?.slice(0, 2) ? eventForm.start_datetime.split('T')[1]?.slice(0, 2) : ''}
                      onChange={(e) => {
                        const datePart = eventForm.start_datetime ? eventForm.start_datetime.split('T')[0] : '';
                        const minutes = eventForm.start_datetime && eventForm.start_datetime.split('T')[1]?.slice(3, 5) ? eventForm.start_datetime.split('T')[1]?.slice(3, 5) : '00';
                        setEventForm({ ...eventForm, start_datetime: `${datePart}T${e.target.value || '00'}:${minutes}` });
                        if (datePart && e.target.value) {
                          const eventDate = new Date(`${datePart}T${e.target.value}:00`);
                          eventDate.setHours(eventDate.getHours() - 1);
                          const year = eventDate.getFullYear();
                          const month = String(eventDate.getMonth() + 1).padStart(2, '0');
                          const day = String(eventDate.getDate()).padStart(2, '0');
                          const convHours = String(eventDate.getHours()).padStart(2, '0');
                          const convMinutes = String(Math.floor(eventDate.getMinutes() / 15) * 15).padStart(2, '0');
                          setEventForm(prev => ({ ...prev, convocation_time: `${year}-${month}-${day}T${convHours}:${convMinutes}` }));
                        }
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={!eventForm.start_datetime || !eventForm.start_datetime.split('T')[0]}
                      required
                    >
                      <option value="">--</option>
                      {[...Array(24)].map((_, i) => (
                        <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minutos</label>
                    <select
                      value={eventForm.start_datetime && eventForm.start_datetime.split('T')[1]?.slice(3, 5) ? eventForm.start_datetime.split('T')[1]?.slice(3, 5) : ''}
                      onChange={(e) => {
                        const datePart = eventForm.start_datetime ? eventForm.start_datetime.split('T')[0] : '';
                        const hours = eventForm.start_datetime && eventForm.start_datetime.split('T')[1]?.slice(0, 2) ? eventForm.start_datetime.split('T')[1]?.slice(0, 2) : '00';
                        setEventForm({ ...eventForm, start_datetime: `${datePart}T${hours}:${e.target.value || '00'}` });
                        if (datePart && hours && e.target.value) {
                          const eventDate = new Date(`${datePart}T${hours}:${e.target.value}`);
                          eventDate.setHours(eventDate.getHours() - 1);
                          const year = eventDate.getFullYear();
                          const month = String(eventDate.getMonth() + 1).padStart(2, '0');
                          const day = String(eventDate.getDate()).padStart(2, '0');
                          const convHours = String(eventDate.getHours()).padStart(2, '0');
                          const convMinutes = String(Math.floor(eventDate.getMinutes() / 15) * 15).padStart(2, '0');
                          setEventForm(prev => ({ ...prev, convocation_time: `${year}-${month}-${day}T${convHours}:${convMinutes}` }));
                        }
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={!eventForm.start_datetime || !eventForm.start_datetime.split('T')[0]}
                    >
                      <option value="">--</option>
                      <option value="00">00</option>
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </select>
                  </div>
                </div>
                {eventForm.type === 'match' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora convocatoria</label>
                      <select
                        value={eventForm.convocation_time && eventForm.convocation_time.split('T')[1]?.slice(0, 2) ? eventForm.convocation_time.split('T')[1]?.slice(0, 2) : ''}
                        onChange={(e) => {
                          const datePart = eventForm.start_datetime ? eventForm.start_datetime.split('T')[0] : '';
                          const minutes = eventForm.convocation_time && eventForm.convocation_time.split('T')[1]?.slice(3, 5) ? eventForm.convocation_time.split('T')[1]?.slice(3, 5) : '00';
                          if (datePart) {
                            setEventForm({ ...eventForm, convocation_time: `${datePart}T${e.target.value || '00'}:${minutes}` });
                          }
                        }}
                        className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={!eventForm.start_datetime || !eventForm.start_datetime.split('T')[0]}
                      >
                        <option value="">--</option>
                        {[...Array(24)].map((_, i) => (
                          <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
                      <select
                        value={eventForm.convocation_time && eventForm.convocation_time.split('T')[1]?.slice(3, 5) ? eventForm.convocation_time.split('T')[1]?.slice(3, 5) : ''}
                        onChange={(e) => {
                          const datePart = eventForm.start_datetime ? eventForm.start_datetime.split('T')[0] : '';
                          const hours = eventForm.convocation_time && eventForm.convocation_time.split('T')[1]?.slice(0, 2) ? eventForm.convocation_time.split('T')[1]?.slice(0, 2) : '00';
                          if (datePart) {
                            setEventForm({ ...eventForm, convocation_time: `${datePart}T${hours}:${e.target.value || '00'}` });
                          }
                        }}
                        className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={!eventForm.start_datetime || !eventForm.start_datetime.split('T')[0]}
                      >
                        <option value="">--</option>
                        <option value="00">00</option>
                        <option value="15">15</option>
                        <option value="30">30</option>
                        <option value="45">45</option>
                      </select>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => {
                      setSelectedLocationId(e.target.value);
                      if (e.target.value === '__other__') {
                        setEventForm({ ...eventForm, location: '', location_link: '' });
                      } else if (e.target.value) {
                        const loc = locations.find(l => l.id === e.target.value);
                        setEventForm({ 
                          ...eventForm, 
                          location: loc?.name || '', 
                          location_link: loc?.google_maps_url || '' 
                        });
                      } else {
                        setEventForm({ ...eventForm, location: '', location_link: '' });
                      }
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleccionar pista...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                    <option value="__other__">+ Otra ubicación</option>
                  </select>
                  {selectedLocationId === '__other__' && (
                    <input
                      type="text"
                      value={eventForm.location}
                      onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg mt-2"
                      placeholder="Nombre de la ubicación"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enlace Google Maps</label>
                  <input
                    type="text"
                    value={eventForm.location_link}
                    onChange={(e) => setEventForm({ ...eventForm, location_link: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="https://maps.google.com/..."
                  />
                </div>
                {eventForm.type === 'match' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rival</label>
                    <select
                      value={eventForm.opponent}
                      onChange={(e) => setEventForm({ ...eventForm, opponent: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seleccionar club...</option>
                      {clubs.map(club => (
                        <option key={club.id} value={club.name}>{club.name}</option>
                      ))}
                      <option value="__other__">+ Otro club</option>
                    </select>
                    {eventForm.opponent === '__other__' && (
                      <input
                        type="text"
                        value=""
                        onChange={(e) => setEventForm({ ...eventForm, opponent: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg mt-2"
                        placeholder="Nombre del club rival"
                      />
                    )}
                  </div>
                )}
                {eventForm.type === 'match' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Color Equipación</label>
                    <div className="flex items-center justify-center gap-8">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">👕</span>
                        <button
                          type="button"
                          onClick={() => setEventForm({ ...eventForm, kit_jersey: clubColors.primary })}
                          className={`relative w-12 h-12 rounded-lg border-3 ${eventForm.kit_jersey === clubColors.primary ? 'border-green-600 ring-2 ring-green-300' : 'border-gray-300'}`}
                          style={{ backgroundColor: clubColors.primary }}
                          title="Local"
                        >
                          {eventForm.kit_jersey === clubColors.primary && <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">✓</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEventForm({ ...eventForm, kit_jersey: clubColors.secondary })}
                          className={`relative w-12 h-12 rounded-lg border-3 ${eventForm.kit_jersey === clubColors.secondary ? 'border-green-600 ring-2 ring-green-300' : 'border-gray-300'}`}
                          style={{ backgroundColor: clubColors.secondary }}
                          title="Visitante"
                        >
                          {eventForm.kit_jersey === clubColors.secondary && <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">✓</span>}
                        </button>
                        <span className="text-2xl">🩳</span>
                        <button
                          type="button"
                          onClick={() => setEventForm({ ...eventForm, kit_skirt: clubColors.primary })}
                          className={`relative w-12 h-12 rounded-lg border-3 ${eventForm.kit_skirt === clubColors.primary ? 'border-green-600 ring-2 ring-green-300' : 'border-gray-300'}`}
                          style={{ backgroundColor: clubColors.primary }}
                          title="Local"
                        >
                          {eventForm.kit_skirt === clubColors.primary && <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">✓</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEventForm({ ...eventForm, kit_skirt: clubColors.secondary })}
                          className={`relative w-12 h-12 rounded-lg border-3 ${eventForm.kit_skirt === clubColors.secondary ? 'border-green-600 ring-2 ring-green-300' : 'border-gray-300'}`}
                          style={{ backgroundColor: clubColors.secondary }}
                          title="Visitante"
                        >
                          {eventForm.kit_skirt === clubColors.secondary && <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">✓</span>}
                        </button>
                        <span className="text-2xl">🧦</span>
                        <button
                          type="button"
                          onClick={() => setEventForm({ ...eventForm, kit_socks: clubColors.primary })}
                          className={`relative w-12 h-12 rounded-lg border-3 ${eventForm.kit_socks === clubColors.primary ? 'border-green-600 ring-2 ring-green-300' : 'border-gray-300'}`}
                          style={{ backgroundColor: clubColors.primary }}
                          title="Local"
                        >
                          {eventForm.kit_socks === clubColors.primary && <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">✓</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEventForm({ ...eventForm, kit_socks: clubColors.secondary })}
                          className={`relative w-12 h-12 rounded-lg border-3 ${eventForm.kit_socks === clubColors.secondary ? 'border-green-600 ring-2 ring-green-300' : 'border-gray-300'}`}
                          style={{ backgroundColor: clubColors.secondary }}
                          title="Visitante"
                        >
                          {eventForm.kit_socks === clubColors.secondary && <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">✓</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={eventForm.notes}
                    onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>

                {/* Opciones de recurrencia */}
                {eventForm.type === 'training' && (
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => {
                          setIsRecurring(e.target.checked);
                          if (!e.target.checked) {
                            setRecurringDays([]);
                          }
                        }}
                        className="w-5 h-5"
                      />
                      <span className="text-sm font-medium text-gray-700">Evento recurrente</span>
                    </label>

                    {isRecurring && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Selecciona los días:</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, index) => {
                            const dayValue = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][index];
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  setRecurringDays(prev => 
                                    prev.includes(dayValue) 
                                      ? prev.filter(d => d !== dayValue)
                                      : [...prev, dayValue]
                                  );
                                }}
                                className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  recurringDays.includes(dayValue)
                                    ? 'bg-sanse-blue text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>

                        <p className="text-sm text-gray-600 mb-2">Duración:</p>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="recurringRange"
                              checked={recurringRange === 'week'}
                              onChange={() => setRecurringRange('week')}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">Esta semana</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="recurringRange"
                              checked={recurringRange === 'year'}
                              onChange={() => setRecurringRange('year')}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">Todo el año</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="col-span-2 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
                  >
                    {editingEvent ? 'Actualizar' : 'Crear Evento'}
                  </button>
                  <button
                    type="button"
                    onClick={resetEventForm}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal para vincular entrenamiento físico */}
        {showTrainingModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">🏋️ Vincular Entrenamiento Físico</h3>
              <p className="text-gray-600 mb-4">
                Selecciona un entrenamiento físico para vincular a este evento
              </p>
              
              {trainings.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 mb-4">No hay entrenamientos creados</p>
                  <button
                    onClick={() => { setShowTrainingModal(false); navigate('/trainings'); }}
                    className="bg-sanse-blue text-white px-4 py-2 rounded-lg"
                  >
                    Ir a Entrenamientos
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {trainings.map(training => (
                    <div
                      key={training.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleLinkTraining(training.id)}
                    >
                      <p className="font-semibold text-sanse-blue">{training.name}</p>
                      <p className="text-sm text-gray-500">
                        {training.exercises?.length || 0} ejercicios • {training.totalTime} min
                      </p>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setShowTrainingModal(false); setSelectedEventForTraining(null); }}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmación para eliminar evento */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Confirmar eliminación</h3>
              <p className="text-gray-600 mb-6">¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteEvent}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => { setShowDeleteModal(false); setEventToDelete(null); }}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de detalles del evento */}
        {showEventDetailModal && selectedEventDetail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {selectedEventDetail.type === 'match' 
                    ? `${eventClubName || eventTeamName} vs ${selectedEventDetail.opponent || 'Rival'}`
                    : (selectedEventDetail.type === 'training' ? 'Entrenamiento' : 'Reunión')
                  }
                </h3>
                <button
                  onClick={() => { setShowEventDetailModal(false); setSelectedEventDetail(null); }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              {selectedEventDetail.type === 'match' && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center gap-4">
                    <img 
                      src={selectedEventDetail.team?.club?.logo_url || 'https://placehold.co/60x60?text=Local'} 
                      alt="Local" 
                      className="w-12 h-12 object-contain rounded-full border"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/60x60?text=Local'; }}
                    />
                    <div className="text-center">
                      <p className="font-bold">{eventClubName || eventTeamName} vs {selectedEventDetail.opponent || 'Rival'}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {(() => {
                          const kitParts = (selectedEventDetail.kit_color || '').split(';');
                          return kitParts.map((color, i) => color ? (
                            <span 
                              key={i} 
                              className="inline-block w-5 h-5 rounded-full border border-gray-300"
                              style={{ backgroundColor: color }}
                              title={['Camiseta', 'Pantalón', 'Medias'][i]}
                            />
                          ) : null);
                        })()}
                      </div>
                    </div>
                    <img 
                      src={opponentData?.logo_url || 'https://placehold.co/60x60?text=Visitante'} 
                      alt="Visitante" 
                      className="w-12 h-12 object-contain rounded-full border"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/60x60?text=Visitante'; }}
                    />
                  </div>
                </div>
              )}
              
              <div className="mb-4">
                <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
                  <tbody>
                    <tr>
                      <td className="py-2 px-3 text-gray-600 bg-gray-50"><strong>🗓️ Fecha:</strong></td>
                      <td className="py-2 px-3 text-gray-800 whitespace-nowrap">{new Date(selectedEventDetail.start_datetime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      {selectedEventDetail.type === 'match' && (selectedEventDetail as any).convocation_time && (
                        <>
                          <td className="py-2 px-3 text-gray-600 bg-gray-50"><strong>🕑 Convocatoria:</strong></td>
                          <td className="py-2 px-3 text-gray-800 whitespace-nowrap">{new Date((selectedEventDetail as any).convocation_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                        </>
                      )}
                      <td className="py-2 px-3 text-gray-600 bg-gray-50"><strong>🚩 Ubicación:</strong></td>
                      <td className="py-2 px-3 text-gray-800">{selectedEventDetail.location || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 mb-4">
                {selectedEventDetail.type === 'match' && eventHasConvocation && (
                  <button
                    onClick={shareConvocationAsImage}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    📤 Compartir
                  </button>
                )}
                {selectedEventDetail.type === 'match' && (
                  <button
                    onClick={openConvocationModal}
                    className={`px-4 py-2 rounded-lg font-medium ${eventHasConvocation ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-green-600 text-white hover:bg-green-700'}`}
                  >
                    {eventHasConvocation ? '✏️ Editar Convocatoria' : '📋 Crear Convocatoria'}
                  </button>
                )}
              </div>

              {(selectedEventDetail.type === 'match' || selectedEventDetail.type === 'training') && (() => {
                const sortedConvocations = [...eventConvocations].sort((a, b) => 
                  (a.player?.name || '').localeCompare(b.player?.name || '')
                );
                const accepted = sortedConvocations.filter(c => c.status === 'accepted');
                const declined = sortedConvocations.filter(c => c.status === 'declined');
                const pending = sortedConvocations.filter(c => c.status === 'pending');
                const finalConvIds = (selectedEventDetail as any).final_convocation ? JSON.parse((selectedEventDetail as any).final_convocation) : [];
                const convokedPlayers = sortedConvocations.filter(c => finalConvIds.includes(c.player_id));
                
                const enrichedConvoked = convokedPlayers.map(conv => ({
                  ...conv,
                  displayName: conv.player?.full_name || conv.player?.name || 'Jugadora',
                  shirtNumber: conv.player?.dorsal || conv.teamPlayer?.shirt_number,
                  position: conv.player?.position || conv.teamPlayer?.position
                })).sort((a, b) => a.displayName.localeCompare(b.displayName));
                
                const duplicateDorsals = getDuplicateDorsals(enrichedConvoked);

                return (
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-700 mb-3">
                    {selectedEventDetail.type === 'training' ? '📋 Asistencia' : (eventHasConvocation ? '📋 Convocatoria' : 'Disponibilidad de jugadoras')}
                  </h4>
                  {loadingConvocations ? (
                    <p>Cargando...</p>
                  ) : eventHasConvocation ? (
                    <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                      <h5 className="font-semibold text-blue-800 mb-2">
                        Convocadas
                      </h5>
                      <div className="space-y-1">
                        {enrichedConvoked.map(conv => {
                          const isDuplicate = duplicateDorsals.has(conv.shirtNumber);
                          const tooltipText = getDorsalTooltip(conv.shirtNumber, conv.displayName, duplicateDorsals);
                          return (
                            <div 
                              key={conv.id} 
                              className={`text-sm flex items-center gap-2 ${isDuplicate ? 'text-red-600' : 'text-blue-700'}`}
                              title={tooltipText}
                            >
                              • {conv.displayName}
                              {conv.shirtNumber && (
                                <span className={isDuplicate ? 'text-red-600 font-bold' : 'text-gray-500'}>
                                  (#{conv.shirtNumber})
                                  {isGoalkeeper(conv.position) && ' 🥅'}
                                </span>
                              )}
                              {isDuplicate && <span className="text-red-500 text-xs">⚠️</span>}
                            </div>
                          );
                        })}
                        {enrichedConvoked.length === 0 && (
                          <p className="text-sm text-blue-600 italic">Sin jugadoras convocadas</p>
                        )}
                      </div>
                    </div>
                  ) : eventConvocations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Pendientes */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <h5 className="font-semibold text-yellow-800 mb-2">
                          Pendientes ({pending.length})
                        </h5>
                        <div className="space-y-1">
                          {pending.map(conv => (
                            <div key={conv.id} className="text-sm text-yellow-700">
                              • {conv.player?.name || 'Jugadora'}
                            </div>
                          ))}
                          {pending.length === 0 && (
                            <p className="text-sm text-yellow-600 italic">Sin jugadoras</p>
                          )}
                        </div>
                      </div>

                      {/* Confirmadas */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <h5 className="font-semibold text-green-800 mb-2">
                          Confirmadas ({accepted.length})
                        </h5>
                        <div className="space-y-1">
                          {accepted.map(conv => (
                            <div key={conv.id} className="text-sm text-green-700">
                              • {conv.player?.name || 'Jugadora'}
                            </div>
                          ))}
                          {accepted.length === 0 && (
                            <p className="text-sm text-green-600 italic">Sin jugadoras</p>
                          )}
                        </div>
                      </div>

                      {/* No asisten */}
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <h5 className="font-semibold text-red-800 mb-2">
                          No asisten ({declined.length})
                        </h5>
                        <div className="space-y-1">
                          {declined.map(conv => (
                            <div key={conv.id} className="text-sm text-red-700">
                              • {conv.player?.name || 'Jugadora'}
                            </div>
                          ))}
                          {declined.length === 0 && (
                            <p className="text-sm text-red-600 italic">Sin jugadoras</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No hay convocatorias creadas para este partido</p>
                  )}
                </div>
                );
              })()}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setShowEventDetailModal(false); setSelectedEventDetail(null); }}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Convocatoria */}
        {showConvocationModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">{eventHasConvocation ? 'Editar Convocatoria' : 'Crear Convocatoria'}</h3>
                <button
                  onClick={() => setShowConvocationModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              {selectedEventDetail?.type === 'match' && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center gap-4 mb-2">
                    <img 
                      src={selectedEventDetail.team?.club?.logo_url || 'https://placehold.co/60x60?text=Local'} 
                      alt="Local" 
                      className="w-12 h-12 object-contain rounded-full border"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/60x60?text=Local'; }}
                    />
                    <div className="text-center">
                      <p className="font-bold text-lg">{eventClubName || eventTeamName} vs {selectedEventDetail.opponent || 'Rival'}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {(() => {
                          const kitParts = (selectedEventDetail.kit_color || '').split(';');
                          return kitParts.map((color, i) => color ? (
                            <span 
                              key={i} 
                              className="inline-block w-5 h-5 rounded-full border border-gray-300"
                              style={{ backgroundColor: color }}
                              title={['Camiseta', 'Pantalón', 'Medias'][i]}
                            />
                          ) : null);
                        })()}
                      </div>
                    </div>
                    <img 
                      src={opponentData?.logo_url || 'https://placehold.co/60x60?text=Visitante'} 
                      alt="Visitante" 
                      className="w-12 h-12 object-contain rounded-full border"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/60x60?text=Visitante'; }}
                    />
                  </div>
                </div>
              )}
              
              <p className="text-gray-600 mb-4">
                Selecciona las jugadoras que serán convocadas:
              </p>
              
              {(() => {
                const duplicateDorsals = getDuplicateDorsals(convocationPlayers);
                return (
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {convocationPlayers.length === 0 ? (
                  <p className="text-gray-500">No hay jugadoras en la convocatoria</p>
                ) : (
                  convocationPlayers.map(player => {
                    const isDuplicate = duplicateDorsals.has(player.shirt_number);
                    const tooltipText = getDorsalTooltip(player.shirt_number, player.name, duplicateDorsals);
                    return (
                    <label 
                      key={player.id} 
                      className={`flex items-center p-3 rounded-lg border cursor-pointer ${player.selected ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}
                      title={tooltipText}
                    >
                      <input 
                        type="checkbox" 
                        checked={player.selected}
                        onChange={() => togglePlayerInConvocation(player.id)}
                        className="w-5 h-5 mr-3"
                      />
                      <span className={player.selected ? (isDuplicate ? 'text-red-600 font-bold' : 'text-gray-800') : 'text-gray-500'}>
                        {player.name}{player.shirt_number ? ` (#${player.shirt_number}${isGoalkeeper(player.position) ? ' 🥅' : ''})` : (isGoalkeeper(player.position) ? ' 🥅' : '')}
                      </span>
                      {isDuplicate && <span className="ml-auto text-red-500 text-xs">⚠️</span>}
                    </label>
                    );
                  })
                )}
              </div>
                );
              })()}

              <button
                onClick={openAddPlayersModal}
                className="w-full mb-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                + Añadir Jugadora
              </button>

              <div className="flex gap-2">
                <button
                  onClick={saveConvocation}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Guardar ({convocationPlayers.filter(p => p.selected).length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para añadir jugadoras */}
        {showAddPlayersModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Añadir Jugadoras</h3>
              <p className="text-gray-600 mb-4">
                Selecciona las jugadoras que quieres añadir:
              </p>
              
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {availablePlayers.length === 0 ? (
                  <p className="text-gray-500">No hay más jugadoras disponibles</p>
                ) : (
                  availablePlayers.map(player => (
                    <label 
                      key={player.id} 
                      className={`flex items-center p-3 rounded-lg border cursor-pointer ${player.selected ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <input 
                        type="checkbox" 
                        checked={player.selected}
                        onChange={() => toggleAvailablePlayer(player.id)}
                        className="w-5 h-5 mr-3"
                      />
                      <span className={player.selected ? 'text-gray-800' : 'text-gray-600'}>
                        {isGoalkeeper(player.position) ? '🥅 ' : ''}{player.name}{player.shirt_number ? ` (#${player.shirt_number})` : ''}
                      </span>
                    </label>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addSelectedPlayers}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Añadir ({availablePlayers.filter(p => p.selected).length})
                </button>
                <button
                  onClick={() => setShowAddPlayersModal(false)}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal de éxito */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
              <div className="text-5xl mb-4">✅</div>
              {successModalType === 'match' ? (
                <>
                  <h3 className="text-xl font-bold mb-2 text-gray-800">Partido Creado</h3>
                  <p className="text-gray-600 mb-4">El partido se ha creado correctamente.</p>
                  <p className="text-sm text-blue-600 mb-6">
                    Seguimiento en vivo: /match/{matchUrl}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold mb-2 text-gray-800">Convocatoria Guardada</h3>
                  <p className="text-gray-600 mb-6">La convocatoria se ha guardado correctamente.</p>
                </>
              )}
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
              >
                Aceptar
              </button>
            </div>
          </div>
        )}

        {/* Hidden card for image generation */}
        {eventHasConvocation && selectedEventDetail && (
          <div className="fixed -left-[9999px] top-0">
            <div 
              ref={shareCardRef}
              className="bg-white p-6 w-[400px] font-sans"
              style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)' }}
            >
              <div className="bg-white rounded-xl shadow-lg p-5">
                <div className="text-center mb-4 pb-3 border-b border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">🏑 CONVOCATORIA</p>
                  <div className="flex items-center justify-between mb-2 px-2">
                    <div className="flex items-center gap-2">
                      <img 
                        src={selectedEventDetail?.team?.club?.logo_url || 'https://placehold.co/40x40?text=Local'} 
                        alt="Local" 
                        className="w-8 h-8 object-contain rounded-full"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/40x40?text=Local'; }}
                      />
                      <span className="font-bold text-sm text-gray-800">{eventClubName || eventTeamName}</span>
                    </div>
                    <span className="text-gray-400 text-xs">vs</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-800">{selectedEventDetail?.opponent || 'Rival'}</span>
                      <img 
                        src={opponentData?.logo_url || 'https://placehold.co/40x40?text=Visitante'} 
                        alt="Visitante" 
                        className="w-8 h-8 object-contain rounded-full"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/40x40?text=Visitante'; }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1 mb-2">
                    {(() => {
                      const kitParts = (selectedEventDetail?.kit_color || '').split(';');
                      return kitParts.map((color, i) => color ? (
                        <span 
                          key={i} 
                          className="inline-block w-4 h-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: color }}
                        />
                      ) : null);
                    })()}
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>📅 {selectedEventDetail ? new Date(selectedEventDetail.start_datetime).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : ''} - {selectedEventDetail ? new Date(selectedEventDetail.start_datetime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                    {(selectedEventDetail as any).convocation_time && (
                      <p>🕑 Convocatoria: {new Date((selectedEventDetail as any).convocation_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                    <p>📍 {selectedEventDetail?.location || 'Por confirmar'}</p>
                  </div>
                </div>
                
                {(() => {
                  const selectedPlayers = convocationPlayers.filter(p => p.selected).sort((a, b) => a.name.localeCompare(b.name));
                  const duplicateDorsals = getDuplicateDorsals(selectedPlayers);
                  return (
                  <div className="mb-3">
                    <p className="font-bold text-gray-800 text-center mb-2">
                      CONVOCADAS
                    </p>
                    <div className="space-y-1">
                      {selectedPlayers.map((player, index) => {
                        const isDuplicate = duplicateDorsals.has(player.shirt_number);
                        return (
                        <div key={player.id} className={`text-sm text-gray-700 flex items-center gap-2 ${isDuplicate ? 'text-red-600 font-bold' : ''}`}>
                          <span className="w-5 text-center text-gray-400">{index + 1}.</span>
                          <span className="font-medium">{player.name}</span>
                          {player.shirt_number && (
                            <span>
                              #{player.shirt_number}
                              {isGoalkeeper(player.position) && ' 🥅'}
                            </span>
                          )}
                          {isDuplicate && <span className="text-red-500 text-xs">⚠️</span>}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })()}
                
                <div className="text-center pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400">Club de Hockey Sanse Complutense</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de éxito al compartir */}
        {showShareSuccessModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">¡Imagen copiada!</h3>
              <p className="text-gray-600 mb-6">Pégala en WhatsApp</p>
              <button
                onClick={() => setShowShareSuccessModal(false)}
                className="w-full bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
              >
                Aceptar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamsList;
