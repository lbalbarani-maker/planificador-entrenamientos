import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { tournamentsApi } from '../../lib/supabaseTournaments';
import { supabase } from '../../lib/supabase';
import { Tournament, Matchday, Standing } from '../../types/tournaments';
import BackButton from '../BackButton';

type TabType = 'calendar' | 'standings' | 'stats';

const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('calendar');
  const [showMatchdayForm, setShowMatchdayForm] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  
  const [matchdayForm, setMatchdayForm] = useState({
    round_number: 1,
    name: '',
    start_date: ''
  });

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [tournamentData, matchdaysData, eventsData] = await Promise.all([
        tournamentsApi.getTournament(id!),
        tournamentsApi.getMatchdays(id!),
        supabase
          .from('events')
          .select('*, team:teams(name), matchday:matchdays(name)')
          .eq('tournament_id', id)
          .eq('type', 'match')
          .order('start_datetime')
      ]);
      
      setTournament(tournamentData);
      setMatchdays(matchdaysData);
      setEvents(eventsData.data || []);
      
      // Load standings
      const standingsData = await tournamentsApi.getStandings(id!);
      setStandings(standingsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatchday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await tournamentsApi.createMatchday({
        tournament_id: id,
        ...matchdayForm
      });
      await loadData();
      setShowMatchdayForm(false);
      setMatchdayForm({ round_number: matchdays.length + 1, name: '', start_date: '' });
      alert('Jornada creada correctamente');
    } catch (error) {
      console.error('Error creating matchday:', error);
      alert('Error al crear la jornada');
    }
  };

  const handleRecalculateStandings = async () => {
    setRecalculating(true);
    try {
      const newStandings = await tournamentsApi.recalculateStandings(id!);
      setStandings(newStandings);
      alert('Clasificación actualizada');
    } catch (error) {
      console.error('Error recalculating standings:', error);
      alert('Error al recalcular la clasificación');
    } finally {
      setRecalculating(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">Finalizado</span>;
      case 'in_progress':
        return <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">En juego</span>;
      default:
        return <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded-full">Pendiente</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <BackButton to="/tournaments" />
          <div className="text-center py-8">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <BackButton to="/tournaments" />
          <div className="text-center py-8">Torneo no encontrado</div>
        </div>
      </div>
    );
  }

  const eventsByMatchday = events.reduce((acc, event) => {
    const matchdayId = event.matchday_id || 'no_jornada';
    if (!acc[matchdayId]) {
      acc[matchdayId] = [];
    }
    acc[matchdayId].push(event);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <BackButton to="/tournaments" />
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-sanse-blue">{tournament.name}</h1>
              <p className="text-gray-600">{tournament.season?.name}</p>
              <div className="flex gap-2 mt-2">
                <span className={`text-xs px-3 py-1 rounded-full ${
                  tournament.modality === 'field' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {tournament.modality === 'field' ? '🌱 Hierba' : '🏟️ Sala'}
                </span>
                <span className={`text-xs px-3 py-1 rounded-full ${
                  tournament.competition_type === 'friendly'
                    ? 'bg-gray-100 text-gray-800'
                    : tournament.competition_type === 'league'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {tournament.competition_type === 'friendly' ? '🤝 Amistoso' : 
                   tournament.competition_type === 'league' ? '📊 Liga' : '🏆 Copa'}
                </span>
              </div>
            </div>
            {tournament.competition_type !== 'friendly' && (
              <button
                onClick={() => setShowMatchdayForm(true)}
                className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                + Nueva Jornada
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'calendar'
                  ? 'text-sanse-blue border-b-2 border-sanse-blue'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📅 Calendario
            </button>
            {tournament.competition_type !== 'friendly' && (
              <button
                onClick={() => setActiveTab('standings')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'standings'
                    ? 'text-sanse-blue border-b-2 border-sanse-blue'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🏆 Clasificación
              </button>
            )}
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'stats'
                  ? 'text-sanse-blue border-b-2 border-sanse-blue'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 Estadísticas
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {activeTab === 'calendar' && (
            <div>
              {matchdays.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No hay jornadas creadas</p>
                  {tournament.competition_type !== 'friendly' && (
                    <button
                      onClick={() => setShowMatchdayForm(true)}
                      className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Crear primera jornada
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {matchdays.map(matchday => (
                    <div key={matchday.id}>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-lg">
                          {matchday.name || `Jornada ${matchday.round_number}`}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {matchday.start_date ? new Date(matchday.start_date).toLocaleDateString('es-ES') : ''}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {(eventsByMatchday[matchday.id] || []).length === 0 ? (
                          <p className="text-gray-400 text-sm">Sin partidos</p>
                        ) : (
                          (eventsByMatchday[matchday.id] || []).map((event: any) => (
                            <div key={event.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                              <div className="flex-1 text-right">
                                <span className="font-bold">{event.team?.name || 'Local'}</span>
                              </div>
                              <div className="px-4 text-center">
                                <span className="text-2xl font-bold">
                                  {event.home_score ?? '-'} - {event.away_score ?? '-'}
                                </span>
                                <div className="text-xs text-gray-500">
                                  {event.start_datetime ? new Date(event.start_datetime).toLocaleDateString('es-ES', { 
                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                                  }) : ''}
                                </div>
                              </div>
                              <div className="flex-1 text-left">
                                <span className="font-bold">{event.opponent || 'Visitante'}</span>
                              </div>
                              <div className="ml-4">
                                {getStatusBadge(event.status)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Partidos sin jornada */}
                  {eventsByMatchday['no_jornada']?.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg mb-3">Partidos sin jornada</h3>
                      <div className="space-y-2">
                        {eventsByMatchday['no_jornada'].map((event: any) => (
                          <div key={event.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                            <div className="flex-1 text-right">
                              <span className="font-bold">{event.team?.name || 'Local'}</span>
                            </div>
                            <div className="px-4 text-center">
                              <span className="text-2xl font-bold">
                                {event.home_score ?? '-'} - {event.away_score ?? '-'}
                              </span>
                            </div>
                            <div className="flex-1 text-left">
                              <span className="font-bold">{event.opponent || 'Visitante'}</span>
                            </div>
                            <div className="ml-4">
                              {getStatusBadge(event.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'standings' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Clasificación</h2>
                <button
                  onClick={handleRecalculateStandings}
                  disabled={recalculating}
                  className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {recalculating ? 'Calculando...' : '🔄 Recalcular'}
                </button>
              </div>
              
              {standings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No hay datos de clasificación. Juega algunos partidos y recalcula.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">POS</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Equipo</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">PJ</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">PG</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">PE</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">PP</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GF</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GC</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">DG</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {standings.map((standing, index) => (
                        <tr key={standing.id} className={index < 3 ? 'bg-yellow-50' : ''}>
                          <td className="px-4 py-3 font-bold">{index + 1}</td>
                          <td className="px-4 py-3 font-medium">{standing.team_name}</td>
                          <td className="px-4 py-3 text-center">{standing.played}</td>
                          <td className="px-4 py-3 text-center text-green-600">{standing.wins}</td>
                          <td className="px-4 py-3 text-center text-yellow-600">{standing.draws}</td>
                          <td className="px-4 py-3 text-center text-red-600">{standing.losses}</td>
                          <td className="px-4 py-3 text-center">{standing.goals_for}</td>
                          <td className="px-4 py-3 text-center">{standing.goals_against}</td>
                          <td className="px-4 py-3 text-center">{standing.goal_difference > 0 ? `+${standing.goal_difference}` : standing.goal_difference}</td>
                          <td className="px-4 py-3 text-center font-bold text-sanse-blue">{standing.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Estadísticas</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-lg p-6 text-center">
                  <div className="text-4xl font-bold text-blue-600">{events.length}</div>
                  <div className="text-gray-600">Partidos jugados</div>
                </div>
                <div className="bg-green-50 rounded-lg p-6 text-center">
                  <div className="text-4xl font-bold text-green-600">
                    {events.filter(e => e.status === 'completed').length}
                  </div>
                  <div className="text-gray-600">Partidos finalizados</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-6 text-center">
                  <div className="text-4xl font-bold text-purple-600">{matchdays.length}</div>
                  <div className="text-gray-600">Jornadas</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Nueva Jornada */}
        {showMatchdayForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Nueva Jornada</h3>
              <form onSubmit={handleCreateMatchday} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de jornada *</label>
                  <input
                    type="number"
                    min="1"
                    value={matchdayForm.round_number}
                    onChange={(e) => setMatchdayForm({ ...matchdayForm, round_number: parseInt(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre (opcional)</label>
                  <input
                    type="text"
                    value={matchdayForm.name}
                    onChange={(e) => setMatchdayForm({ ...matchdayForm, name: e.target.value })}
                    placeholder="ej: Jornada de Navidad"
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={matchdayForm.start_date}
                    onChange={(e) => setMatchdayForm({ ...matchdayForm, start_date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    Crear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMatchdayForm(false)}
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

export default TournamentDetail;
