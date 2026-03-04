import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamsApi, eventsApi } from '../../lib/supabaseTeams';
import { Team, Event } from '../../types/teams';

const TeamsList: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  
  const [teamForm, setTeamForm] = useState({ name: '', category: '', gender: '' });
  const [eventForm, setEventForm] = useState({
    type: 'match' as 'match' | 'training' | 'meeting',
    title: '',
    start_datetime: '',
    location: '',
    location_link: '',
    kit_color: '',
    notes: '',
    opponent: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [teamsData, eventsData] = await Promise.all([
        teamsApi.getTeams(),
        eventsApi.getUpcomingEvents(20)
      ]);
      setTeams(teamsData);
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading data:', error);
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
    try {
      if (editingEvent) {
        await eventsApi.updateEvent(editingEvent.id, {
          ...eventForm,
          start_datetime: new Date(eventForm.start_datetime).toISOString()
        });
      } else {
        await eventsApi.createEvent({
          team_id: selectedTeam,
          ...eventForm,
          start_datetime: new Date(eventForm.start_datetime).toISOString()
        });
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
    setEventForm({
      type: event.type,
      title: event.title || '',
      start_datetime: event.start_datetime.slice(0, 16),
      location: event.location || '',
      location_link: event.location_link || '',
      kit_color: event.kit_color || '',
      notes: event.notes || '',
      opponent: event.opponent || ''
    });
    setShowEventForm(true);
  };

  const handleDeleteEvent = async (id: string) => {
    if (window.confirm('¿Eliminar este evento?')) {
      try {
        await eventsApi.deleteEvent(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error al eliminar el evento');
      }
    }
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
      location: '',
      location_link: '',
      kit_color: '',
      notes: '',
      opponent: ''
    });
    setEditingEvent(null);
    setShowEventForm(false);
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

  if (loading) return <div className="text-center p-8">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
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
            <button
              onClick={() => navigate('/hockey')}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
            >
              🏑 Partidos en Vivo
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
                          ? `${event.team?.name || 'Equipo'} vs ${event.opponent}`
                          : event.title || getEventTypeLabel(event.type)
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        {event.team?.name} • {event.location || 'Sin ubicación'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-sanse-blue">{formatDate(event.start_datetime)}</p>
                      {event.kit_color && (
                        <span 
                          className="inline-block px-2 py-1 rounded text-xs text-white"
                          style={{ backgroundColor: event.kit_color }}
                        >
                          {event.kit_color}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map(team => (
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
                  <div className="flex gap-2 text-sm text-gray-600">
                    {team.category && (
                      <span className="bg-gray-100 px-2 py-1 rounded">{team.category}</span>
                    )}
                    {team.gender && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {team.gender === 'fem' ? '👩' : team.gender === 'masc' ? '👨' : '👥'}
                      </span>
                    )}
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
                    <option value="prebenjamin">Prebenjamín</option>
                    <option value="benjamin">Benjamín</option>
                    <option value="alevin">Alevín</option>
                    <option value="infantil">Infantil</option>
                    <option value="cadete">Cadete</option>
                    <option value="juvenil">Juvenil</option>
                    <option value="senior">Senior</option>
                    <option value="veterano">Veterano</option>
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
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</h3>
              <form onSubmit={handleSaveEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Equipo *</label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
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
                    onChange={(e) => setEventForm({ ...eventForm, type: e.target.value as any })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="match">Partido</option>
                    <option value="training">Entrenamiento</option>
                    <option value="meeting">Reunión</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora *</label>
                  <input
                    type="datetime-local"
                    value={eventForm.start_datetime}
                    onChange={(e) => setEventForm({ ...eventForm, start_datetime: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="Nombre del campo"
                  />
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
                    <input
                      type="text"
                      value={eventForm.opponent}
                      onChange={(e) => setEventForm({ ...eventForm, opponent: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      placeholder="Nombre del equipo rival"
                    />
                  </div>
                )}
                {eventForm.type === 'match' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color equipación</label>
                    <input
                      type="color"
                      value={eventForm.kit_color || '#ff0000'}
                      onChange={(e) => setEventForm({ ...eventForm, kit_color: e.target.value })}
                      className="w-full h-10 border border-gray-300 rounded-lg"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={eventForm.notes}
                    onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
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
      </div>
    </div>
  );
};

export default TeamsList;
