import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi, teamsApi, convocationApi } from '../lib/supabaseTeams';
import { Event, Team, Convocation } from '../types/teams';

const NextMatch: React.FC = () => {
  const [nextMatch, setNextMatch] = useState<Event | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [convocations, setConvocations] = useState<Convocation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadNextMatch();
  }, []);

  const loadNextMatch = async () => {
    try {
      setLoading(true);
      const eventsData = await eventsApi.getUpcomingEvents(10);
      const matchEvents = eventsData.filter(e => e.type === 'match');
      
      if (matchEvents.length > 0) {
        const next = matchEvents[0];
        setNextMatch(next);
        
        if (next.team_id) {
          const teamsData = await teamsApi.getTeams();
          const foundTeam = teamsData.find(t => t.id === next.team_id);
          setTeam(foundTeam || null);
        }
        
        const convs = await convocationApi.getConvocation(next.id);
        setConvocations(convs);
      }
    } catch (error) {
      console.error('Error loading next match:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === tomorrow.toDateString()) return 'Mañana';
    
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getConvocationStats = () => {
    const accepted = convocations.filter(c => c.status === 'accepted').length;
    const declined = convocations.filter(c => c.status === 'declined').length;
    const pending = convocations.filter(c => c.status === 'pending').length;
    return { accepted, declined, pending, total: convocations.length };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-2/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!nextMatch) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-2">🏑 Próximo Partido</h3>
        <p className="text-gray-500">No hay partidos programados</p>
        <button 
          onClick={() => navigate('/teams')}
          className="mt-4 text-sanse-blue font-medium hover:underline"
        >
          Ir a equipos para crear evento →
        </button>
      </div>
    );
  }

  const stats = getConvocationStats();
  const matchDate = new Date(nextMatch.start_datetime);
  const isToday = new Date().toDateString() === matchDate.toDateString();

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">🏑 Próximo Partido</h3>
        {isToday && (
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
            Hoy
          </span>
        )}
      </div>

      {/* Equipos */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-4">
          <div className="text-right">
            <p className="font-bold text-lg">{team?.name || 'Nuestro Equipo'}</p>
          </div>
          <div className="text-2xl font-bold text-gray-400">VS</div>
          <div className="text-left">
            <p className="font-bold text-lg">{nextMatch.opponent || 'Rival'}</p>
          </div>
        </div>
      </div>

      {/* Info Row: Fecha | Ubicación | Equipación */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Fecha */}
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base">📅</span>
            <div className="min-w-0">
              <p className="font-medium text-xs truncate">{formatDate(nextMatch.start_datetime)}</p>
              <p className="text-xs text-gray-500">{formatTime(nextMatch.start_datetime)}</p>
            </div>
          </div>
        </div>

        {/* Ubicación */}
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base">📍</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-xs truncate">{nextMatch.location || 'Por confirmar'}</p>
              {nextMatch.location_link && (
                <a 
                  href={nextMatch.location_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 hover:underline"
                >
                  Ver mapa
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Equipación */}
        {nextMatch.kit_color && (
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">👕</span>
              <div className="flex items-center gap-0.5">
                {(() => {
                  const parts = nextMatch.kit_color.split(';');
                  const isFemale = team?.gender === 'fem';
                  const bottomLabel = isFemale ? 'Pollera' : 'Pantalón';
                  return (
                    <>
                      {parts[0] && (
                        <span 
                          className="w-4 h-4 rounded border border-gray-300"
                          style={{ backgroundColor: parts[0] }}
                          title="Camiseta"
                        />
                      )}
                      {parts[1] && (
                        <span 
                          className="w-4 h-4 rounded border border-gray-300"
                          style={{ backgroundColor: parts[1] }}
                          title={bottomLabel}
                        />
                      )}
                      {parts[2] && (
                        <span 
                          className="w-4 h-4 rounded border border-gray-300"
                          style={{ backgroundColor: parts[2] }}
                          title="Medias"
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Jugadoras */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">📋</span>
          <p className="font-medium text-sm">Jugadoras</p>
        </div>
        {nextMatch.type === 'training' ? (
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-green-100 rounded py-1.5 text-center">
              <p className="text-base font-bold text-green-700">{stats.accepted}</p>
              <p className="text-[10px] text-green-600">Confirmadas</p>
            </div>
            <div className="bg-yellow-100 rounded py-1.5 text-center">
              <p className="text-base font-bold text-yellow-700">{stats.pending}</p>
              <p className="text-[10px] text-yellow-600">Pendientes</p>
            </div>
            <div className="bg-red-100 rounded py-1.5 text-center">
              <p className="text-base font-bold text-red-700">{stats.declined}</p>
              <p className="text-[10px] text-red-600">Rechazadas</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-1">
            <p className="text-2xl font-bold text-sanse-blue">{stats.total}</p>
            <p className="text-xs text-gray-500">Convocadas</p>
          </div>
        )}
      </div>

      {/* Notas del entrenador */}
      {nextMatch.notes && (
        <div className="bg-blue-50 rounded-lg p-2 mt-2">
          <div className="flex items-start gap-1.5">
            <span className="text-sm">💬</span>
            <p className="text-xs text-blue-800">{nextMatch.notes}</p>
          </div>
        </div>
      )}

      {/* Botón iniciar partido si es hoy */}
      {isToday && (
        <button
          onClick={() => navigate(`/teams/${nextMatch.team_id}`)}
          className="w-full mt-2 bg-sanse-blue text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
        >
          🏑 Iniciar Partido
        </button>
      )}
    </div>
  );
};

export default NextMatch;
