import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { hockeyApi } from '../../lib/supabaseHockey';
import { eventsApi, clubsApi, convocationApi } from '../../lib/supabaseTeams';
import { HockeyMatch } from '../../types/hockey';
import { Team, Club } from '../../types/teams';
import BackButton from '../BackButton';

interface MatchWithDate extends HockeyMatch {
  eventDate?: string;
  team1Logo?: string;
  team2Logo?: string;
}

const hasRole = (roles: string, role: string): boolean => {
  return roles.split(',').includes(role);
};

const MatchList: React.FC = () => {
  const navigate = useNavigate();
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRoles = user.role || '';
  const isAdmin = hasRole(userRoles, 'admin');
  
  const [matches, setMatches] = useState<MatchWithDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [editingMatch, setEditingMatch] = useState<MatchWithDate | null>(null);
  const [editForm, setEditForm] = useState({
    quarter_duration: 15,
    sponsor_logo_url: '',
    sponsor_name: '',
    sponsor_text: '',
    youtube_url: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const sponsorInputRef = useRef<HTMLInputElement>(null);

  const [convocationPreview, setConvocationPreview] = useState<{ name: string; dorsal?: string }[]>([]);
  const [showConvocationPreview, setShowConvocationPreview] = useState(false);
  const [loadingConvocation, setLoadingConvocation] = useState(false);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const data = await hockeyApi.getUserMatches();
      const clubsData = await clubsApi.getClubs();
      const clubsMap: Record<string, string> = {};
      clubsData.forEach(c => {
        if (c.logo_url) clubsMap[c.name.toLowerCase()] = c.logo_url;
      });
      
      const matchesWithDates: MatchWithDate[] = await Promise.all(
        data.map(async (match) => {
          let team1Logo = match.team1_logo_url;
          let team2Logo = match.team2_logo_url;
          let eventDate = match.created_at;
          
          if (match.event_id) {
            const event = await eventsApi.getEvent(match.event_id);
            if (event) {
              eventDate = event.start_datetime;
              if (event.team?.club?.logo_url && !team1Logo) {
                team1Logo = event.team.club.logo_url;
              }
              if (!team2Logo && clubsMap[match.team2_name.toLowerCase()]) {
                team2Logo = clubsMap[match.team2_name.toLowerCase()];
              }
            }
          } else {
            if (!team1Logo && clubsMap[match.team1_name.toLowerCase()]) {
              team1Logo = clubsMap[match.team1_name.toLowerCase()];
            }
            if (!team2Logo && clubsMap[match.team2_name.toLowerCase()]) {
              team2Logo = clubsMap[match.team2_name.toLowerCase()];
            }
          }
          
          return { ...match, eventDate, team1Logo, team2Logo };
        })
      );
      
      setMatches(matchesWithDates);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMatch = async () => {
    if (!joinCode.trim()) return;
    
    const match = await hockeyApi.getMatchByToken(joinCode.trim());
    if (match) {
      navigate(`/match/${match.id}`);
    } else {
      alert('Partido no encontrado. Verifica el código.');
    }
    setShowJoinModal(false);
    setJoinCode('');
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

  const handleShareAndOpen = (token: string) => {
    const url = `${window.location.origin}/match/${token}/watch`;
    navigator.clipboard.writeText(url).then(() => {
      setSuccessMessage('Enlace copiado');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    });
    window.open(url, '_blank');
  };

  const openEditModal = (match: MatchWithDate) => {
    setEditingMatch(match);
    setEditForm({
      quarter_duration: Math.floor((match.quarter_duration || 900) / 60),
      sponsor_logo_url: match.sponsor_logo_url || '',
      sponsor_name: match.sponsor_name || '',
      sponsor_text: match.sponsor_text || '',
      youtube_url: match.youtube_url || '',
    });
    setConvocationPreview([]);
    setShowConvocationPreview(false);
  };

  const loadConvocationPreview = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match?.event_id) return;
    
    setLoadingConvocation(true);
    try {
      const event = await eventsApi.getEvent(match.event_id);
      const convocations = await convocationApi.getConvocation(match.event_id);
      
      // Obtener la lista de IDs de la convocatoria final
      const finalConvIds = event?.final_convocation 
        ? JSON.parse(event.final_convocation) 
        : [];
      
      let playersToShow;
      
      if (finalConvIds.length > 0) {
        playersToShow = convocations.filter(c => finalConvIds.includes(c.player_id));
      } else {
        playersToShow = convocations;
      }
      
      const calledPlayers = playersToShow
        .map(c => ({
          name: c.player?.full_name || 'Jugador',
          dorsal: c.player?.dorsal?.toString(),
        }));
      
      setConvocationPreview(calledPlayers);
      setShowConvocationPreview(true);
    } catch (error) {
      console.error('Error loading convocation:', error);
    } finally {
      setLoadingConvocation(false);
    }
  };

  const handleSponsorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEditForm(prev => ({ ...prev, sponsor_logo_url: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async () => {
    if (!editingMatch) return;
    
      setEditLoading(true);
    try {
      await hockeyApi.updateMatchFull(editingMatch.id, {
        quarter_duration: editForm.quarter_duration * 60,
        sponsor_logo_url: editForm.sponsor_logo_url || undefined,
        sponsor_name: editForm.sponsor_name || undefined,
        sponsor_text: editForm.sponsor_text || undefined,
        youtube_url: editForm.youtube_url || undefined,
      }, []);
      
      setEditingMatch(null);
      setSuccessMessage('Partido actualizado');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
      
      loadMatches();
    } catch (error) {
      console.error('Error updating match:', error);
      alert('Error al actualizar el partido');
    } finally {
      setEditLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const upcomingMatches = matches
    .filter(m => m.status !== 'finished')
    .sort((a, b) => {
      const dateA = new Date(a.eventDate || a.created_at).getTime();
      const dateB = new Date(b.eventDate || b.created_at).getTime();
      return dateA - dateB;
    });

  const finishedMatches = matches
    .filter(m => m.status === 'finished')
    .sort((a, b) => {
      const dateA = new Date(a.eventDate || a.created_at).getTime();
      const dateB = new Date(b.eventDate || b.created_at).getTime();
      return dateB - dateA;
    });

  const TeamLogo = ({ logoUrl, teamName, color }: { logoUrl?: string; teamName: string; color: string }) => {
    if (logoUrl) {
      return (
        <div 
          className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: color + '20' }}
        >
          <img src={logoUrl} alt={teamName} className="w-10 h-10 object-contain" />
        </div>
      );
    }
    return (
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
        style={{ backgroundColor: color }}
      >
        {teamName.substring(0, 2).toUpperCase()}
      </div>
    );
  };

  const getTeamLogo = (match: MatchWithDate, team: 'team1' | 'team2') => {
    const logoUrl = team === 'team1' ? match.team1Logo : match.team2Logo;
    return logoUrl || (team === 'team1' ? match.team1_logo_url : match.team2_logo_url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Cargando partidos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <BackButton />
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-sanse-blue">🏑 Partidos</h1>
          </div>
        </div>

        {/* Próximos Partidos */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">📅 Próximos Partidos</h2>

          {upcomingMatches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg mb-2">No hay partidos próximos</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMatches.map((match) => (
                <div
                  key={match.id}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <TeamLogo logoUrl={getTeamLogo(match, 'team1')} teamName={match.team1_name} color={match.team1_color} />
                          <span
                            className="px-3 py-1 rounded-full text-sm font-bold"
                            style={{ backgroundColor: match.team1_color + '20', color: match.team1_color }}
                          >
                            {match.team1_name}
                          </span>
                          <span className="text-gray-800 font-bold text-xl">vs</span>
                          <span
                            className="px-3 py-1 rounded-full text-sm font-bold"
                            style={{ backgroundColor: match.team2_color + '20', color: match.team2_color }}
                          >
                            {match.team2_name}
                          </span>
                          <TeamLogo logoUrl={getTeamLogo(match, 'team2')} teamName={match.team2_name} color={match.team2_color} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{getStatusBadge(match.status)}</span>
                          <span className="font-bold text-sanse-blue">
                            {match.score_team1} - {match.score_team2}
                          </span>
                          <span>Cuarto: {match.quarter}/4</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatDate(match.eventDate || match.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => navigate(`/match/${match.id}`)}
                            className="bg-sanse-blue text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm"
                          >
                            ⚙️ Admin
                          </button>
                          <button
                            onClick={() => openEditModal(match)}
                            className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 text-sm"
                          >
                            ✏️ Editar
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleShareAndOpen(match.share_token)}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm"
                      >
                        👁️ Ver
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Partidos Finalizados */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">📋 Partidos Finalizados</h2>

          {finishedMatches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg mb-2">No hay partidos finalizados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {finishedMatches.map((match) => (
                <div
                  key={match.id}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <TeamLogo logoUrl={getTeamLogo(match, 'team1')} teamName={match.team1_name} color={match.team1_color} />
                          <span
                            className="px-3 py-1 rounded-full text-sm font-bold"
                            style={{ backgroundColor: match.team1_color + '20', color: match.team1_color }}
                          >
                            {match.team1_name}
                          </span>
                          <span className="text-gray-800 font-bold text-xl">vs</span>
                          <span
                            className="px-3 py-1 rounded-full text-sm font-bold"
                            style={{ backgroundColor: match.team2_color + '20', color: match.team2_color }}
                          >
                            {match.team2_name}
                          </span>
                          <TeamLogo logoUrl={getTeamLogo(match, 'team2')} teamName={match.team2_name} color={match.team2_color} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{getStatusBadge(match.status)}</span>
                          <span className="font-bold text-sanse-blue">
                            {match.score_team1} - {match.score_team2}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatDate(match.eventDate || match.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => navigate(`/match/${match.id}`)}
                            className="bg-sanse-blue text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm"
                          >
                            ⚙️ Admin
                          </button>
                          <button
                            onClick={() => openEditModal(match)}
                            className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 text-sm"
                          >
                            ✏️ Editar
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleShareAndOpen(match.share_token)}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm"
                      >
                        👁️ Ver
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Unirse a Partido</h3>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Ingresa el código o token del partido"
                className="w-full p-3 rounded-lg border border-gray-300 mb-4"
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
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edición */}
        {editingMatch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 mb-4">✏️ Editar Partido</h3>

              {/* Datos del partido (solo lectura) */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getTeamLogo(editingMatch, 'team1') ? (
                      <img 
                        src={getTeamLogo(editingMatch, 'team1')} 
                        alt={editingMatch.team1_name} 
                        className="w-8 h-8 rounded-full object-contain" 
                      />
                    ) : (
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: editingMatch.team1_color }}
                      >
                        {editingMatch.team1_name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span 
                      className="px-2 py-1 rounded text-sm font-bold"
                      style={{ backgroundColor: editingMatch.team1_color + '20', color: editingMatch.team1_color }}
                    >
                      {editingMatch.team1_name}
                    </span>
                  </div>
                  <span className="text-gray-400 font-bold">vs</span>
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-2 py-1 rounded text-sm font-bold"
                      style={{ backgroundColor: editingMatch.team2_color + '20', color: editingMatch.team2_color }}
                    >
                      {editingMatch.team2_name}
                    </span>
                    {getTeamLogo(editingMatch, 'team2') ? (
                      <img 
                        src={getTeamLogo(editingMatch, 'team2')} 
                        alt={editingMatch.team2_name} 
                        className="w-8 h-8 rounded-full object-contain" 
                      />
                    ) : (
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: editingMatch.team2_color }}
                      >
                        {editingMatch.team2_name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  {editingMatch.location && (
                    <div className="flex items-center gap-1">
                      <span>📍</span>
                      <span>{editingMatch.location}</span>
                    </div>
                  )}
                  {editingMatch.eventDate && (
                    <div className="flex items-center gap-1">
                      <span>📅</span>
                      <span>{formatDate(editingMatch.eventDate)}</span>
                    </div>
                  )}
                </div>
              </div>

              {editingMatch.event_id && (
                <div className="mb-4">
                  <button
                    onClick={() => loadConvocationPreview(editingMatch.id)}
                    disabled={loadingConvocation}
                    className="w-full bg-blue-100 text-blue-700 py-2 px-4 rounded-lg hover:bg-blue-200 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loadingConvocation ? (
                      'Cargando...'
                    ) : (
                      <>
                        🔄 Sincronizar convocatoria
                      </>
                    )}
                  </button>
                  
                  {showConvocationPreview && convocationPreview.length > 0 && (
                    <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-sm font-medium text-blue-800 mb-2">
                        Jugadoras convocadas ({convocationPreview.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {convocationPreview.map((player, idx) => (
                          <span key={idx} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                            {player.name} {player.dorsal && `#${player.dorsal}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {showConvocationPreview && convocationPreview.length === 0 && (
                    <div className="mt-3 bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                      <p className="text-sm text-yellow-700">
                        No hay jugadoras convocadas con estado "accepted"
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duración por cuarto (minutos)
                  </label>
                  <input
                    type="number"
                    value={editForm.quarter_duration}
                    onChange={(e) => setEditForm(prev => ({ ...prev, quarter_duration: parseInt(e.target.value) || 15 }))}
                    className="w-full p-3 rounded-lg border border-gray-300"
                    min="5"
                    max="30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL de YouTube
                  </label>
                  <input
                    type="text"
                    value={editForm.youtube_url}
                    onChange={(e) => setEditForm(prev => ({ ...prev, youtube_url: e.target.value }))}
                    className="w-full p-3 rounded-lg border border-gray-300"
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-800 mb-3">Sponsor del Partido</h4>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Logo del Sponsor
                    </label>
                    <div className="flex items-center gap-3">
                      {editForm.sponsor_logo_url && (
                        <img src={editForm.sponsor_logo_url} alt="Sponsor" className="w-12 h-12 rounded object-contain" />
                      )}
                      <button
                        onClick={() => sponsorInputRef.current?.click()}
                        className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                      >
                        {editForm.sponsor_logo_url ? 'Cambiar Logo' : 'Subir Logo'}
                      </button>
                      <input
                        ref={sponsorInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleSponsorUpload}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Sponsor
                    </label>
                    <input
                      type="text"
                      value={editForm.sponsor_name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, sponsor_name: e.target.value }))}
                      className="w-full p-3 rounded-lg border border-gray-300"
                      placeholder="Nombre del sponsor"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Texto del Sponsor
                    </label>
                    <input
                      type="text"
                      value={editForm.sponsor_text}
                      onChange={(e) => setEditForm(prev => ({ ...prev, sponsor_text: e.target.value }))}
                      className="w-full p-3 rounded-lg border border-gray-300"
                      placeholder="ej: 'Parada patrocinada por...'"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingMatch(null)}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editLoading}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {editLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Éxito */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-sm w-full text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-lg font-medium text-gray-800">{successMessage}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchList;
