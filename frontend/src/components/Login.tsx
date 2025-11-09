import React, { useState } from 'react';

interface User {
  id: string;
  email: string;
  fullName: string;
  password: string;
  role: 'admin' | 'preparador';
  isActive: boolean;
  createdAt: string;
}

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulamos login por ahora - luego conectaremos con backend
    setTimeout(() => {
      try {
        // Leer usuarios desde localStorage
        const savedUsers = localStorage.getItem('users');
        let users: User[] = [];
        
        if (savedUsers) {
          users = JSON.parse(savedUsers);
        } else {
          // Si no hay usuarios en localStorage, usar los iniciales
          users = [
            {
              id: '1',
              email: 'admin@sanse.com',
              fullName: 'Administrador Principal',
              password: 'admin123',
              role: 'admin',
              isActive: true,
              createdAt: '2024-01-01'
            },
            {
              id: '2',
              email: 'preparador@sanse.com',
              fullName: 'Preparador Físico',
              password: 'preparador123',
              role: 'preparador',
              isActive: true,
              createdAt: '2024-01-02'
            },
            {
              id: '3',
              email: 'maria.garcia@sanse.com',
              fullName: 'María García López',
              password: 'maria123',
              role: 'preparador',
              isActive: true,
              createdAt: '2024-01-03'
            }
          ];
        }

        // Buscar usuario por email y contraseña
        const user = users.find(u => 
          u.email === email && 
          u.password === password && 
          u.isActive === true
        );

        if (user) {
          // Login exitoso - guardar sesión CON EL NOMBRE REAL DEL USUARIO
          localStorage.setItem('user', JSON.stringify({
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName  // ✅ ESTA ES LA CLAVE - usar el nombre real
          }));
          
          window.location.reload();
        } else {
          setError('Credenciales incorrectas o usuario inactivo');
        }
      } catch (error) {
        console.error('Error en login:', error);
        setError('Error al iniciar sesión. Intenta nuevamente.');
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
       
        {/* Logo real */}
        <div className="flex justify-center mb-6">
          <div className="flex flex-col items-center">
            <img 
              src="/images/logosanse2.png" 
              alt="Sanse Complutense" 
              className="h-20 w-20 object-contain mb-4"
            />
            <h2 className="text-2xl font-bold text-center text-sanse-blue mb-2">
              Sanse Complutense
            </h2>
            <p className="text-center text-gray-600">
              Planificador de Entrenamientos
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
              required
              disabled={loading}
              placeholder="tu@email.com"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
              required
              disabled={loading}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sanse-red text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;