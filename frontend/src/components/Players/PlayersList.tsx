import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamsApi, trainingsApi } from '../../lib/supabaseTeams';
import { supabase } from '../../lib/supabase';
import { Team, Player, TeamPlayer, Training } from '../../types/teams';
import BackButton from '../BackButton';
// @ts-ignore
import * as XLSX from 'xlsx';

interface PlayerWithTeams extends Player {
  teams?: Team[];
  parent1_name?: string;
  parent1_phone?: string;
  parent1_email?: string;
  parent1_is_active?: boolean;
  parent2_name?: string;
  parent2_phone?: string;
  parent2_email?: string;
  parent2_is_active?: boolean;
}

interface Parent {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
}

const PlayersList: React.FC = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerWithTeams[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [viewingPlayer, setViewingPlayer] = useState<PlayerWithTeams | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<PlayerWithTeams | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    full_name: '',
    birth_date: '',
    dorsal: '',
    gender: 'otro',
    is_active: true,
    club_id: '',
    primary_team_id: '',
    parent1_name: '',
    parent1_phone: '',
    parent1_email: '',
    parent2_name: '',
    parent2_phone: '',
    parent2_email: ''
  });
  const [dorsalWarning, setDorsalWarning] = useState<{ exists: boolean; player?: any; type?: 'same' | 'different' } | null>(null);
  const [showDorsalModal, setShowDorsalModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [playersData, teamsData, teamPlayersData, parentsData, clubsData, profilesData] = await Promise.all([
        supabase.from('players').select('*').order('full_name', { ascending: true }),
        teamsApi.getTeams(),
        supabase.from('team_players').select('*'),
        supabase.from('parents').select('*'),
        supabase.from('clubs').select('*'),
        supabase.from('profiles').select('id, email, is_active')
      ]);

      const playersList = playersData.data || [];
      const teamsList = teamsData;
      const teamPlayersList = teamPlayersData.data || [];
      const parentsList = parentsData.data || [];
      const clubsList = clubsData.data || [];
      const profilesList = profilesData.data || [];
      setClubs(clubsList);

      const clubsMap: Record<string, any> = {};
      clubsList.forEach((c: any) => { clubsMap[c.id] = c; });

      const profilesMap: Record<string, any> = {};
      profilesList.forEach((p: any) => { profilesMap[p.email?.toLowerCase()] = p; });

      const playersWithTeams: PlayerWithTeams[] = playersList.map(player => {
        const playerTeamIds = teamPlayersList
          .filter(tp => tp.player_id === player.id)
          .map(tp => tp.team_id);
        
        let playerTeams = teamsList.filter(t => playerTeamIds.includes(t.id)).map(t => ({
          ...t,
          club: clubsMap[t.club_id] || null
        }));

        if (playerTeams.length === 0 && player.club_id && clubsMap[player.club_id]) {
          playerTeams = [{
            id: '',
            club_id: player.club_id,
            name: 'Sin equipo',
            created_at: '',
            club: clubsMap[player.club_id]
          }];
        }

        const playerParents = parentsList.filter(p => p.player_id === player.id);
        const parent1 = playerParents.find(p => p.parent_number === 1);
        const parent2 = playerParents.find(p => p.parent_number === 2);

        const parent1Profile = parent1?.email ? profilesMap[parent1.email.toLowerCase()] : null;
        const parent2Profile = parent2?.email ? profilesMap[parent2.email.toLowerCase()] : null;

        return {
          ...player,
          teams: playerTeams,
          parent1_name: parent1?.full_name || '',
          parent1_phone: parent1?.phone || '',
          parent1_email: parent1?.email || '',
          parent1_is_active: parent1Profile?.is_active || false,
          parent2_name: parent2?.full_name || '',
          parent2_phone: parent2?.phone || '',
          parent2_email: parent2?.email || '',
          parent2_is_active: parent2Profile?.is_active || false
        };
      });

      setPlayers(playersWithTeams);
      setTeams(teamsList);
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getDorsalInfo = (player: PlayerWithTeams): { status: 'unique' | 'same-team' | 'different-team'; conflicts: string[] } => {
    if (!player.dorsal) return { status: 'unique', conflicts: [] };
    
    const playerTeamIds = new Set(player.teams?.map(t => t.id) || []);
    
    const otherPlayersWithSameDorsal = players.filter(p => 
      p.id !== player.id && p.dorsal === player.dorsal
    );
    
    if (otherPlayersWithSameDorsal.length === 0) return { status: 'unique', conflicts: [] };
    
    const sameTeamConflicts: string[] = [];
    const differentTeamConflicts: string[] = [];
    
    otherPlayersWithSameDorsal.forEach(p => {
      const otherTeamIds = new Set(p.teams?.map(t => t.id) || []);
      const hasSharedTeam = Array.from(playerTeamIds).some(tid => otherTeamIds.has(tid));
      
      if (hasSharedTeam) {
        sameTeamConflicts.push(p.full_name);
      } else {
        differentTeamConflicts.push(p.full_name);
      }
    });
    
    if (sameTeamConflicts.length > 0) {
      return { status: 'same-team', conflicts: sameTeamConflicts };
    }
    return { status: 'different-team', conflicts: differentTeamConflicts };
  };

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = !filterTeam || player.teams?.some(t => t.id === filterTeam);
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && player.is_active !== false) ||
      (filterStatus === 'inactive' && player.is_active === false);
    return matchesSearch && matchesTeam && matchesStatus;
  });

  const handleExport = () => {
    const data = filteredPlayers.map(p => ({
      'Nombre': p.full_name,
      'Fecha Nacimiento': p.birth_date ? new Date(p.birth_date).toLocaleDateString('es-ES') : '',
      'Equipos': p.teams?.map(t => t.name).join(', ') || '',
      'Estado': p.is_active !== false ? 'Activo' : 'Inactivo'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jugadores');
    XLSX.writeFile(wb, `jugadores_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let jsonData: any[][] = [];
        
        const fileName = file.name.toLowerCase();
        
        if (fileName.endsWith('.csv')) {
          const text = event.target?.result as string;
          const lines = text.split('\n').map(line => line.split(','));
          jsonData = lines.filter(line => line.some(cell => cell.trim()));
        } else {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        }

        if (jsonData.length < 2) {
          alert('El archivo está vacío o no tiene datos');
          return;
        }

        const headers = (jsonData[0] as any[]).map(h => {
          if (h === null || h === undefined) return '';
          return String(h).trim().toLowerCase();
        });

        console.log('Headers found:', headers);
        
        const fieldMapping: Record<string, string> = {
          'nombre': 'full_name',
          'name': 'full_name',
          'club': 'club',
          'club_id': 'club',
          'género': 'gender',
          'genero': 'gender',
          'sexo': 'gender',
          'equipo': 'team',
          'team': 'team',
          'estado': 'status',
          'active': 'status',
          'activo': 'status',
          'fecha nacimiento': 'birth_date',
          'fechanacimiento': 'birth_date',
          'birth_date': 'birth_date',
          'dorsal': 'dorsal',
          'numero': 'dorsal',
          'shirt': 'dorsal',
          'nombre padre 1': 'parent1_name',
          'nombrepadre1': 'parent1_name',
          'padre 1': 'parent1_name',
          'padre1': 'parent1_name',
          'telefono padre 1': 'parent1_phone',
          'telefonopadre1': 'parent1_phone',
          'phone padre 1': 'parent1_phone',
          'email padre 1': 'parent1_email',
          'emailpadre1': 'parent1_email',
          'nombre padre 2': 'parent2_name',
          'nombrepadre2': 'parent2_name',
          'padre 2': 'parent2_name',
          'padre2': 'parent2_name',
          'telefono padre 2': 'parent2_phone',
          'telefonopadre2': 'parent2_phone',
          'phone padre 2': 'parent2_phone',
          'email padre 2': 'parent2_email',
          'emailpadre2': 'parent2_email'
        };

        const normalizeAccents = (str: string): string => {
          return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };

        const findHeaderIndex = (searchTerms: string[]): number => {
          return headers.findIndex(h => {
            if (!h) return false;
            const normalizedHeader = normalizeAccents(h);
            return searchTerms.some(term => normalizedHeader.includes(normalizeAccents(term)));
          });
        };

        const nameIdx = findHeaderIndex(['nombre', 'name', 'full_name']);
        const clubIdx = findHeaderIndex(['club']);
        const genderIdx = findHeaderIndex(['genero', 'género', 'sexo']);
        const teamIdx = findHeaderIndex(['equipo', 'team']);
        const statusIdx = findHeaderIndex(['estado', 'active', 'activo']);
        const birthDateIdx = findHeaderIndex(['fecha nacimiento', 'fechanacimiento', 'birth_date']);
        const dorsalIdx = findHeaderIndex(['dorsal', 'numero']);
        const parent1NameIdx = findHeaderIndex(['nombre padre 1', 'nombrepadre1', 'padre1']);
        const parent1PhoneIdx = findHeaderIndex(['telefono padre 1', 'telefonopadre1']);
        const parent1EmailIdx = findHeaderIndex(['email padre 1', 'emailpadre1']);
        const parent2NameIdx = findHeaderIndex(['nombre padre 2', 'nombrepadre2', 'padre2']);
        const parent2PhoneIdx = findHeaderIndex(['telefono padre 2', 'telefonopadre2']);
        const parent2EmailIdx = findHeaderIndex(['email padre 2', 'emailpadre2']);

        console.log('Field indices:', { nameIdx, clubIdx, genderIdx, teamIdx, statusIdx });

        if (nameIdx === -1) {
          alert(`El archivo debe tener una columna de nombre. Headers encontrados: ${headers.join(', ')}`);
          return;
        }

        const clubsMap: Record<string, any> = {};
        clubs.forEach((c: any) => {
          clubsMap[c.name?.toLowerCase()] = c;
          clubsMap[c.name?.toLowerCase().replace(/[\s_]/g, '')] = c;
        });

        const teamsMap: Record<string, any> = {};
        teams.forEach((t: any) => {
          const key = t.name?.toLowerCase();
          if (key) {
            if (!teamsMap[key]) teamsMap[key] = [];
            teamsMap[key].push(t);
          }
          const keyNoSpaces = key?.replace(/[\s_]/g, '');
          if (keyNoSpaces) {
            if (!teamsMap[keyNoSpaces]) teamsMap[keyNoSpaces] = [];
            teamsMap[keyNoSpaces].push(t);
          }
        });

        let importedCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          const getValue = (idx: number): string => {
            if (idx === -1 || idx >= row.length) return '';
            const val = row[idx];
            return val !== undefined && val !== null ? String(val).trim() : '';
          };

          const name = getValue(nameIdx).replace(/"/g, '');
          if (!name) continue;

          let clubId: string | null = user.club_id || null;
          const clubName = getValue(clubIdx);
          if (clubName && !clubId) {
            const normalizedClub = clubName.toLowerCase().replace(/[\s_]/g, '');
            clubId = clubsMap[normalizedClub]?.id || clubsMap[clubName.toLowerCase()]?.id || null;
          } else if (clubName && clubId) {
            const clubObj = clubs.find((c: any) => c.id === clubId);
            if (clubObj && clubObj.name?.toLowerCase() !== clubName.toLowerCase()) {
              const normalizedClub = clubName.toLowerCase().replace(/[\s_]/g, '');
              clubId = clubsMap[normalizedClub]?.id || clubsMap[clubName.toLowerCase()]?.id || clubId;
            }
          }

          const genderValue = getValue(genderIdx).toLowerCase();
          let gender = 'otro';
          if (genderValue.includes('masculino') || genderValue === 'm' || genderValue.includes('boy')) {
            gender = 'masculino';
          } else if (genderValue.includes('femenino') || genderValue === 'f' || genderValue.includes('girl')) {
            gender = 'femenino';
          }

          const statusValue = getValue(statusIdx).toLowerCase();
          const isActive = !statusValue || statusValue.includes('activo') || statusValue === 'active' || statusValue === 'true' || statusValue === 'si' || statusValue === 'yes';

          let birthDate: string | null = null;
          const birthDateStr = getValue(birthDateIdx);
          if (birthDateStr) {
            const dateMatch = birthDateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
            if (dateMatch) {
              let year = parseInt(dateMatch[3]);
              if (year < 100) year += 2000;
              birthDate = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
            } else if (birthDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              birthDate = birthDateStr;
            }
          }

          let dorsal: number | null = null;
          const dorsalStr = getValue(dorsalIdx);
          if (dorsalStr) {
            dorsal = parseInt(dorsalStr) || null;
          }

          const playerData = {
            full_name: name,
            club_id: clubId,
            gender,
            is_active: isActive,
            birth_date: birthDate,
            dorsal,
            is_minor: false,
            is_self_managed: true
          };

          const { data: newPlayer, error: playerError } = await supabase
            .from('players')
            .insert(playerData)
            .select()
            .single();

          if (playerError) {
            errorCount++;
            errors.push(`Fila ${i + 1}: ${playerError.message}`);
            console.error('Error inserting player:', playerError);
            continue;
          }

          const teamName = getValue(teamIdx);
          if (teamName) {
            const normalizedTeam = teamName.toLowerCase().replace(/[\s_]/g, '');
            const matchingTeams = teamsMap[normalizedTeam] || teamsMap[teamName.toLowerCase()] || [];
            
            let teamToAssign = matchingTeams.find((t: any) => t.club_id === clubId) || matchingTeams[0];
            
            if (!teamToAssign && matchingTeams.length > 0) {
              teamToAssign = matchingTeams[0];
            }

            if (teamToAssign) {
              await supabase.from('team_players').insert({
                team_id: teamToAssign.id,
                player_id: newPlayer.id,
                is_active: true,
                is_primary: true
              });
            }
          }

          const parent1Name = getValue(parent1NameIdx);
          if (parent1Name) {
            await supabase.from('parents').insert({
              player_id: newPlayer.id,
              parent_number: 1,
              full_name: parent1Name,
              phone: getValue(parent1PhoneIdx) || null,
              email: getValue(parent1EmailIdx) || null
            });
          }

          const parent2Name = getValue(parent2NameIdx);
          if (parent2Name) {
            await supabase.from('parents').insert({
              player_id: newPlayer.id,
              parent_number: 2,
              full_name: parent2Name,
              phone: getValue(parent2PhoneIdx) || null,
              email: getValue(parent2EmailIdx) || null
            });
          }

          importedCount++;
        }

        let message = `Se importaron ${importedCount} jugadores correctamente`;
        if (errorCount > 0) {
          message += `. ${errorCount} errores: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`;
        }
        setSuccessMessage(message);
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 4000);
        loadData();
      } catch (error) {
        console.error('Error importing:', error);
        setSuccessMessage('Error al importar jugadores. Verifica el formato del archivo.');
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 4000);
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEditPlayer = (player: PlayerWithTeams) => {
    setEditingPlayer(player);
    
    // Get primary team from team_players table
    const primaryTeamId = player.teams && player.teams.length > 0 ? player.teams[0]?.id : '';
    
    setFormData({
      full_name: player.full_name,
      birth_date: player.birth_date || '',
      dorsal: player.dorsal?.toString() || '',
      gender: player.gender || 'otro',
      is_active: player.is_active !== false,
      club_id: player.club_id || '',
      primary_team_id: primaryTeamId,
      parent1_name: player.parent1_name || '',
      parent1_phone: player.parent1_phone || '',
      parent1_email: player.parent1_email || '',
      parent2_name: player.parent2_name || '',
      parent2_phone: player.parent2_phone || '',
      parent2_email: player.parent2_email || ''
    });
    setSelectedTeams(player.teams?.map(t => t.id) || []);
    setDorsalWarning(null);
    setShowEditModal(true);
  };

  const handleSavePlayer = async () => {
    try {
      const birthDateValue = formData.birth_date && formData.birth_date.trim() !== '' ? formData.birth_date : null;
      const dorsalValue = formData.dorsal ? parseInt(formData.dorsal) : null;
      const primaryTeamId = formData.primary_team_id || selectedTeams[0] || null;
      let playerId = editingPlayer?.id;
      
      if (editingPlayer) {
        // Editar jugador existente
        const { error } = await supabase
          .from('players')
          .update({
            full_name: formData.full_name,
            birth_date: birthDateValue,
            dorsal: dorsalValue,
            gender: formData.gender,
            is_active: formData.is_active,
            club_id: formData.club_id || null
          })
          .eq('id', editingPlayer.id);
        
        if (error) throw error;
      } else {
        // Crear nuevo jugador
        const { data: newPlayer, error } = await supabase
          .from('players')
          .insert({
            full_name: formData.full_name,
            birth_date: birthDateValue,
            dorsal: dorsalValue,
            gender: formData.gender,
            is_active: formData.is_active,
            club_id: formData.club_id || null,
            is_minor: false,
            is_self_managed: true
          })
          .select()
          .single();
        
        if (error) throw error;
        playerId = newPlayer.id;
        
        // Asignar a equipos seleccionados
        for (const teamId of selectedTeams) {
          await supabase.from('team_players').insert({
            team_id: teamId,
            player_id: newPlayer.id,
            is_active: true,
            is_primary: teamId === primaryTeamId
          });
        }
      }

      // Guardar padres y equipos (para edición)
      if (editingPlayer) {
        const currentTeamPlayers = await supabase
          .from('team_players')
          .select('*')
          .eq('player_id', editingPlayer.id);

        const existingTeamIds = currentTeamPlayers.data?.map(tp => tp.team_id) || [];
        
        const teamsToAdd = selectedTeams.filter(tid => !existingTeamIds.includes(tid));
        const teamsToRemove = existingTeamIds.filter(tid => !selectedTeams.includes(tid));

        for (const teamId of teamsToRemove) {
          const tpToRemove = currentTeamPlayers.data?.find(tp => tp.team_id === teamId);
          if (tpToRemove) {
            await supabase.from('team_players').delete().eq('id', tpToRemove.id);
          }
        }

        for (const teamId of teamsToAdd) {
          await supabase.from('team_players').insert({
            team_id: teamId,
            player_id: editingPlayer.id,
            is_active: true,
            is_primary: teamId === primaryTeamId
          });
        }
        
        // Update primary flag for existing teams
        if (primaryTeamId) {
          for (const tp of currentTeamPlayers.data || []) {
            await supabase.from('team_players').update({ is_primary: tp.team_id === primaryTeamId }).eq('id', tp.id);
          }
        }

        const currentParents = await supabase
          .from('parents')
          .select('*')
          .eq('player_id', editingPlayer.id);

        if (currentParents.data) {
          for (const parent of currentParents.data) {
            await supabase.from('parents').delete().eq('id', parent.id);
          }
        }

        if (formData.parent1_name) {
          await supabase.from('parents').insert({
            player_id: editingPlayer.id,
            parent_number: 1,
            full_name: formData.parent1_name,
            phone: formData.parent1_phone || null,
            email: formData.parent1_email || null
          });
        }

        if (formData.parent2_name) {
          await supabase.from('parents').insert({
            player_id: editingPlayer.id,
            parent_number: 2,
            full_name: formData.parent2_name,
            phone: formData.parent2_phone || null,
            email: formData.parent2_email || null
          });
        }
      }

      await loadData();
      setShowEditModal(false);
      setEditingPlayer(null);
      setSuccessMessage(editingPlayer ? 'Jugador actualizado correctamente' : 'Jugador creado correctamente');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    } catch (error) {
      console.error('Error saving player:', error);
      setSuccessMessage('Error al guardar el jugador');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    }
  };

  const handleToggleActive = async (player: PlayerWithTeams) => {
    try {
      await supabase
        .from('players')
        .update({ is_active: !player.is_active })
        .eq('id', player.id);
      
      await loadData();
    } catch (error) {
      console.error('Error toggling player status:', error);
      alert('Error al cambiar el estado');
    }
  };

  const handleViewPlayer = (player: PlayerWithTeams) => {
    setViewingPlayer(player);
    setShowViewModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <BackButton />
          <div className="text-center py-8">Cargando jugadores...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <BackButton />
        
        <div className="flex justify-between items-center mb-6 mt-4">
          <div>
            <h1 className="text-3xl font-bold text-sanse-blue">Jugadores/as</h1>
          </div>
          <button
            onClick={() => {
              setEditingPlayer(null);
              const defaultClub = clubs.find(c => c.name?.toLowerCase().includes('sanse')) || clubs[0];
              setFormData({
                full_name: '',
                birth_date: '',
                dorsal: '',
                gender: 'otro',
                is_active: true,
                club_id: defaultClub?.id || clubs[0]?.id || '',
                primary_team_id: '',
                parent1_name: '',
                parent1_phone: '',
                parent1_email: '',
                parent2_name: '',
                parent2_phone: '',
                parent2_email: ''
              });
              setSelectedTeams([]);
              setDorsalWarning(null);
              setShowEditModal(true);
            }}
            className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            + Nuevo Jugador
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-3 border border-gray-300 rounded-lg"
            />
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="p-3 border border-gray-300 rounded-lg"
            >
              <option value="">Todos los equipos</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="p-3 border border-gray-300 rounded-lg"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,.xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-medium"
              >
                📥 Subir
              </button>
              <button
                onClick={handleExport}
                className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                📤 Exportar
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-500 mb-4">
            Mostrando {filteredPlayers.length} de {players.length} jugadores
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dorsal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPlayers.map(player => (
                  <tr key={player.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{player.full_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      {player.dorsal ? (() => {
                        const { status, conflicts } = getDorsalInfo(player);
                        const baseClasses = "inline-flex px-3 py-1 text-lg font-bold rounded-full cursor-help";
                        
                        if (status === 'same-team') {
                          return (
                            <div className="relative group">
                              <span className={`${baseClasses} bg-red-600 text-white`}>
                                {player.dorsal}
                              </span>
                              <div className="absolute z-50 hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64">
                                <div className="bg-red-600 text-white text-xs rounded-lg p-3 shadow-lg">
                                  <p className="font-bold mb-1">⚠️ Dorsal repetido</p>
                                  <p className="mb-1">Mismo equipo:</p>
                                  <ul className="list-disc list-inside">
                                    {conflicts.map((name, i) => (
                                      <li key={i}>{name}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-red-600"></div>
                              </div>
                            </div>
                          );
                        } else if (status === 'different-team') {
                          return (
                            <div className="relative group">
                              <span className={`${baseClasses} bg-yellow-500 text-white`}>
                                {player.dorsal}
                              </span>
                              <div className="absolute z-50 hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64">
                                <div className="bg-yellow-500 text-white text-xs rounded-lg p-3 shadow-lg">
                                  <p className="font-bold mb-1">⚠️ Dorsal repetido</p>
                                  <p className="mb-1">Otro equipo:</p>
                                  <ul className="list-disc list-inside">
                                    {conflicts.map((name, i) => (
                                      <li key={i}>{name}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-yellow-500"></div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <span className={`${baseClasses} bg-sanse-blue text-white`}>
                            {player.dorsal}
                          </span>
                        );
                      })() : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {player.teams && player.teams.length > 0 ? (
                          player.teams.map((team, idx) => {
                            const isMultiple = player.teams!.length > 1;
                            return (
                              <span
                                key={team.id}
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  isMultiple && idx === 0 ? 'bg-sanse-blue text-white' : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {isMultiple && idx === 0 ? '⭐ ' : ''}{team.name}</span>
                            );
                          })
                        ) : (
                          <span className="text-gray-400 text-sm">Sin equipo</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={player.is_active !== false}
                          onChange={() => handleToggleActive(player)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        <span className="ml-3 text-sm font-medium text-gray-900">
                          {player.is_active !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setViewingPlayer(player); setShowViewModal(true); }}
                          className="text-sanse-blue hover:text-blue-800 font-medium"
                          title="Ver"
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => handleEditPlayer(player)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                          title="Editar"
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPlayers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No se encontraron jugadores' : 'No hay jugadores creados'}
            </div>
          )}
        </div>

        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">{editingPlayer ? '✏️ Editar Jugador' : '➕ Nuevo Jugador'}</h3>
               
              <div className="grid grid-cols-3 gap-4">
                {/* Columna 1: Datos básicos */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Club</label>
                    <select
                      value={formData.club_id}
                      onChange={(e) => setFormData({ ...formData, club_id: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seleccionar club...</option>
                      {clubs.map(club => (
                        <option key={club.id} value={club.id}>{club.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
                    <input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dorsal</label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={formData.dorsal}
                        onChange={async (e) => {
                          const dorsal = e.target.value;
                          setFormData({ ...formData, dorsal });
                          
                          if (dorsal && formData.club_id) {
                            const { data: existingPlayers } = await supabase
                              .from('players')
                              .select('*, team_players!inner(team:teams(category, club_id))')
                              .eq('dorsal', parseInt(dorsal))
                              .eq('club_id', formData.club_id);
                            
                            if (existingPlayers && existingPlayers.length > 0) {
                              const otherPlayer = existingPlayers.find((p: any) => p.id !== editingPlayer?.id);
                              if (otherPlayer) {
                                setDorsalWarning({ exists: true, player: otherPlayer, type: 'same' });
                              }
                            } else {
                              setDorsalWarning(null);
                            }
                          }
                        }}
                        className={`w-full p-2 border rounded-lg ${dorsalWarning?.exists ? 'border-yellow-500' : 'border-gray-300'}`}
                        placeholder="1-99"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      >
                        <option value="otro">Otro</option>
                        <option value="masculino">Masculino</option>
                        <option value="femenino">Femenino</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <label htmlFor="isActive">Jugador activo</label>
                  </div>
                </div>

                {/* Columna 2: Equipos */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Equipos</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {teams.map(team => {
                        const isSelected = selectedTeams.includes(team.id);
                        const isPrimary = formData.primary_team_id === team.id;
                        return (
                          <div key={team.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const newTeams = [...selectedTeams, team.id];
                                  setSelectedTeams(newTeams);
                                  // Auto-select first as primary if none selected
                                  if (!formData.primary_team_id) {
                                    setFormData({ ...formData, primary_team_id: team.id });
                                  }
                                } else {
                                  setSelectedTeams(selectedTeams.filter(tid => tid !== team.id));
                                  // Clear primary if this was the primary
                                  if (formData.primary_team_id === team.id) {
                                    setFormData({ ...formData, primary_team_id: '' });
                                  }
                                }
                              }}
                              className="rounded"
                            />
                            <span className="flex-1 text-sm">{team.name}</span>
                            {isSelected && selectedTeams.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newPrimary = isPrimary ? '' : team.id;
                                  setFormData({ ...formData, primary_team_id: newPrimary });
                                }}
                                className={`text-lg cursor-pointer transition-colors ${
                                  isPrimary 
                                    ? 'text-yellow-400 font-bold' 
                                    : 'text-gray-300 hover:text-yellow-300'
                                }`}
                                title={isPrimary ? "Quitar como principal" : "Marcar como principal"}
                              >
                                {isPrimary ? '⭐' : '☆'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Columna 3: Padres/Tutores */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">👨‍👩‍👧 Padres/Tutores</h4>
                    
                    <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                      <p className="text-sm font-medium text-gray-600">Padre/Tutor 1</p>
                      <input
                        type="text"
                        placeholder="Nombre"
                        value={formData.parent1_name}
                        onChange={(e) => setFormData({ ...formData, parent1_name: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="tel"
                          placeholder="Teléfono"
                          value={formData.parent1_phone}
                          onChange={(e) => setFormData({ ...formData, parent1_phone: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={formData.parent1_email}
                          onChange={(e) => setFormData({ ...formData, parent1_email: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg space-y-2 mt-3">
                      <p className="text-sm font-medium text-gray-600">Padre/Tutor 2 (opcional)</p>
                      <input
                        type="text"
                        placeholder="Nombre"
                        value={formData.parent2_name}
                        onChange={(e) => setFormData({ ...formData, parent2_name: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="tel"
                          placeholder="Teléfono"
                          value={formData.parent2_phone}
                          onChange={(e) => setFormData({ ...formData, parent2_phone: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={formData.parent2_email}
                          onChange={(e) => setFormData({ ...formData, parent2_email: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSavePlayer}
                  className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Guardar
                </button>
                <button
                  onClick={() => { setShowEditModal(false); setEditingPlayer(null); }}
                  className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Ver Jugador */}
        {showViewModal && viewingPlayer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden">
              <div className="bg-gradient-to-r from-sanse-blue to-blue-600 p-6 text-center relative">
                {viewingPlayer.dorsal && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex w-12 h-12 items-center justify-center text-2xl font-bold bg-red-600 text-white rounded-full border-4 border-white shadow-lg">
                      {viewingPlayer.dorsal}
                    </span>
                  </div>
                )}
                <div className="relative inline-block">
                  {viewingPlayer.teams && viewingPlayer.teams[0]?.club?.logo_url ? (
                    <img 
                      src={viewingPlayer.teams[0].club.logo_url} 
                      alt="Club"
                      className="w-24 h-24 rounded-full border-4 border-white object-cover mx-auto"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full border-4 border-white bg-white flex items-center justify-center mx-auto">
                      <span className="text-4xl text-sanse-blue">🏑</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 text-center -mt-8">
                <div className="bg-white rounded-xl p-4 shadow-lg inline-block">
                  <h3 className="text-2xl font-bold text-gray-800">{viewingPlayer.full_name}</h3>
                  {viewingPlayer.birth_date && (
                    <p className="text-gray-500 mt-1">
                      🎂 {new Date(viewingPlayer.birth_date).toLocaleDateString('es-ES')}
                    </p>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase">Equipos</p>
                    <div className="flex flex-wrap gap-1 justify-center mt-2">
                      {viewingPlayer.teams && viewingPlayer.teams.length > 0 ? (
                        viewingPlayer.teams.map(team => (
                          <span key={team.id} className="bg-sanse-blue text-white px-3 py-1 rounded-full text-sm">
                            {team.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400">Sin equipo</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase">Estado</p>
                    <p className={`mt-2 font-bold ${viewingPlayer.is_active !== false ? 'text-green-600' : 'text-red-600'}`}>
                      {viewingPlayer.is_active !== false ? '✅ Activo' : '❌ Inactivo'}
                    </p>
                  </div>
                </div>

                {(viewingPlayer.parent1_name || viewingPlayer.parent2_name) && (
                  <div className="mt-4 bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase mb-2">Contactos de padres</p>
                    {viewingPlayer.parent1_name && (
                      <div className="text-left text-sm">
                        <p className="font-medium flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${viewingPlayer.parent1_is_active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                          👤 {viewingPlayer.parent1_name}
                        </p>
                        {viewingPlayer.parent1_phone && <p className="text-gray-500">📞 {viewingPlayer.parent1_phone}</p>}
                        {viewingPlayer.parent1_email && <p className="text-gray-500">✉️ {viewingPlayer.parent1_email}</p>}
                      </div>
                    )}
                    {viewingPlayer.parent2_name && (
                      <div className="text-left text-sm mt-2">
                        <p className="font-medium flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${viewingPlayer.parent2_is_active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                          👤 {viewingPlayer.parent2_name}
                        </p>
                        {viewingPlayer.parent2_phone && <p className="text-gray-500">📞 {viewingPlayer.parent2_phone}</p>}
                        {viewingPlayer.parent2_email && <p className="text-gray-500">✉️ {viewingPlayer.parent2_email}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => { setShowViewModal(false); setViewingPlayer(null); }}
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 font-medium"
                >
                  Cerrar
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

export default PlayersList;
