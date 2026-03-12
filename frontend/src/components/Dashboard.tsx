import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Users from './Users';
import Exercises from './Exercises';
import Categories from './Categories';
import Trainings from './Trainings';
import TeamsList from './Teams/TeamsList';
import TeamDetail from './Teams/TeamDetail';
import ClubsList from './Clubs/ClubsList';
import MatchList from './Hockey/MatchList';
import NextMatch from './NextMatch';
import BackButton from './BackButton';
import PlayersList from './Players/PlayersList';
import MyConvocations from './MyConvocations';
import { eventsApi, teamsApi, convocationApi } from '../lib/supabaseTeams';
import { Event, Team, Player } from '../types/teams';
import { supabase } from '../lib/supabase';
import { useDashboardData } from '../hooks/useDashboardData';
import { useRolePermissions } from '../hooks/useRolePermissions';
import {
  KPICardsSection,
  ChartsSection,
  BirthdaysSection,
  TrainingStatsSection,
  LotterySellersSection,
} from './Dashboard/index';

const Dashboard: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [tempRole, setTempRole] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const originalRole = user.originalRole || user.role;
  const { can } = useRolePermissions();
  const { data: dashboardData, loading: dashboardLoading } = useDashboardData();

  const getCurrentView = () => {
    const path = location.pathname;
    if (path === '/dashboard' || path === '/') return 'home';
    if (path.startsWith('/match')) return 'hockey';
    if (path.startsWith('/teams')) return 'teams';
    if (path.startsWith('/players')) return 'players';
    if (path.startsWith('/trainings')) return 'trainings';
    if (path.startsWith('/clubs')) return 'clubs';
    if (path.startsWith('/users')) return 'users';
    return 'home';
  };

  const [currentView, setCurrentView] = useState(getCurrentView());

  const [events, setEvents] = useState<Event[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [trainingStats, setTrainingStats] = useState<{eventId: string, total: number, confirmed: number, declined: number, pending: number}[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsData, teamsData, playersData] = await Promise.all([
        eventsApi.getAllEvents(),
        teamsApi.getTeams(),
        supabase.from('players').select('*').eq('is_active', true)
      ]);
      setEvents(eventsData);
      setTeams(teamsData);
      setPlayers(playersData.data || []);

      const trainingEvents = eventsData.filter(e => e.type === 'training');
      const stats = await Promise.all(
        trainingEvents.slice(0, 5).map(async (event) => {
          const convs = await convocationApi.getConvocation(event.id);
          return {
            eventId: event.id,
            total: convs.length,
            confirmed: convs.filter(c => c.status === 'accepted').length,
            declined: convs.filter(c => c.status === 'declined').length,
            pending: convs.filter(c => c.status === 'pending').length
          };
        })
      );
      setTrainingStats(stats);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBirthdaysThisWeek = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return players.filter(player => {
      if (!player.birth_date) return false;
      const birthDate = new Date(player.birth_date);
      const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
      return thisYearBirthday >= startOfWeek && thisYearBirthday < endOfWeek;
    }).sort((a, b) => {
      const dateA = new Date(a.birth_date!);
      const dateB = new Date(b.birth_date!);
      return dateA.getDate() - dateB.getDate();
    });
  };

  const formatBirthday = (birthDate: string) => {
    const date = new Date(birthDate);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const birthdaysThisWeek = getBirthdaysThisWeek();

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const handleTeamClick = (teamId: string) => {
    setSelectedTeamId(teamId);
    setCurrentView('teamDetail');
    setSidebarOpen(false);
  };

  const upcomingEvents = events
    .filter(e => new Date(e.start_datetime) >= new Date())
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
    .slice(0, 5);

  const recentEvents = events
    .sort((a, b) => new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime())
    .slice(0, 10);

  const hasRole = (roleString: string | undefined, role: string): boolean => {
    if (!roleString) return false;
    return roleString.split(',').includes(role);
  };

  const navItems = [
    { id: 'home', label: 'Inicio', icon: '🏠', path: '/dashboard' },
    { id: 'hockey', label: 'Partidos', icon: '🏑', path: '/match' },
    { id: 'teams', label: 'Equipos', icon: '🏅', path: '/teams' },
    { id: 'players', label: 'Jugadores/as', icon: '👤', path: '/players' },
    { id: 'lotteries', label: 'Loterías', icon: '🎫', path: '/lotteries' },
    { id: 'trainings', label: 'Entrenos Físicos', icon: '🏋️', path: '/trainings' },
    { id: 'locations', label: 'Pistas', icon: '📍', path: '/locations' },
    ...(hasRole(user.role, 'admin') ? [{ id: 'clubs', label: 'Clubes', icon: '🏢', path: '/clubs' }] : []),
    ...(hasRole(user.role, 'admin') ? [{ id: 'users', label: 'Usuarios', icon: '👥', path: '/users' }] : []),
  ];

  const handleRoleChange = (role: string) => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentRoles = currentUser.role ? currentUser.role.split(',') : [];
    
    if (currentRoles.includes(role)) {
      const newRoles = currentRoles.filter((r: string) => r !== role);
      currentUser.role = newRoles.length > 0 ? newRoles.join(',') : 'jugador';
    } else {
      currentRoles.push(role);
      currentUser.role = currentRoles.join(',');
    }
    
    localStorage.setItem('user', JSON.stringify(currentUser));
    setShowRoleModal(false);
    window.location.reload();
  };

  const getCurrentRoleLabel = () => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const role = currentUser.role;
    if (!role) return 'Sin rol';
    
    const roleList = role.split(',');
    const labels: Record<string, string> = {
      'admin': 'Administrador',
      'admin_club': 'Admin Club',
      'entrenador': 'Entrenador',
      'preparador': 'Preparador Físico',
      'coordinador': 'Coordinador',
      'delegado': 'Delegado',
      'tesorero': 'Tesorero',
      'jugador': 'Jugador',
      'padre': 'Padre/Tutor'
    };
    return roleList.map((r: string) => labels[r] || r).join(', ');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === tomorrow.toDateString()) return 'Mañana';
    
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'match': return '🏑';
      case 'training': return '🏋️';
      case 'meeting': return '📋';
      default: return '📅';
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'match': return 'Partido';
      case 'training': return 'Entreno';
      case 'meeting': return 'Reunión';
      default: return 'Evento';
    }
  };

  if (currentView === 'teamDetail' && selectedTeamId) {
    return <TeamDetail />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <img src="/images/logosanse2.png" alt="Logo" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="font-bold text-sanse-blue text-sm">Club OS</h1>
                <p className="text-xs text-gray-500">{user.fullName}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                  currentView === item.id
                    ? 'bg-sanse-blue text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Botones flotantes - siempre visibles */}
          <div className="p-4 border-t bg-white sticky bottom-0">
            <button
              onClick={() => setShowRoleModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors mb-2"
            >
              <span>🎭</span>
              <div className="flex-1 text-left">
                <span className="font-medium block">Cambiar Rol</span>
                <span className="text-xs text-gray-500">Ver como: {getCurrentRoleLabel()}</span>
              </div>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <span>🚪</span>
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header móvil */}
        <header className="lg:hidden bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img src="/images/logosanse2.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-sanse-blue">Club OS</span>
          </div>
          <div className="w-10" />
        </header>

        {/* Contenido */}
        <main className="flex-1 p-4 lg:p-6">
          {currentView === 'home' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Saludo */}
              <div className="bg-gradient-to-r from-sanse-blue to-blue-600 text-white p-6 rounded-2xl shadow-lg">
                <h1 className="text-2xl lg:text-3xl font-bold">
                  {(() => {
                    const hour = new Date().getHours();
                    if (hour < 12) return 'Buenos días';
                    if (hour < 18) return 'Buenas tardes';
                    return 'Buenas noches';
                  })()}, {user.fullName || 'Usuario'}! 👋
                </h1>
                <p className="text-blue-100 mt-1">Bienvenido al panel de control de tu club</p>
              </div>

              {/* KPIs */}
              <KPICardsSection data={dashboardData.kpi} />

              {/* Gráficos Interactivos */}
              <ChartsSection 
                attendanceTrend={dashboardData.attendanceTrend}
                eventsDistribution={dashboardData.eventsDistribution}
                teamPerformance={dashboardData.teamPerformance}
              />

              {/* Mis Convocatorias */}
              <MyConvocations />

              {/* Próximo Partido */}
              {can.view('sections.nextMatch') && <NextMatch />}

              {/* Cumpleaños */}
              <BirthdaysSection players={dashboardData.players} />

              {/* Estadísticas de Entrenamiento */}
              <TrainingStatsSection stats={dashboardData.trainingStats} />

              {/* Ranking Vendedores Lotería */}
              <LotterySellersSection 
                topPlayerSellers={dashboardData.topPlayerSellers}
                topTeamSellers={dashboardData.topTeamSellers}
              />
            </div>
          )}

          {currentView === 'hockey' && <MatchList />}
          {currentView === 'teams' && <TeamsList />}
          {currentView === 'players' && <PlayersList />}
          {currentView === 'trainings' && <Trainings />}
          {currentView === 'exercises' && <Exercises />}
          {currentView === 'categories' && <Categories />}
          {currentView === 'clubs' && hasRole(user.role, 'admin') && <ClubsList />}
          {currentView === 'users' && hasRole(user.role, 'admin') && <Users />}
        </main>
      </div>

      {/* Modal Cambiar Rol */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4">🎭 Cambiar Rol</h3>
            <p className="text-gray-600 mb-4">
              Selecciona el rol que quieres visualizar. Podrás volver a administrador cuando quieras.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleRoleChange('admin')}
                className={`w-full p-3 rounded-lg text-left font-medium flex items-center justify-between ${
                  hasRole(user.role, 'admin') ? 'bg-sanse-blue text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                👑 Administrador
                {hasRole(user.role, 'admin') && <span>✓</span>}
              </button>
              <button
                onClick={() => handleRoleChange('entrenador')}
                className={`w-full p-3 rounded-lg text-left font-medium flex items-center justify-between ${
                  hasRole(user.role, 'entrenador') ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                🏃 Entrenador
                {hasRole(user.role, 'entrenador') && <span>✓</span>}
              </button>
              <button
                onClick={() => handleRoleChange('preparador')}
                className={`w-full p-3 rounded-lg text-left font-medium flex items-center justify-between ${
                  hasRole(user.role, 'preparador') ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                💪 Preparador Físico
                {hasRole(user.role, 'preparador') && <span>✓</span>}
              </button>
              <button
                onClick={() => handleRoleChange('coordinador')}
                className={`w-full p-3 rounded-lg text-left font-medium flex items-center justify-between ${
                  hasRole(user.role, 'coordinador') ? 'bg-yellow-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                📋 Coordinador
                {hasRole(user.role, 'coordinador') && <span>✓</span>}
              </button>
              <button
                onClick={() => handleRoleChange('delegado')}
                className={`w-full p-3 rounded-lg text-left font-medium flex items-center justify-between ${
                  hasRole(user.role, 'delegado') ? 'bg-pink-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                🤝 Delegado
                {hasRole(user.role, 'delegado') && <span>✓</span>}
              </button>
              <button
                onClick={() => handleRoleChange('tesorero')}
                className={`w-full p-3 rounded-lg text-left font-medium flex items-center justify-between ${
                  hasRole(user.role, 'tesorero') ? 'bg-teal-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                💰 Tesorero
                {hasRole(user.role, 'tesorero') && <span>✓</span>}
              </button>
              <button
                onClick={() => handleRoleChange('jugador')}
                className={`w-full p-3 rounded-lg text-left font-medium flex items-center justify-between ${
                  hasRole(user.role, 'jugador') ? 'bg-red-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                🏑 Jugador
                {hasRole(user.role, 'jugador') && <span>✓</span>}
              </button>
              <button
                onClick={() => handleRoleChange('padre')}
                className={`w-full p-3 rounded-lg text-left font-medium flex items-center justify-between ${
                  hasRole(user.role, 'padre') ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                👨‍👩‍👧 Padre/Tutor
                {hasRole(user.role, 'padre') && <span>✓</span>}
              </button>
            </div>
            <button
              onClick={() => setShowRoleModal(false)}
              className="w-full mt-4 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
