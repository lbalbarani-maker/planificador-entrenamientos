import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Trainings from './components/Trainings';
import Exercises from './components/Exercises';
import Categories from './components/Categories';
import Users from './components/Users';
import PublicTraining from './components/PublicTraining';
import MatchList from './components/Hockey/MatchList';
import MatchSetup from './components/Hockey/MatchSetup';
import MatchAdmin from './components/Hockey/MatchAdmin';
import MatchSpectator from './components/Hockey/MatchSpectator';
import TeamsList from './components/Teams/TeamsList';
import TeamDetail from './components/Teams/TeamDetail';
import ClubsList from './components/Clubs/ClubsList';
import LocationsList from './components/Locations/LocationsList';
import PlayersList from './components/Players/PlayersList';
import LotteriesList from './components/Lotteries/LotteriesList';
import LotteryDetail from './components/Lotteries/LotteryDetail';
import LotterySales from './components/Lotteries/LotterySales';
import LotteryPublic from './components/Lotteries/LotteryPublic';
import TournamentsList from './components/Tournaments/TournamentsList';
import TournamentDetail from './components/Tournaments/TournamentDetail';
import { NotificationSettingsPage } from './pages/NotificationSettings';
import { AdminPushPage } from './pages/AdminPush';
import { OfflineBanner } from './components/notifications/OfflineBanner';
import { InstallPromptBanner } from './components/notifications/InstallPromptBanner';
import './App.css';

const hasRole = (roleString: string | undefined, role: string): boolean => {
  if (!roleString) return false;
  return roleString.split(',').includes(role);
};

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
      <OfflineBanner />
      <InstallPromptBanner />
      <Routes>
        {/* Rutas públicas */}
        <Route path="/training/:shareId" element={<PublicTraining />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
        
        {/* Rutas protegidas */}
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/match" element={user ? <MatchList /> : <Navigate to="/login" replace />} />
        <Route path="/match/new" element={user ? <MatchSetup /> : <Navigate to="/login" replace />} />
        <Route path="/match/:id" element={user ? <MatchAdmin /> : <Navigate to="/login" replace />} />
        <Route path="/match/:token/watch" element={<MatchSpectator />} />
        <Route path="/trainings" element={user ? <Trainings /> : <Navigate to="/login" replace />} />
        <Route path="/exercises" element={user ? <Exercises /> : <Navigate to="/login" replace />} />
        <Route path="/users" element={user && hasRole(user.role, 'admin') ? <Users /> : <Navigate to="/dashboard" replace />} />
        <Route path="/categories" element={user && hasRole(user.role, 'admin') ? <Categories /> : <Navigate to="/dashboard" replace />} />
        
        {/* Rutas de Equipos */}
        <Route path="/teams" element={user ? <TeamsList /> : <Navigate to="/login" replace />} />
        <Route path="/teams/:id" element={user ? <TeamDetail /> : <Navigate to="/login" replace />} />
        
        {/* Rutas de Jugadores */}
        <Route path="/players" element={user ? <PlayersList /> : <Navigate to="/login" replace />} />
        
        {/* Rutas de Clubes */}
        <Route path="/clubs" element={user && hasRole(user.role, 'admin') ? <ClubsList /> : <Navigate to="/dashboard" replace />} />
        
        {/* Rutas de Pistas */}
        <Route path="/locations" element={user ? <LocationsList /> : <Navigate to="/login" replace />} />
        
        {/* Rutas de Loterías */}
        <Route path="/lotteries" element={user ? <LotteriesList /> : <Navigate to="/login" replace />} />
        <Route path="/lotteries/:id" element={user ? <LotteryDetail /> : <Navigate to="/login" replace />} />
        <Route path="/lotteries/:id/sales" element={user ? <LotterySales /> : <Navigate to="/login" replace />} />
        
        {/* Rutas de Torneos */}
        <Route path="/tournaments" element={user ? <TournamentsList /> : <Navigate to="/login" replace />} />
        <Route path="/tournaments/:id" element={user ? <TournamentDetail /> : <Navigate to="/login" replace />} />
        
        {/* Rutas de Notificaciones */}
        <Route path="/settings/notifications" element={user ? <NotificationSettingsPage /> : <Navigate to="/login" replace />} />
        <Route path="/admin/push" element={user && hasRole(user.role, 'admin') ? <AdminPushPage /> : <Navigate to="/dashboard" replace />} />
        
        {/* Ruta pública de lotería para jugadores */}
        <Route path="/lottery/:lotteryId/player/:playerId" element={<LotteryPublic />} />
        <Route path="/lottery/:lotteryId/buyer/:buyerId" element={<LotteryPublic />} />
        
        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;