import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hockeyApi } from '../../lib/supabaseHockey';
import { HockeyMatch } from '../../types/hockey';

const MatchList: React.FC = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<HockeyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const data = await hockeyApi.getUserMatches();
      setMatches(data);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = () => {
    navigate('/hockey/new');
  };

  const handleJoinMatch = async () => {
    if (!joinCode.trim()) return;
    
    const match = await hockeyApi.getMatchByToken(joinCode.trim());
    if (match) {
      navigate(`/hockey/${match.id}`);
    } else {
      alert('Partido no encontrado. Verifica el código.');
    }
    setShowJoinModal(false);
    setJoinCode('');
  };

  const handleDeleteMatch = async (id: string, name: string) => {
    if (window.confirm(`¿Eliminar el partido "${name}"?`)) {
      try {
        await hockeyApi.deleteMatch(id);
        setMatches(matches.filter(m => m.id !== id));
        alert('Partido eliminado');
      } catch (error) {
        console.error('Error deleting match:', error);
        alert('Error al eliminar el partido');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'En juego' },
      paused: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Pausado' },
      finished: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Finalizado' },
    };
    const s = statusMap[status] || statusMap.pending;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/hockey/${token}/watch`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Enlace copiado al portapapeles');
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Cargando partidos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">🏑 Hockey Score</h1>
            <p className="text-gray-300">Gestiona tus partidos en tiempo real</p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleCreateMatch}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
          >
            🆕 Crear Nuevo Partido
          </button>

          <button
            onClick={() => setShowJoinModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
          >
            🔗 Unirse a Partido
          </button>
        </div>

        {/* Lista de partidos */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">Mis Partidos</h2>

          {matches.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              <p className="text-lg mb-2">No hay partidos todavía</p>
              <p className="text-sm">Crea tu primer partido o únete a uno existente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className="bg-white/10 rounded-xl p-4 border border-white/10 hover:bg-white/20 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="px-3 py-1 rounded-full text-sm font-bold"
                          style={{ backgroundColor: match.team1_color + '40', color: match.team1_color }}
                        >
                          {match.team1_name}
                        </span>
                        <span className="text-white font-bold text-xl">vs</span>
                        <span
                          className="px-3 py-1 rounded-full text-sm font-bold"
                          style={{ backgroundColor: match.team2_color + '40', color: match.team2_color }}
                        >
                          {match.team2_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <span>{getStatusBadge(match.status)}</span>
                        <span>
                          {match.score_team1} - {match.score_team2}
                        </span>
                        <span>Cuarto: {match.quarter}/4</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        {new Date(match.created_at).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => navigate(`/hockey/${match.id}`)}
                        className="bg-sanse-blue text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm"
                      >
                        ⚙️ Admin
                      </button>
                      <button
                        onClick={() => copyShareLink(match.share_token)}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm"
                      >
                        📤
                      </button>
                      <button
                        onClick={() => handleDeleteMatch(match.id, `${match.team1_name} vs ${match.team2_name}`)}
                        className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm"
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

        {/* Modal para unirse a partido */}
        {showJoinModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#071025] rounded-2xl p-6 max-w-md w-full border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Unirse a Partido</h3>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Ingresa el código o token del partido"
                className="w-full p-3 rounded bg-white/10 text-white border border-white/20 mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleJoinMatch}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
                >
                  Unirse
                </button>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchList;
