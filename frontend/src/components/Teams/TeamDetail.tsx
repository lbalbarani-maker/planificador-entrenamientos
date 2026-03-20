import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { teamsApi, eventsApi, convocationApi } from '../../lib/supabaseTeams';
import { Team, Player, TeamPlayer, Event, Convocation } from '../../types/teams';

const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [convocations, setConvocations] = useState<Record<string, Convocation[]>>({});
  const [loading, setLoading] = useState(true);
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [showConvocationForm, setShowConvocationForm] = useState(false);
  const [showAddExistingPlayerModal, setShowAddExistingPlayerModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<{ id: string; name: string; number: string; position: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'players' | 'events'>('players');
  const [addingPlayers, setAddingPlayers] = useState<string[]>([]);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [teamData, playersData, eventsData] = await Promise.all([
        teamsApi.getTeams(),
        teamsApi.getTeamPlayers(id!),
        eventsApi.getEvents(id)
      ]);
      
      const currentTeam = teamData.find(t => t.id === id);
      setTeam(currentTeam || null);
      setTeamPlayers(playersData);
      setEvents(eventsData);

      const clubId = currentTeam?.club_id || (JSON.parse(localStorage.getItem('user') || '{}')?.club_id);
      if (clubId) {
        const available = await teamsApi.getAvailablePlayers(clubId);
        setAvailablePlayers(available);
      }

      const conv: Record<string, Convocation[]> = {};
      for (const event of eventsData) {
        const convs = await convocationApi.getConvocation(event.id);
        conv[event.id] = convs;
      }
      setConvocations(conv);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    
    try {
      const dorsal = newPlayerNumber ? parseInt(newPlayerNumber) : undefined;
      const position = newPlayerPosition || undefined;
      const player = await teamsApi.createPlayer(newPlayerName, undefined, { dorsal, position });
      await teamsApi.addPlayerToTeam(
        id!, 
        player.id, 
        dorsal,
        position
      );
      await loadData();
      setNewPlayerName('');
      setNewPlayerNumber('');
      setNewPlayerPosition('');
      setShowPlayerForm(false);
    } catch (error) {
      console.error('Error adding player:', error);
      alert('Error al añadir jugador');
    }
  };

  const handleAddExistingPlayers = async () => {
    if (addingPlayers.length === 0) return;
    
    try {
      for (const playerId of addingPlayers) {
        await teamsApi.addPlayerToTeam(id!, playerId);
      }
      await loadData();
      setShowAddExistingPlayerModal(false);
      setAddingPlayers([]);
      alert('Jugadores añadidos correctamente');
    } catch (error) {
      console.error('Error adding players:', error);
      alert('Error al añadir jugadores');
    }
  };

  const togglePlayerSelection = (playerId: string) => {
    setAddingPlayers(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    
    try {
      await teamsApi.updateTeamPlayer(editingPlayer.id, {
        shirt_number: editingPlayer.number ? parseInt(editingPlayer.number) : undefined,
        position: editingPlayer.position || undefined,
      });
      await loadData();
      setEditingPlayer(null);
    } catch (error) {
      console.error('Error updating player:', error);
      alert('Error al actualizar jugador');
    }
  };

  const handleRemovePlayer = async (teamPlayerId: string, playerName: string) => {
    if (window.confirm(`¿Eliminar a ${playerName} del equipo?`)) {
      try {
        await teamsApi.removePlayerFromTeam(teamPlayerId);
        await loadData();
      } catch (error) {
        console.error('Error removing player:', error);
      }
    }
  };

  const handleCreateConvocation = async (eventId: string) => {
    try {
      const playerIds = teamPlayers.map(tp => tp.player_id);
      await convocationApi.createBulkConvocation(eventId, playerIds);
      await loadData();
      alert('Convocatoria creada');
    } catch (error) {
      console.error('Error creating convocation:', error);
      alert('Error al crear convocatoria');
    }
  };

  const handleUpdateConvocation = async (convocationId: string, status: 'accepted' | 'declined') => {
    try {
      await convocationApi.updateConvocationStatus(convocationId, status);
      await loadData();
    } catch (error) {
      console.error('Error updating convocation:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConvocationStats = (eventId: string) => {
    const convs = convocations[eventId] || [];
    const accepted = convs.filter(c => c.status === 'accepted').length;
    const declined = convs.filter(c => c.status === 'declined').length;
    const pending = convs.filter(c => c.status === 'pending').length;
    return { accepted, declined, pending, total: convs.length };
  };

  if (loading) return <div className="text-center p-8">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <button onClick={() => navigate('/teams')} className="text-sanse-blue hover:underline mb-2">
              ← Volver a Equipos
            </button>
            <h1 className="text-3xl font-bold text-sanse-blue">{team?.name}</h1>
            <p className="text-gray-600">
              {team?.category} {team?.gender === 'fem' ? 'Femenino' : team?.gender === 'masc' ? 'Masculino' : ''}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('players')}
            className={`px-4 py-2 rounded-lg font-semibold ${activeTab === 'players' ? 'bg-sanse-blue text-white' : 'bg-white text-gray-700'}`}
          >
            👥 Jugadores ({teamPlayers.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-lg font-semibold ${activeTab === 'events' ? 'bg-sanse-blue text-white' : 'bg-white text-gray-700'}`}
          >
            📅 Eventos ({events.length})
          </button>
        </div>

        {/* Jugadores */}
        {activeTab === 'players' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Jugadores del Equipo</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddExistingPlayerModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  + Añadir Jugadores Existentes
                </button>
                <button
                  onClick={() => setShowPlayerForm(true)}
                  className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  + Crear Jugador
                </button>
              </div>
            </div>

            {teamPlayers.length === 0 ? (
              <p className="text-gray-500">No hay jugadores en el equipo</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamPlayers.map(tp => (
                  <div key={tp.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sanse-blue text-white rounded-full flex items-center justify-center font-bold">
                        {tp.shirt_number || '?'}
                      </div>
                      <div>
                        <p className="font-semibold">{tp.player?.full_name}</p>
                        <p className="text-sm text-gray-500">
                          {tp.player?.position === 'Portero' || tp.player?.position === 'Portera' ? '🥅 ' : ''}{tp.player?.position || 'Jugador'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingPlayer({
                          id: tp.id,
                          name: tp.player?.full_name || '',
                          number: tp.shirt_number?.toString() || '',
                          position: tp.position || '',
                        })}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleRemovePlayer(tp.id, tp.player?.full_name || '')}
                        className="text-red-600 hover:text-red-800"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Eventos */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            {events.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-500">No hay eventos para este equipo</p>
              </div>
            ) : (
              events.map(event => {
                const stats = getConvocationStats(event.id);
                return (
                  <div key={event.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">
                          {event.type === 'match' ? '🏑 Partido' : event.type === 'training' ? '🏋️ Entrenamiento' : '📋 Reunión'}
                          {event.type === 'match' && event.opponent && ` vs ${event.opponent}`}
                        </h3>
                        <p className="text-gray-600">{formatDate(event.start_datetime)}</p>
                        {event.location && <p className="text-sm text-gray-500">📍 {event.location}</p>}
                      </div>
                      <div className="text-right">
                        {event.kit_color && (
                          <span 
                            className="inline-block px-3 py-1 rounded text-white text-sm mb-2"
                            style={{ backgroundColor: event.kit_color }}
                          >
                            Equipación
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Convocatoria */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">Convocatoria</h4>
                        <button
                          onClick={() => handleCreateConvocation(event.id)}
                          className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                        >
                          + Crear Convocatoria
                        </button>
                      </div>
                      
                      {stats.total > 0 ? (
                        <div className="flex gap-4 text-sm">
                          <span className="text-green-600">✅ {stats.accepted} confirmados</span>
                          <span className="text-red-600">❌ {stats.declined} rechazados</span>
                          <span className="text-gray-500">⏳ {stats.pending} pendientes</span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Sin convocatoria creada</p>
                      )}

                      {/* Lista de convocatorias */}
                      {convocations[event.id]?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {convocations[event.id].map(conv => (
                            <div key={conv.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                              <span className="text-sm">{conv.player?.full_name}</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateConvocation(conv.id, 'accepted')}
                                  className={`text-sm px-2 py-1 rounded ${conv.status === 'accepted' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                                >
                                  ✅
                                </button>
                                <button
                                  onClick={() => handleUpdateConvocation(conv.id, 'declined')}
                                  className={`text-sm px-2 py-1 rounded ${conv.status === 'declined' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
                                >
                                  ❌
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Formulario de jugador */}
        {showPlayerForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Añadir Jugador</h3>
              <form onSubmit={handleAddPlayer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dorsal</label>
                  <input
                    type="number"
                    value={newPlayerNumber}
                    onChange={(e) => setNewPlayerNumber(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    min="1"
                    max="99"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Posición</label>
                  <select
                    value={newPlayerPosition}
                    onChange={(e) => setNewPlayerPosition(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Portera">Portera</option>
                    <option value="Defensa">Defensa</option>
                    <option value="Centrocampista">Centrocampista</option>
                    <option value="Delantera">Delantera</option>
                    <option value="Jugador">Jugador</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    Añadir
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPlayerForm(false)}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal editar jugador */}
        {editingPlayer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Editar Jugador: {editingPlayer.name}</h3>
              <form onSubmit={handleUpdatePlayer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dorsal</label>
                  <input
                    type="number"
                    value={editingPlayer.number}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, number: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    min="1"
                    max="99"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Posición</label>
                  <select
                    value={editingPlayer.position}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, position: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Portera">Portera</option>
                    <option value="Defensa">Defensa</option>
                    <option value="Centrocampista">Centrocampista</option>
                    <option value="Delantera">Delantera</option>
                    <option value="Jugador">Jugador</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal para añadir jugadores existentes */}
        {showAddExistingPlayerModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">Añadir Jugadores Existentes</h3>
              <p className="text-gray-600 mb-4">
                Selecciona los jugadores que pertenecen al club pero no están en ningún equipo:
              </p>
              
              {availablePlayers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No hay jugadores disponibles. Todos los jugadores del club ya están asignados a un equipo.
                </p>
              ) : (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                    {availablePlayers.map(player => (
                      <label 
                        key={player.id}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer ${addingPlayers.includes(player.id) ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}
                      >
                        <input 
                          type="checkbox" 
                          checked={addingPlayers.includes(player.id)}
                          onChange={() => togglePlayerSelection(player.id)}
                          className="w-5 h-5 mr-3"
                        />
                        <span className="font-medium">{player.full_name}</span>
                      </label>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddExistingPlayers}
                      disabled={addingPlayers.length === 0}
                      className={`flex-1 py-2 rounded-lg ${addingPlayers.length > 0 ? 'bg-sanse-blue text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                    >
                      Añadir ({addingPlayers.length})
                    </button>
                    <button
                      onClick={() => { setShowAddExistingPlayerModal(false); setAddingPlayers([]); }}
                      className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamDetail;
