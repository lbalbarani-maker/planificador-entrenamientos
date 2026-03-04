import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hockeyApi } from '../../lib/supabaseHockey';
import { teamsApi, fieldsApi, opponentTeamsApi } from '../../lib/supabaseTeams';
import { Team, TeamPlayer, Field, OpponentTeam } from '../../types/teams';
import { HockeyPlayer } from '../../types/hockey';

interface PlayerData {
  id: string;
  name: string;
  number: string;
  position: string;
  selected: boolean;
  is_goalkeeper: boolean;
}

const KITS = [
  { name: 'Rojo-Rojo-Rojo', shirt: '#D32F2F', shorts: '#D32F2F', socks: '#D32F2F' },
  { name: 'Azul-Azul-Azul', shirt: '#1976D2', shorts: '#1976D2', socks: '#1976D2' },
  { name: 'Blanco-Blanco-Blanco', shirt: '#FFFFFF', shorts: '#FFFFFF', socks: '#FFFFFF' },
  { name: 'Verde-Verde-Verde', shirt: '#388E3C', shorts: '#388E3C', socks: '#388E3C' },
  { name: 'Negro-Negro-Negro', shirt: '#212121', shorts: '#212121', socks: '#212121' },
  { name: 'Rojo-Azul-Rojo', shirt: '#D32F2F', shorts: '#1976D2', socks: '#D32F2F' },
  { name: 'Azul-Blanco-Azul', shirt: '#1976D2', shorts: '#FFFFFF', socks: '#1976D2' },
  { name: 'Rojo-Blanco-Rojo', shirt: '#D32F2F', shorts: '#FFFFFF', socks: '#D32F2F' },
];

const MatchSetup: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Equipos del club
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Record<string, TeamPlayer[]>>({});
  
  const [adminPin, setAdminPin] = useState('');
  const [quarterDuration, setQuarterDuration] = useState(15);
  
  // Campos y rivales
  const [fields, setFields] = useState<Field[]>([]);
  const [opponents, setOpponents] = useState<OpponentTeam[]>([]);
  
  // Selección de equipo local
  const [localTeam, setLocalTeam] = useState<string>('');
  
  const [team1, setTeam1] = useState({
    name: 'Sanse Complutense',
    color: '#D32F2F',
    logo: '',
    players: [] as PlayerData[]
  });

  // Equipo rival
  const [selectedOpponent, setSelectedOpponent] = useState<string>('');
  const [team2, setTeam2] = useState({
    name: 'Equipo Visitante',
    color: '#1976D2',
    logo: '',
    players: [] as PlayerData[]
  });

  // Ubicación
  const [selectedField, setSelectedField] = useState<string>('');
  const [location, setLocation] = useState('');
  const [locationLink, setLocationLink] = useState('');

  const [sponsor, setSponsor] = useState({
    logo: '',
    name: '',
    text: ''
  });

  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Kit de equipación
  const [team1Kit, setTeam1Kit] = useState(KITS[0]);
  const [team2Kit, setTeam2Kit] = useState(KITS[1]);

  // Formulario rápido para añadir jugador manual
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState<'Jugadora' | 'Portera'>('Jugadora');
  const [editingTeam, setEditingTeam] = useState<'team1' | 'team2' | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<PlayerData | null>(null);

  const fileInput1 = useRef<HTMLInputElement>(null);
  const fileInput2 = useRef<HTMLInputElement>(null);
  const sponsorInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (localTeam) {
      loadTeamPlayers(localTeam);
    }
  }, [localTeam]);

  const loadAll = async () => {
    const [teamsData, fieldsData, opponentsData] = await Promise.all([
      teamsApi.getTeams(),
      fieldsApi.getFields(),
      opponentTeamsApi.getOpponentTeams()
    ]);
    setTeams(teamsData);
    setFields(fieldsData);
    setOpponents(opponentsData);
    if (teamsData.length > 0) {
      setLocalTeam(teamsData[0].id);
    }
  };

  const loadTeamPlayers = async (teamId: string) => {
    try {
      const playersData = await teamsApi.getTeamPlayers(teamId);
      setTeamPlayers(prev => ({ ...prev, [teamId]: playersData }));
      
      const formattedPlayers: PlayerData[] = playersData.map(tp => ({
        id: tp.player_id,
        name: tp.player?.full_name || 'Sin nombre',
        number: tp.shirt_number?.toString() || '',
        position: tp.position || 'Jugadora',
        selected: true,
        is_goalkeeper: tp.position === 'Portera'
      }));
      
      setTeam1(prev => ({ ...prev, players: formattedPlayers }));
    } catch (error) {
      console.error('Error loading team players:', error);
    }
  };

  const handleTeamChange = (teamId: string, isLocal: boolean) => {
    if (isLocal) {
      setLocalTeam(teamId);
      const selectedTeam = teams.find(t => t.id === teamId);
      if (selectedTeam) {
        setTeam1(prev => ({ ...prev, name: selectedTeam.name }));
        if (teamPlayers[teamId]) {
          const formattedPlayers: PlayerData[] = teamPlayers[teamId].map(tp => ({
            id: tp.player_id,
            name: tp.player?.full_name || 'Sin nombre',
            number: tp.shirt_number?.toString() || '',
            position: tp.position || 'Jugadora',
            selected: true,
            is_goalkeeper: tp.position === 'Portera'
          }));
          setTeam1(prev => ({ ...prev, players: formattedPlayers }));
        }
      }
    }
  };

  const handleOpponentChange = (opponentId: string) => {
    setSelectedOpponent(opponentId);
    const opponent = opponents.find(o => o.id === opponentId);
    if (opponent) {
      setTeam2({
        name: opponent.name,
        color: opponent.primary_color || '#1976D2',
        logo: opponent.logo_url || '',
        players: []
      });
    } else {
      setTeam2({ name: 'Equipo Visitante', color: '#1976D2', logo: '', players: [] });
    }
  };

  const handleFieldChange = (fieldId: string) => {
    setSelectedField(fieldId);
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      setLocation(field.name);
      setLocationLink(field.google_maps_url || '');
    }
  };

  const handleLogoUpload = (team: 'team1' | 'team2', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      if (team === 'team1') setTeam1(prev => ({ ...prev, logo: data }));
      else setTeam2(prev => ({ ...prev, logo: data }));
    };
    reader.readAsDataURL(file);
  };

  const handleSponsorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSponsor(prev => ({ ...prev, logo: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const togglePlayerSelection = (team: 'team1' | 'team2', id: string) => {
    if (team === 'team1') {
      setTeam1(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
      }));
    } else {
      setTeam2(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
      }));
    }
  };

  const addPlayer = (team: 'team1' | 'team2') => {
    if (!newPlayerName.trim()) return;
    const player: PlayerData = {
      id: Date.now().toString(),
      name: newPlayerName.trim(),
      number: newPlayerNumber.trim(),
      position: newPlayerPosition,
      selected: true,
      is_goalkeeper: newPlayerPosition === 'Portera'
    };
    if (team === 'team1') {
      setTeam1(prev => ({ ...prev, players: [...prev.players, player] }));
    } else {
      setTeam2(prev => ({ ...prev, players: [...prev.players, player] }));
    }
    setNewPlayerName('');
    setNewPlayerNumber('');
  };

  const saveEditing = () => {
    if (!editingPlayer) return;
    if (editingTeam === 'team1') {
      setTeam1(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === editingPlayer.id ? editingPlayer : p)
      }));
    } else if (editingTeam === 'team2') {
      setTeam2(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === editingPlayer.id ? editingPlayer : p)
      }));
    }
    setEditingPlayer(null);
    setEditingTeam(null);
  };

  const deletePlayer = (team: 'team1' | 'team2', id: string) => {
    if (team === 'team1') {
      setTeam1(prev => ({ ...prev, players: prev.players.filter(p => p.id !== id) }));
    } else {
      setTeam2(prev => ({ ...prev, players: prev.players.filter(p => p.id !== id) }));
    }
  };

  const handleSave = async () => {
    if (!adminPin.trim()) {
      alert('Introduce un PIN de administrador');
      return;
    }

    if (!team1.name.trim() || !team2.name.trim()) {
      alert('Introduce el nombre de ambos equipos');
      return;
    }

    setLoading(true);

    try {
      const match = await hockeyApi.createMatch({
        team1_name: team1.name,
        team1_color: team1.color,
        team1_logo_url: team1.logo || undefined,
        team2_name: team2.name,
        team2_color: team2.color,
        team2_logo_url: team2.logo || undefined,
        quarter_duration: quarterDuration * 60,
        sponsor_logo_url: sponsor.logo || undefined,
        sponsor_name: sponsor.name || undefined,
        sponsor_text: sponsor.text || undefined,
        youtube_url: youtubeUrl || undefined,
        admin_pin: adminPin,
      });

      const playersToSave: HockeyPlayer[] = [];
      
      team1.players.filter(p => p.selected).forEach(p => {
        playersToSave.push({
          id: '',
          match_id: match.id,
          team: 'team1',
          player_name: p.name,
          dorsal: p.number,
          position: p.position,
          is_goalkeeper: p.is_goalkeeper,
        });
      });

      team2.players.filter(p => p.selected).forEach(p => {
        playersToSave.push({
          id: '',
          match_id: match.id,
          team: 'team2',
          player_name: p.name,
          dorsal: p.number,
          position: p.position,
          is_goalkeeper: p.is_goalkeeper,
        });
      });

      await hockeyApi.setMatchPlayers(match.id, playersToSave);

      navigate(`/hockey/${match.id}`);
    } catch (error) {
      console.error('Error creating match:', error);
      alert('Error al crear el partido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">🏑 Configurar Partido</h1>
            <p className="text-gray-300">Define equipos, jugadores y configuración</p>
          </div>
          <button
            onClick={() => navigate('/hockey')}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            ← Volver
          </button>
        </div>

        {/* Selección de equipos y ubicación */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h3 className="text-xl font-bold text-white mb-4">📋 Configuración del Partido</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Equipo Local */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">🏠 Equipo Local</label>
              <select
                value={localTeam}
                onChange={(e) => handleTeamChange(e.target.value, true)}
                className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
              >
                <option value="">Seleccionar...</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            {/* Equipo Visitante */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">✈️ Rival</label>
              <select
                value={selectedOpponent}
                onChange={(e) => handleOpponentChange(e.target.value)}
                className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
              >
                <option value="">Seleccionar...</option>
                {opponents.map(opp => (
                  <option key={opp.id} value={opp.id}>{opp.name}</option>
                ))}
              </select>
            </div>

            {/* Campo/Ubicación */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">📍 Campo</label>
              <select
                value={selectedField}
                onChange={(e) => handleFieldChange(e.target.value)}
                className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
              >
                <option value="">Seleccionar...</option>
                {fields.map(field => (
                  <option key={field.id} value={field.id}>{field.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equipo 1 */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">🏠 {team1.name}</h3>
            
            {/* Selector de kit */}
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">Equipación</label>
              <div className="flex flex-wrap gap-2">
                {KITS.map((kit, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTeam1Kit(kit)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
                      team1Kit.name === kit.name ? 'border-white scale-105' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: kit.shirt + '40' }}
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: kit.shirt }}></div>
                        <div className="w-4 h-4 rounded -ml-1" style={{ backgroundColor: kit.shorts }}></div>
                        <div className="w-4 h-4 rounded -ml-1" style={{ backgroundColor: kit.socks }}></div>
                      </div>
                      <span className="text-xs text-white mt-1">{kit.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <input
              type="text"
              value={team1.name}
              onChange={(e) => setTeam1(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-3 rounded bg-white/10 text-white border border-white/20 mb-3"
              placeholder="Nombre del equipo"
            />

            <div className="mb-3">
              <h4 className="text-sm text-gray-200 mb-2">Jugadoras ({team1.players.filter(p => p.selected).length})</h4>
              <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                {team1.players.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-2 bg-white/5 rounded">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.selected}
                        onChange={() => togglePlayerSelection('team1', p.id)}
                        className="w-4 h-4"
                      />
                      <div className="text-sm text-white">
                        {p.name} <span className="text-gray-400">#{p.number || '-'}</span>
                        {p.is_goalkeeper && <span className="ml-1">🥅</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingPlayer(p); setEditingTeam('team1'); }}
                        className="text-xs text-blue-300"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deletePlayer('team1', p.id)}
                        className="text-xs text-red-400"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border border-white/10 rounded">
                <div className="flex gap-2 mb-2">
                  <input
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Nombre"
                    className="flex-1 p-2 rounded bg-white/5 text-white text-sm"
                  />
                  <input
                    value={newPlayerNumber}
                    onChange={(e) => setNewPlayerNumber(e.target.value)}
                    placeholder="Dorsal"
                    className="w-16 p-2 rounded bg-white/5 text-white text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={newPlayerPosition}
                    onChange={(e) => setNewPlayerPosition(e.target.value as 'Jugadora' | 'Portera')}
                    className="p-2 rounded bg-white/5 text-white text-sm"
                  >
                    <option value="Jugadora">Jugadora</option>
                    <option value="Portera">Portera</option>
                  </select>
                  <button
                    onClick={() => addPlayer('team1')}
                    className="ml-auto bg-green-600 px-3 py-2 rounded text-white text-sm"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Equipo 2 */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">✈️ {team2.name}</h3>
            
            {/* Selector de kit */}
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">Equipación</label>
              <div className="flex flex-wrap gap-2">
                {KITS.map((kit, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTeam2Kit(kit)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
                      team2Kit.name === kit.name ? 'border-white scale-105' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: kit.shirt + '40' }}
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: kit.shirt }}></div>
                        <div className="w-4 h-4 rounded -ml-1" style={{ backgroundColor: kit.shorts }}></div>
                        <div className="w-4 h-4 rounded -ml-1" style={{ backgroundColor: kit.socks }}></div>
                      </div>
                      <span className="text-xs text-white mt-1">{kit.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <input
              type="text"
              value={team2.name}
              onChange={(e) => setTeam2(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-3 rounded bg-white/10 text-white border border-white/20 mb-3"
              placeholder="Nombre del equipo"
            />

            <div className="mb-3">
              <h4 className="text-sm text-gray-200 mb-2">Jugadoras ({team2.players.filter(p => p.selected).length})</h4>
              <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                {team2.players.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-2 bg-white/5 rounded">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.selected}
                        onChange={() => togglePlayerSelection('team2', p.id)}
                        className="w-4 h-4"
                      />
                      <div className="text-sm text-white">
                        {p.name} <span className="text-gray-400">#{p.number || '-'}</span>
                        {p.is_goalkeeper && <span className="ml-1">🥅</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingPlayer(p); setEditingTeam('team2'); }}
                        className="text-xs text-blue-300"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deletePlayer('team2', p.id)}
                        className="text-xs text-red-400"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                {team2.players.length === 0 && (
                  <div className="text-gray-400 text-sm text-center py-4">
                    Selecciona un equipo del sistema o añade jugadores manualmente
                  </div>
                )}
              </div>

              <div className="p-3 border border-white/10 rounded">
                <div className="flex gap-2 mb-2">
                  <input
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Nombre"
                    className="flex-1 p-2 rounded bg-white/5 text-white text-sm"
                  />
                  <input
                    value={newPlayerNumber}
                    onChange={(e) => setNewPlayerNumber(e.target.value)}
                    placeholder="Dorsal"
                    className="w-16 p-2 rounded bg-white/5 text-white text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={newPlayerPosition}
                    onChange={(e) => setNewPlayerPosition(e.target.value as 'Jugadora' | 'Portera')}
                    className="p-2 rounded bg-white/5 text-white text-sm"
                  >
                    <option value="Jugadora">Jugadora</option>
                    <option value="Portera">Portera</option>
                  </select>
                  <button
                    onClick={() => addPlayer('team2')}
                    className="ml-auto bg-blue-600 px-3 py-2 rounded text-white text-sm"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Configuración adicional */}
        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4">⚙️ Configuración</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">PIN de Administrador</label>
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
                placeholder="1234"
              />
              <p className="text-xs text-gray-400 mt-1">PIN para acceder al panel de admin</p>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Duración por cuarto (minutos)</label>
              <input
                type="number"
                value={quarterDuration}
                onChange={(e) => setQuarterDuration(parseInt(e.target.value) || 15)}
                className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
                min="5"
                max="30"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">URL de YouTube (opcional)</label>
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Sponsor del partido</label>
              <div className="flex gap-2">
                <button
                  onClick={() => sponsorInput.current?.click()}
                  className="px-4 py-2 bg-white/10 rounded text-white border border-white/20"
                >
                  {sponsor.logo ? '✓ Logo cargado' : 'Subir Logo'}
                </button>
                <input
                  ref={sponsorInput}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleSponsorUpload}
                />
                <input
                  type="text"
                  value={sponsor.name}
                  onChange={(e) => setSponsor(prev => ({ ...prev, name: e.target.value }))}
                  className="flex-1 p-2 rounded bg-white/10 text-white border border-white/20"
                  placeholder="Nombre del sponsor"
                />
              </div>
              <input
                type="text"
                value={sponsor.text}
                onChange={(e) => setSponsor(prev => ({ ...prev, text: e.target.value }))}
                className="w-full p-2 mt-2 rounded bg-white/10 text-white border border-white/20"
                placeholder="Texto del sponsor (ej: 'Parada patrocinada por...')"
              />
            </div>
          </div>
        </div>

        {/* Botón guardar */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-green-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Creando...' : '🏁 Iniciar Partido'}
          </button>
        </div>

        {/* Modal editar jugador */}
        {editingPlayer && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#071025] p-6 rounded-2xl w-full max-w-md border border-white/10">
              <h4 className="text-white font-bold text-xl mb-4">Editar Jugadora</h4>
              <input
                value={editingPlayer.name}
                onChange={(e) => setEditingPlayer(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="w-full p-3 rounded bg-white/10 text-white mb-3"
                placeholder="Nombre"
              />
              <input
                value={editingPlayer.number}
                onChange={(e) => setEditingPlayer(prev => prev ? { ...prev, number: e.target.value } : null)}
                className="w-full p-3 rounded bg-white/10 text-white mb-3"
                placeholder="Dorsal"
              />
              <select
                value={editingPlayer.position}
                onChange={(e) => setEditingPlayer(prev => prev ? { ...prev, position: e.target.value, is_goalkeeper: e.target.value === 'Portera' } : null)}
                className="w-full p-3 rounded bg-white/10 text-white mb-4"
              >
                <option value="Jugadora">Jugadora</option>
                <option value="Portera">Portera</option>
              </select>
              <div className="flex gap-3">
                <button
                  onClick={() => { setEditingPlayer(null); setEditingTeam(null); }}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEditing}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchSetup;
