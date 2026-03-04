import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Trainings from './components/Trainings';
import Exercises from './components/Exercises';
import PublicTraining from './components/PublicTraining';
import MatchList from './components/Hockey/MatchList';
import MatchSetup from './components/Hockey/MatchSetup';
import MatchAdmin from './components/Hockey/MatchAdmin';
import MatchSpectator from './components/Hockey/MatchSpectator';
import TeamsList from './components/Teams/TeamsList';
import TeamDetail from './components/Teams/TeamDetail';
import './App.css';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión en localStorage (sistema original)
    const checkAuth = () => {
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          setUser(user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Escuchar cambios en el localStorage
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Verificar cada segundo por cambios (para misma pestaña)
    const interval = setInterval(checkAuth, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/training/:shareId" element={<PublicTraining />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
        
        {/* Rutas protegidas */}
        <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/trainings" element={user ? <Trainings /> : <Navigate to="/login" replace />} />
        <Route path="/exercises" element={user ? <Exercises /> : <Navigate to="/login" replace />} />
        
        {/* Rutas de Hockey */}
        <Route path="/hockey" element={user ? <MatchList /> : <Navigate to="/login" replace />} />
        <Route path="/hockey/new" element={user ? <MatchSetup /> : <Navigate to="/login" replace />} />
        <Route path="/hockey/:id" element={user ? <MatchAdmin /> : <Navigate to="/login" replace />} />
        <Route path="/hockey/:token/watch" element={<MatchSpectator />} />
        
        {/* Rutas de Equipos */}
        <Route path="/teams" element={user ? <TeamsList /> : <Navigate to="/login" replace />} />
        <Route path="/teams/:id" element={user ? <TeamDetail /> : <Navigate to="/login" replace />} />
        
        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;