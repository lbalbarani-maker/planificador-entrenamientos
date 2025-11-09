import React, { useState } from 'react';
import Users from './Users'; // ← IMPORT AÑADIDO
import Exercises from './Exercises';
import Categories from './Categories';
import Trainings from './Trainings';

const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'exercises' | 'categories' | 'trainings' | 'users'>('dashboard');

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.reload();
  };

  // Vista del Dashboard principal
  const DashboardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Tarjeta de Ejercicios */}
      <div 
        className="bg-white p-6 rounded-lg shadow-md border-l-4 border-sanse-blue cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => setCurrentView('exercises')}
      >
        <div className="flex items-center">
          <div className="bg-sanse-blue text-white p-3 rounded-lg">
            💪
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-gray-800">Ejercicios</h3>
            <p className="text-gray-600">Gestionar ejercicios</p>
          </div>
        </div>
      </div>

      {/* Tarjeta de Categorías */}
      <div 
        className="bg-white p-6 rounded-lg shadow-md border-l-4 border-sanse-red cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => setCurrentView('categories')}
      >
        <div className="flex items-center">
          <div className="bg-sanse-red text-white p-3 rounded-lg">
            📁
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-gray-800">Categorías</h3>
            <p className="text-gray-600">Organizar por tipos</p>
          </div>
        </div>
      </div>

      {/* Tarjeta de Entrenamientos */}
      <div 
        className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => setCurrentView('trainings')}
      >
        <div className="flex items-center">
          <div className="bg-green-500 text-white p-3 rounded-lg">
            🏑
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-gray-800">Entrenamientos</h3>
            <p className="text-gray-600">Crear sesiones</p>
          </div>
        </div>
      </div>

      {/* Tarjeta de Usuarios - Solo visible para admin */}
      {user.role === 'admin' && (
        <div 
          className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setCurrentView('users')}
        >
          <div className="flex items-center">
            <div className="bg-purple-500 text-white p-3 rounded-lg">
              👥
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-800">Usuarios</h3>
              <p className="text-gray-600">Gestionar preparadores</p>
            </div>
          </div>
        </div>
      )}

      {/* Información del usuario */}
      <div className="bg-white p-6 rounded-lg shadow-md col-span-full">
        <h3 className="text-lg font-semibold text-sanse-blue mb-4">Bienvenido</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p><strong>Nombre:</strong> {user.fullName}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Rol:</strong> {user.role}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">
              {user.role === 'admin' 
                ? 'Tienes acceso completo al sistema' 
                : 'Puedes gestionar ejercicios y crear entrenamientos'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
          
          <div className="flex items-center space-x-4">
  <div className="flex items-center space-x-3">
    <img 
      src="/images/logosanse2.png" 
      alt="Sanse Complutense" 
      className="h-12 w-12 object-contain"
    />
    <div>
      <h1 className="text-2xl font-bold text-sanse-blue">Sanse Complutense</h1>
      <p className="text-sm text-gray-600">Planificador de Entrenamientos</p>
    </div>
  </div>
</div>

            <nav className="flex space-x-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-2 rounded-md ${
                  currentView === 'dashboard'
                    ? 'bg-sanse-blue text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('exercises')}
                className={`px-4 py-2 rounded-md ${
                  currentView === 'exercises'
                    ? 'bg-sanse-blue text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Ejercicios
              </button>
              <button
                onClick={() => setCurrentView('categories')}
                className={`px-4 py-2 rounded-md ${
                  currentView === 'categories'
                    ? 'bg-sanse-blue text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Categorías
              </button>
              <button
                onClick={() => setCurrentView('trainings')}
                className={`px-4 py-2 rounded-md ${
                  currentView === 'trainings'
                    ? 'bg-sanse-blue text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Entrenamientos
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => setCurrentView('users')}
                  className={`px-4 py-2 rounded-md ${
                    currentView === 'users'
                      ? 'bg-sanse-blue text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Usuarios
                </button>
              )}
              <button 
                onClick={handleLogout}
                className="bg-sanse-red text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Cerrar Sesión
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="container mx-auto py-6 px-6">
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'exercises' && <Exercises />}
        {currentView === 'categories' && <Categories />}
        {currentView === 'trainings' && <Trainings />}
        {currentView === 'users' && <Users />} {/* ← CORREGIDO */}
      </main>
    </div>
  );
};

export default Dashboard;