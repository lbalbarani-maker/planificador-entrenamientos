import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tournamentsApi } from '../../lib/supabaseTournaments';
import { Season, Tournament } from '../../types/tournaments';
import BackButton from '../BackButton';

const TournamentsList: React.FC = () => {
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [showTournamentForm, setShowTournamentForm] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [filterModality, setFilterModality] = useState<string>('all');
  
  const [seasonForm, setSeasonForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: true
  });
  
  const [tournamentForm, setTournamentForm] = useState({
    season_id: '',
    name: '',
    modality: 'field' as 'field' | 'indoor',
    competition_type: 'league' as 'league' | 'cup' | 'friendly'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [seasonsData, tournamentsData] = await Promise.all([
        tournamentsApi.getSeasons(),
        tournamentsApi.getTournaments()
      ]);
      setSeasons(seasonsData);
      setTournaments(tournamentsData);
      
      if (seasonsData.length > 0 && !selectedSeason) {
        setSelectedSeason(seasonsData[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newSeason = await tournamentsApi.createSeason(seasonForm);
      await tournamentsApi.createFriendlyTournaments(newSeason.id);
      await loadData();
      setShowSeasonForm(false);
      setSeasonForm({ name: '', start_date: '', end_date: '', is_active: true });
      alert('Temporada creada con torneos Amistoso');
    } catch (error) {
      console.error('Error creating season:', error);
      alert('Error al crear la temporada');
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await tournamentsApi.createTournament(tournamentForm);
      await loadData();
      setShowTournamentForm(false);
      setTournamentForm({
        season_id: selectedSeason,
        name: '',
        modality: 'field',
        competition_type: 'league'
      });
      alert('Torneo creado correctamente');
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert('Error al crear el torneo');
    }
  };

  const filteredTournaments = tournaments.filter(t => {
    if (selectedSeason && t.season_id !== selectedSeason) return false;
    if (filterModality !== 'all' && t.modality !== filterModality) return false;
    return true;
  });

  const tournamentsBySeason = filteredTournaments.reduce((acc, t) => {
    const seasonId = t.season_id;
    if (!acc[seasonId]) {
      acc[seasonId] = [];
    }
    acc[seasonId].push(t);
    return acc;
  }, {} as Record<string, Tournament[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <BackButton to="/dashboard" />
          <div className="text-center py-8">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <BackButton to="/dashboard" />
        
        <div className="flex justify-between items-center mb-6 mt-4">
          <div>
            <h1 className="text-3xl font-bold text-sanse-blue">🏆 Torneos</h1>
            <p className="text-gray-600">Gestión de competiciones y temporadas</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSeasonForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
            >
              + Nueva Temporada
            </button>
            <button
              onClick={() => setShowTournamentForm(true)}
              className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              + Nuevo Torneo
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporada</label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
              <select
                value={filterModality}
                onChange={(e) => setFilterModality(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="all">Todas</option>
                <option value="field">Hierba</option>
                <option value="indoor">Sala</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de torneos por temporada */}
        {seasons.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 mb-4">No hay temporadas creadas</p>
            <button
              onClick={() => setShowSeasonForm(true)}
              className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Crear primera temporada
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(tournamentsBySeason).map(([seasonId, seasonTournaments]) => {
              const season = seasons.find(s => s.id === seasonId);
              return (
                <div key={seasonId} className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold mb-4">
                    {season?.name || 'Temporada'}
                  </h2>
                  
                  {seasonTournaments.length === 0 ? (
                    <p className="text-gray-500">No hay torneos en esta temporada</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {seasonTournaments.map(tournament => (
                        <div
                          key={tournament.id}
                          onClick={() => navigate(`/tournaments/${tournament.id}`)}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-bold text-lg text-gray-800">{tournament.name}</h3>
                              <div className="flex gap-2 mt-2">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  tournament.modality === 'field' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {tournament.modality === 'field' ? '🌱 Hierba' : '🏟️ Sala'}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
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
                            <span className="text-2xl">
                              {tournament.competition_type === 'friendly' ? '🤝' : 
                               tournament.competition_type === 'league' ? '📊' : '🏆'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Nueva Temporada */}
        {showSeasonForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Nueva Temporada</h3>
              <form onSubmit={handleCreateSeason} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={seasonForm.name}
                    onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                    placeholder="2025/2026"
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                    <input
                      type="date"
                      value={seasonForm.start_date}
                      onChange={(e) => setSeasonForm({ ...seasonForm, start_date: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                    <input
                      type="date"
                      value={seasonForm.end_date}
                      onChange={(e) => setSeasonForm({ ...seasonForm, end_date: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    Crear Temporada
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSeasonForm(false)}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Nuevo Torneo */}
        {showTournamentForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Nuevo Torneo</h3>
              <form onSubmit={handleCreateTournament} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temporada *</label>
                  <select
                    value={tournamentForm.season_id}
                    onChange={(e) => setTournamentForm({ ...tournamentForm, season_id: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {seasons.map(season => (
                      <option key={season.id} value={season.id}>{season.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del torneo *</label>
                  <input
                    type="text"
                    value={tournamentForm.name}
                    onChange={(e) => setTournamentForm({ ...tournamentForm, name: e.target.value })}
                    placeholder="Liga Madrileña"
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad *</label>
                  <select
                    value={tournamentForm.modality}
                    onChange={(e) => setTournamentForm({ ...tournamentForm, modality: e.target.value as any })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="field">🌱 Hierba</option>
                    <option value="indoor">🏟️ Sala</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de competición *</label>
                  <select
                    value={tournamentForm.competition_type}
                    onChange={(e) => setTournamentForm({ ...tournamentForm, competition_type: e.target.value as any })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="league">📊 Liga</option>
                    <option value="cup">🏆 Copa</option>
                    <option value="friendly">🤝 Amistoso</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    Crear Torneo
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTournamentForm(false)}
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

export default TournamentsList;
