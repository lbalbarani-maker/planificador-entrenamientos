import React, { useState, useEffect } from 'react';
import BackButton from './BackButton';
import { usersApi, User } from '../lib/supabaseUsers';
import { supabase } from '../lib/supabase';
import { Team, Player } from '../types/teams';

interface SimplePlayer {
  id: string;
  full_name: string;
  is_active?: boolean;
}

interface SimpleTeam {
  id: string;
  name: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [players, setPlayers] = useState<SimplePlayer[]>([]);
  const [teams, setTeams] = useState<SimpleTeam[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{id: string, email: string} | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    roles: [] as string[],
    playerIds: [] as string[],
    teamIds: [] as string[]
  });
  
  const getRoleLabels = (roleString: string): string => {
    if (!roleString) return '-';
    const roles = roleString.split(',');
    const roleNames: Record<string, string> = {
      admin: 'Admin',
      admin_club: 'Admin Club',
      entrenador: 'Entrenador',
      preparador: 'Prep. Físico',
      coordinador: 'Coordinador',
      delegado: 'Delegado',
      tesorero: 'Tesorero',
      jugador: 'Jugador',
      padre: 'Padre/Tutor'
    };
    return roles.map(r => roleNames[r] || r).join(', ');
  };

  const hasRole = (roleString: string, role: string): boolean => {
    if (!roleString) return false;
    return roleString.split(',').includes(role);
  };

  const AVAILABLE_ROLES = [
    { value: 'admin', label: 'Administrador' },
    { value: 'admin_club', label: 'Admin Club' },
    { value: 'entrenador', label: 'Entrenador' },
    { value: 'preparador', label: 'Preparador Físico' },
    { value: 'coordinador', label: 'Coordinador' },
    { value: 'delegado', label: 'Delegado' },
    { value: 'tesorero', label: 'Tesorero' },
    { value: 'jugador', label: 'Jugador' },
    { value: 'padre', label: 'Padre/Tutor' }
  ];

  const [loading, setLoading] = useState(false);

  // Cargar usuarios desde Supabase
  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersData = await usersApi.getUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      setSuccessMessage('Error al cargar los usuarios');
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Cargar jugadores y equipos
  const loadOptions = async () => {
    try {
      const { data: playersData } = await supabase.from('players').select('id, full_name, is_active').order('full_name');
      const { data: teamsData } = await supabase.from('teams').select('id, name').order('name');
      
      setPlayers(playersData || []);
      setTeams(teamsData || []);
    } catch (error) {
      console.error('Error loading options:', error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadOptions();
  }, []);

const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const roleString = formData.roles.join(',');
      const isParentRole = formData.roles.includes('padre');
      
      let userId: string;
      let newUser: User | null = null;
      
      if (isParentRole) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', formData.email.toLowerCase())
          .single();
        
        if (existingUser) {
          userId = existingUser.id;
          await usersApi.updateUser(userId, { role: roleString, is_active: true });
        } else {
          newUser = await usersApi.createUser({
            email: formData.email,
            full_name: formData.full_name,
            password: formData.password || 'default123',
            role: roleString,
            is_active: true,
            club_id: null,
            is_super_admin: false,
            is_club_admin: false
          });
          userId = newUser.id;
        }
      } else {
        newUser = await usersApi.createUser({
          email: formData.email,
          full_name: formData.full_name,
          password: formData.password || 'default123',
          role: roleString,
          is_active: true,
          club_id: null,
          is_super_admin: false,
          is_club_admin: false
        });
        userId = newUser.id;
      }
      
      if (isParentRole && formData.playerIds.length > 0) {
        const { data: existingParents } = await supabase
          .from('parents')
          .select('id, player_id, parent_number')
          .eq('email', formData.email.toLowerCase());
        
        for (const playerId of formData.playerIds) {
          const existingForPlayer = existingParents?.find(p => p.player_id === playerId);
          if (!existingForPlayer) {
            const usedNumbers = existingParents?.filter(p => p.player_id === playerId).map(p => p.parent_number) || [];
            const nextNumber = usedNumbers.includes(1) ? 2 : 1;
            
            await supabase.from('parents').insert({
              player_id: playerId,
              parent_number: nextNumber,
              full_name: formData.full_name,
              email: formData.email.toLowerCase()
            });
          }
        }
      }
      
      if (formData.playerIds.length > 0 && !isParentRole) {
        await usersApi.updateUserRelations(userId, formData.playerIds, formData.teamIds);
      }
      
      if (formData.teamIds.length > 0) {
        await usersApi.updateUserRelations(userId, [], formData.teamIds);
      }
      
      const refreshedUsers = await usersApi.getUsers();
      setUsers(refreshedUsers);
      setShowForm(false);
      setFormData({ email: '', full_name: '', password: '', roles: [], playerIds: [], teamIds: [] });
      setSuccessMessage(newUser ? 'Usuario creado exitosamente!' : 'Usuario actualizado y vinculado exitosamente!');
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error?.code === '23505') {
        setSuccessMessage('Error: Este email ya está registrado. Usa otro email o edita el usuario existente.');
      } else {
        setSuccessMessage('Error al crear el usuario');
      }
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
    }
  };

const handleEditUser = async (user: User) => {
    setEditingUser(user);
    const userRoles = user.role ? user.role.split(',') : [];
    const isParentRole = userRoles.includes('padre');
    
    let playerIds: string[] = [];
    let teamIds: string[] = [];
    
    try {
      if (isParentRole) {
        const { data: parentsData } = await supabase
          .from('parents')
          .select('player_id')
          .eq('email', user.email.toLowerCase());
        playerIds = parentsData?.map(p => p.player_id) || [];
      } else {
        const relations = await usersApi.getUserRelations(user.id);
        playerIds = relations.filter(r => r.relation_type === 'player').map(r => r.relation_id);
        teamIds = relations.filter(r => r.relation_type === 'team').map(r => r.relation_id);
      }
    } catch (error) {
      console.error('Error loading user relations:', error);
    }
    
    setFormData({
      email: user.email,
      full_name: user.full_name,
      password: '',
      roles: userRoles,
      playerIds,
      teamIds
    });
    setShowForm(true);
  };

const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setLoading(true);
    
    try {
      const roleString = formData.roles.join(',');
      const isParentRole = formData.roles.includes('padre');
      const updates: any = {
        email: formData.email,
        full_name: formData.full_name,
        role: roleString
      };
      
      if (formData.password) {
        updates.password = formData.password;
      }
      
      const updatedUser = await usersApi.updateUser(editingUser.id, updates);
      
      if (isParentRole && formData.playerIds.length > 0) {
        const { data: existingParents } = await supabase
          .from('parents')
          .select('id, player_id, parent_number')
          .eq('email', editingUser.email.toLowerCase());
        
        for (const playerId of formData.playerIds) {
          const existingForPlayer = existingParents?.find(p => p.player_id === playerId);
          if (!existingForPlayer) {
            const usedNumbers = existingParents?.filter(p => p.player_id === playerId).map(p => p.parent_number) || [];
            const nextNumber = usedNumbers.includes(1) ? 2 : 1;
            
            await supabase.from('parents').insert({
              player_id: playerId,
              parent_number: nextNumber,
              full_name: formData.full_name,
              email: formData.email.toLowerCase()
            });
          } else {
            await supabase
              .from('parents')
              .update({ full_name: formData.full_name })
              .eq('id', existingForPlayer.id);
          }
        }
        
        const selectedPlayerIds = formData.playerIds;
        const parentsToRemove = existingParents?.filter(p => !selectedPlayerIds.includes(p.player_id)) || [];
        for (const parent of parentsToRemove) {
          await supabase.from('parents').delete().eq('id', parent.id);
        }
      }
      
      if (formData.playerIds.length > 0 && !isParentRole) {
        await usersApi.updateUserRelations(editingUser.id, formData.playerIds, formData.teamIds);
      }
      
      if (formData.teamIds.length > 0) {
        await usersApi.updateUserRelations(editingUser.id, [], formData.teamIds);
      }
      
      setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
      setShowForm(false);
      setEditingUser(null);
      setFormData({ email: '', full_name: '', password: '', roles: [], playerIds: [], teamIds: [] });
      setSuccessMessage('Usuario actualizado exitosamente!');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error updating user:', error);
      setSuccessMessage('Error al actualizar el usuario');
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (id: string, email: string) => {
    if (email === 'admin@sanse.com') {
      setSuccessMessage('No se puede eliminar el usuario administrador principal');
      setShowSuccessModal(true);
      return;
    }
    setUserToDelete({ id, email });
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    setLoading(true);
    setShowDeleteModal(false);
    
    try {
      await usersApi.deleteUser(userToDelete.id);
      setUsers(users.filter(u => u.id !== userToDelete.id));
      setSuccessMessage('Usuario eliminado exitosamente!');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error deleting user:', error);
      setSuccessMessage('Error al eliminar el usuario');
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
      setUserToDelete(null);
    }
  };

const resetForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({ email: '', full_name: '', password: '', roles: [], playerIds: [], teamIds: [] });
  };

  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  if (loading && users.length === 0) {
    return <div className="container mx-auto p-6 text-center">Cargando usuarios...</div>;
  }

return (
    <div className="container mx-auto p-6">
      <BackButton />
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
          <div>
          <h1 className="text-3xl font-bold text-sanse-blue">Gestión de Usuarios</h1>
          <p className="text-gray-600">Administra los usuarios del sistema</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-sanse-red text-white px-4 py-2 rounded-md hover:bg-red-700"
          disabled={loading}
        >
          + Nuevo Usuario
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
          </h2>
          <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre Completo *</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Contraseña {!editingUser && '*'}
                  {editingUser && <span className="text-gray-500 text-sm"> (Dejar vacío para mantener la actual)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required={!editingUser}
                  disabled={loading}
                  placeholder={editingUser ? "Nueva contraseña (opcional)" : "Contraseña"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Roles *</label>
                <div className="grid grid-cols-2 gap-2 border border-gray-300 rounded-md p-3 bg-gray-50">
                  {AVAILABLE_ROLES.map(role => (
                    <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.roles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        className="w-4 h-4 text-sanse-blue rounded"
                        disabled={loading}
                      />
                      <span className="text-sm">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Selector de Jugadores (si tiene rol padre o jugador) */}
            {(formData.roles.includes('padre') || formData.roles.includes('jugador')) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.roles.includes('jugador') ? 'Jugador *' : 'Seleccionar Jugadores (hijos/as) *'}
                </label>
                <div className="border border-gray-300 rounded-md p-3 bg-gray-50 max-h-40 overflow-y-auto">
                  {players.filter(p => p.is_active !== false).map(player => (
                    <label key={player.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type={formData.roles.includes('jugador') ? 'radio' : 'checkbox'}
                        name="playerSelect"
                        checked={formData.roles.includes('jugador') 
                          ? formData.playerIds.includes(player.id)
                          : formData.playerIds.includes(player.id)
                        }
                        onChange={(e) => {
                          if (formData.roles.includes('jugador')) {
                            setFormData({ ...formData, playerIds: [player.id] });
                          } else {
                            if (e.target.checked) {
                              setFormData({ ...formData, playerIds: [...formData.playerIds, player.id] });
                            } else {
                              setFormData({ ...formData, playerIds: formData.playerIds.filter(id => id !== player.id) });
                            }
                          }
                        }}
                        className="w-4 h-4 text-sanse-blue rounded"
                        disabled={loading}
                      />
                      <span className="text-sm">{player.full_name}</span>
                    </label>
                  ))}
                  {players.filter(p => p.is_active !== false).length === 0 && (
                    <p className="text-gray-500 text-sm">No hay jugadores disponibles</p>
                  )}
                </div>
              </div>
            )}

            {/* Selector de Equipos (si tiene rol entrenador o delegado) */}
            {(formData.roles.includes('entrenador') || formData.roles.includes('delegado')) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Equipos que gestiona *</label>
                <div className="border border-gray-300 rounded-md p-3 bg-gray-50 max-h-40 overflow-y-auto">
                  {teams.map(team => (
                    <label key={team.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={formData.teamIds.includes(team.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, teamIds: [...formData.teamIds, team.id] });
                          } else {
                            setFormData({ ...formData, teamIds: formData.teamIds.filter(id => id !== team.id) });
                          }
                        }}
                        className="w-4 h-4 text-sanse-blue rounded"
                        disabled={loading}
                      />
                      <span className="text-sm">{team.name}</span>
                    </label>
                  ))}
                  {teams.length === 0 && (
                    <p className="text-gray-500 text-sm">No hay equipos disponibles</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-sanse-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Guardando...' : (editingUser ? 'Actualizar Usuario' : 'Crear Usuario')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 disabled:opacity-50"
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de usuarios */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha Creación
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {user.role && user.role.split(',').map(r => (
                      <span key={r} className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        r === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : r === 'admin_club'
                          ? 'bg-indigo-100 text-indigo-800'
                          : r === 'entrenador'
                          ? 'bg-green-100 text-green-800'
                          : r === 'preparador'
                          ? 'bg-blue-100 text-blue-800'
                          : r === 'coordinador'
                          ? 'bg-yellow-100 text-yellow-800'
                          : r === 'delegado'
                          ? 'bg-pink-100 text-pink-800'
                          : r === 'tesorero'
                          ? 'bg-teal-100 text-teal-800'
                          : r === 'jugador'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {r === 'admin' && 'Admin'}
                        {r === 'admin_club' && 'Admin Club'}
                        {r === 'entrenador' && 'Entrenador'}
                        {r === 'preparador' && 'Prep. Físico'}
                        {r === 'coordinador' && 'Coordinador'}
                        {r === 'delegado' && 'Delegado'}
                        {r === 'tesorero' && 'Tesorero'}
                        {r === 'jugador' && 'Jugador'}
                        {r === 'padre' && 'Padre/Tutor'}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="bg-sanse-blue text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                      disabled={loading}
                    >
                      ✏️
                    </button>
                    {user.email !== 'admin@sanse.com' && (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                        disabled={loading}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && !loading && (
        <div className="text-center p-8 text-gray-500">
          No hay usuarios registrados. Crea el primero.
        </div>
      )}

      {/* Modal de éxito */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">¡Éxito!</h3>
            <p className="text-gray-600 mb-6">{successMessage}</p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Confirmar eliminación</h3>
            <p className="text-gray-600 mb-6">¿Estás seguro de eliminar al usuario {userToDelete.email}?</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={confirmDeleteUser}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-medium"
                disabled={loading}
              >
                Eliminar
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;