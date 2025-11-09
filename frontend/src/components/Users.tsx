import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  fullName: string;
  password: string; // AGREGAR ESTO
  role: 'admin' | 'preparador';
  isActive: boolean;
  createdAt: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>(() => {
    const savedUsers = localStorage.getItem('users');
    if (savedUsers) {
      return JSON.parse(savedUsers);
    }
    
    const initialUsers: User[] = [
      {
        id: '1',
        email: 'admin@sanse.com',
        fullName: 'Administrador Principal',
        password: 'admin123', // CONTRASEÑA INICIAL
        role: 'admin',
        isActive: true,
        createdAt: '2024-01-01'
      },
      {
        id: '2',
        email: 'preparador@sanse.com',
        fullName: 'Preparador Físico',
        password: 'preparador123', // CONTRASEÑA INICIAL
        role: 'preparador',
        isActive: true,
        createdAt: '2024-01-02'
      },
      {
        id: '3',
        email: 'maria.garcia@sanse.com',
        fullName: 'María García López',
        password: 'maria123', // CONTRASEÑA INICIAL
        role: 'preparador',
        isActive: true,
        createdAt: '2024-01-03'
      }
    ];
    return initialUsers;
  });

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    role: 'preparador' as 'admin' | 'preparador'
  });

  useEffect(() => {
    localStorage.setItem('users', JSON.stringify(users));
  }, [users]);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: (users.length + 1).toString(),
      email: formData.email,
      fullName: formData.fullName,
      password: formData.password || 'default123', // CONTRASEÑA POR DEFECTO
      role: formData.role,
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0]
    };
    
    setUsers([...users, newUser]);
    setShowForm(false);
    setFormData({ email: '', fullName: '', password: '', role: 'preparador' });
    alert('Usuario creado exitosamente!');
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      fullName: user.fullName,
      password: '', // DEJAR VACÍO PARA NO MOSTRAR LA CONTRASEÑA ACTUAL
      role: user.role
    });
    setShowForm(true);
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const updatedUsers = users.map(u =>
        u.id === editingUser.id
          ? { 
              ...u, 
              email: formData.email, 
              fullName: formData.fullName, 
              role: formData.role,
              // SI SE INGRESÓ NUEVA CONTRASEÑA, ACTUALIZARLA
              password: formData.password ? formData.password : u.password
            }
          : u
      );
      setUsers(updatedUsers);
      setShowForm(false);
      setEditingUser(null);
      setFormData({ email: '', fullName: '', password: '', role: 'preparador' });
      alert('Usuario actualizado exitosamente!');
    }
  };

  const handleDeleteUser = (id: string, email: string) => {
    if (window.confirm(`¿Estás seguro de eliminar al usuario ${email}?`)) {
      if (email === 'admin@sanse.com') {
        alert('No se puede eliminar el usuario administrador principal');
        return;
      }
      const updatedUsers = users.filter(u => u.id !== id);
      setUsers(updatedUsers);
      alert('Usuario eliminado exitosamente!');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({ email: '', fullName: '', password: '', role: 'preparador' });
  };

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
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
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
                  placeholder={editingUser ? "Nueva contraseña (opcional)" : "Contraseña"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rol *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'preparador' })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="preparador">Preparador Físico</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-sanse-blue text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
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
                    <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
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
                    user.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Editar
                    </button>
                    {user.email !== 'admin@sanse.com' && (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        className="text-red-600 hover:text-red-900"
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

      {users.length === 0 && (
        <div className="text-center p-8 text-gray-500">
          No hay usuarios registrados. Crea el primero.
        </div>
      )}
    </div>
  );
};

export default Users;