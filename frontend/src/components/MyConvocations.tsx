import React, { useState, useEffect } from 'react';
import { eventsApi, teamsApi, convocationApi } from '../lib/supabaseTeams';
import { supabase } from '../lib/supabase';
import { Event, Convocation, Player } from '../types/teams';

interface MyConvocationsProps {
  userPlayerId?: string;
}

const MyConvocations: React.FC<MyConvocationsProps> = ({ userPlayerId }) => {
  const [convocations, setConvocations] = useState<Array<Convocation & { event?: Event; teamName?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState<string>(userPlayerId || localStorage.getItem('selectedPlayerId') || '');
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  const loadPlayers = async () => {
    try {
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('is_active', true)
        .order('full_name');
      setPlayers(playersData || []);
      return playersData || [];
    } catch (error) {
      console.error('Error loading players:', error);
      return [];
    }
  };

  const loadData = async () => {
    if (!playerId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const teamsData = await teamsApi.getTeams();
      setTeams(teamsData);

      const { data: convData } = await supabase
        .from('convocation')
        .select('*')
        .eq('player_id', playerId);

      if (convData && convData.length > 0) {
        const eventIds = convData.map(c => c.event_id);
        const { data: eventsData } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds)
          .order('start_datetime', { ascending: false });

        const enrichedConvocations = convData.map(conv => {
          const event = eventsData?.find(e => e.id === conv.event_id);
          const team = teamsData.find(t => t.id === event?.team_id);
          const finalConv = event?.final_convocation ? JSON.parse(event.final_convocation) : [];
          const isConvoked = finalConv.includes(playerId);
          return {
            ...conv,
            event: event || null,
            teamName: team?.name || '',
            isConvoked
          };
        });

        setConvocations(enrichedConvocations);
      } else {
        setConvocations([]);
      }
    } catch (error) {
      console.error('Error loading convocations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadPlayers();
      await loadData();
    };
    init();
  }, []);

  useEffect(() => {
    if (playerId) {
      loadData();
    }
  }, [playerId]);

  const handleUpdateStatus = async (convocationId: string, status: 'accepted' | 'declined' | 'pending') => {
    try {
      await convocationApi.updateConvocationStatus(convocationId, status);
      await loadData();
    } catch (error) {
      console.error('Error updating convocation:', error);
    }
  };

  const handlePlayerChange = (newPlayerId: string) => {
    setPlayerId(newPlayerId);
    localStorage.setItem('selectedPlayerId', newPlayerId);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!playerId) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">🏆 Mis Convocatorias</h2>
        <p className="text-gray-600 mb-4">Selecciona tu perfil para ver tus convocatorias:</p>
        <select
          value={playerId}
          onChange={(e) => handlePlayerChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg"
        >
          <option value="">Seleccionar jugadora...</option>
          {players.map(player => (
            <option key={player.id} value={player.id}>{player.full_name}</option>
          ))}
        </select>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">🏆 Mis Convocatorias</h2>
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  const pendingConvocations = convocations.filter(c => c.status === 'pending');
  const acceptedConvocations = convocations.filter(c => c.status === 'accepted');
  const declinedConvocations = convocations.filter(c => c.status === 'declined');

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">🏆 Mis Convocatorias</h2>
        <select
          value={playerId}
          onChange={(e) => handlePlayerChange(e.target.value)}
          className="p-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">Cambiar jugadora...</option>
          {players.map(player => (
            <option key={player.id} value={player.id}>{player.full_name}</option>
          ))}
        </select>
      </div>

      {convocations.length === 0 ? (
        <p className="text-gray-500">No tienes convocatorias pendientes</p>
      ) : (
        <div className="space-y-4">
          {pendingConvocations.length > 0 && (
            <div>
              <h3 className="font-semibold text-yellow-700 mb-2">⏳ Pendientes de confirmar</h3>
              <div className="space-y-2">
                {pendingConvocations.map(conv => (
                  <div key={conv.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          {conv.event?.type === 'match' ? '🏑 Partido' : conv.event?.type === 'training' ? '🏋️ Entrenamiento' : '📋 Reunión'}
                          {conv.event?.type === 'match' && conv.event?.opponent && ` vs ${conv.event.opponent}`}
                        </p>
                        <p className="text-sm text-gray-600">{formatDate(conv.event?.start_datetime || '')}</p>
                        {conv.event?.location && <p className="text-sm text-gray-500">📍 {conv.event.location}</p>}
                        {conv.teamName && <p className="text-sm text-gray-500">👥 {conv.teamName}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(conv.id, 'accepted')}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                        >
                          ✓ Confirmar
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(conv.id, 'declined')}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                        >
                          ✕ No puedo
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {acceptedConvocations.length > 0 && (
            <div>
              <h3 className="font-semibold text-green-700 mb-2">✅ Disponibles</h3>
              <div className="space-y-2">
                {acceptedConvocations.map(conv => (
                  <div key={conv.id} className={`border rounded-lg p-4 ${(conv as any).isConvoked ? 'bg-blue-50 border-blue-300' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          {conv.event?.type === 'match' ? '🏑 Partido' : conv.event?.type === 'training' ? '🏋️ Entrenamiento' : '📋 Reunión'}
                          {conv.event?.type === 'match' && conv.event?.opponent && ` vs ${conv.event.opponent}`}
                        </p>
                        <p className="text-sm text-gray-600">{formatDate(conv.event?.start_datetime || '')}</p>
                        {conv.event?.location && <p className="text-sm text-gray-500">📍 {conv.event.location}</p>}
                        {conv.teamName && <p className="text-sm text-gray-500">👥 {conv.teamName}</p>}
                        {(conv as any).isConvoked && (
                          <span className="inline-block mt-1 bg-blue-600 text-white text-xs px-2 py-1 rounded font-medium">
                            🎯 CONVOCADA
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleUpdateStatus(conv.id, 'pending')}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {declinedConvocations.length > 0 && (
            <div>
              <h3 className="font-semibold text-red-700 mb-2">❌ No puedes asistir</h3>
              <div className="space-y-2">
                {declinedConvocations.map(conv => (
                  <div key={conv.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          {conv.event?.type === 'match' ? '🏑 Partido' : conv.event?.type === 'training' ? '🏋️ Entrenamiento' : '📋 Reunión'}
                          {conv.event?.type === 'match' && conv.event?.opponent && ` vs ${conv.event.opponent}`}
                        </p>
                        <p className="text-sm text-gray-600">{formatDate(conv.event?.start_datetime || '')}</p>
                        {conv.teamName && <p className="text-sm text-gray-500">👥 {conv.teamName}</p>}
                      </div>
                      <button
                        onClick={() => handleUpdateStatus(conv.id, 'accepted')}
                        className="text-sm text-green-600 hover:text-green-800"
                      >
                        Cambiar a sí puedo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyConvocations;
