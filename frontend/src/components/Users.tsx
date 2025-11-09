import React, { useState, useEffect } from 'react';
import { usersApi, User } from '../lib/supabaseUsers';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'preparador' as 'admin' | 'preparador'
  });
  const [loading, setLoading] = useState(false);

  // Cargar usuarios desde Supabase
  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersData = await usersApi.getUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const newUser = await usersApi.createUser({
        email: formData.email,
        full_name: formData.full_name,
        password: formData.password || 'default123',
        role: formData.role,
        is_active: true
      });
      
      setUsers([...users, newUser]);
      setShowForm(false);
      setFormData({ email: '', full_name: '', password: '', role: 'preparador' });
      alert('Usuario creado exitosamente!');
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error al crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      password: '', // Dejar vacío para no mostrar la contraseña actual
      role: user.role
    });
    setShowForm(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setLoading(true);
    
    try {
      const updates: any = {
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role
      };
      
      // Solo actualizar password si se ingresó una nueva
      if (formData.password) {
        updates.password = formData.password;
      }
      
      const updatedUser = await usersApi.updateUser(editingUser.id, updates);
      
      setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
      setShowForm(false);
      setEditingUser(null);
      setFormData({ email: '', full_name: '', password: '', role: 'preparador' });
      alert('Usuario actualizado exitosamente!');
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error al actualizar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (window.confirm(`¿Estás seguro de eliminar al usuario ${email}?`)) {
      if (email === 'admin@sanse.com') {
        alert('No se puede eliminar el usuario administrador principal');
        return;
      }
      
      setLoading(true);
      
      try {
        await usersApi.deleteUser(id);
        setUsers(users.filter(u => u.id !== id));
        alert('Usuario eliminado exitosamente!');
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error al eliminar el usuario');
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({ email: '', full_name: '', password: '', role: 'preparador' });
  };

  if (loading && users.length === 0) {
    return <div className="container mx-auto p-6 text-center">Cargando usuarios...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-sanse-blue">Gestión de Usuarios</h1>
          <p className="text-gray-600">Administra los preparadores físicos del sistema</p>
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
                <label className="block text-sm font-medium text-gray-700">Rol *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'preparador' })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  disabled={loading}
                >
                  <option value="preparador">Preparador Físico</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

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
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user.role === 'admin' ? 'Administrador' : 'Preparador'}
                  </span>
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
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                      disabled={loading}
                    >
                      Editar
                    </button>
                    {user.email !== 'admin@sanse.com' && (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        disabled={loading}
                      >
                        Eliminar
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
    </div>
  );
};

export default Users;