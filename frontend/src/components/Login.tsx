import React, { useState, useEffect } from 'react';
import { usersApi } from '../lib/supabaseUsers';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [step, setStep] = useState<'credentials' | 'pin'>('credentials');
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [pinOnlyMode, setPinOnlyMode] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const usersWithPin = JSON.parse(localStorage.getItem('usersWithPin') || '[]');
    
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
      if (usersWithPin.includes(savedEmail)) {
        setStep('pin');
        setPinOnlyMode(true);
      }
    }
  }, []);

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await usersApi.loginUser(email, password);
      
      if (user) {
        setLoggedInUser(user);
        
        if (!user.pin) {
          setNeedsPinSetup(true);
          setShowPinSetup(true);
          setLoading(false);
          return;
        }
        
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
          const usersWithPin = JSON.parse(localStorage.getItem('usersWithPin') || '[]');
          if (!usersWithPin.includes(email)) {
            usersWithPin.push(email);
            localStorage.setItem('usersWithPin', JSON.stringify(usersWithPin));
          }
        }
        
        setStep('pin');
        setLoading(false);
      } else {
        setError('Credenciales incorrectas o usuario inactivo');
      }
    } catch (error) {
      console.error('Error en login:', error);
      setError('Error al iniciar sesión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (pin.length !== 6) {
      setError('El PIN debe tener 6 dígitos');
      setLoading(false);
      return;
    }

    if (pin !== confirmPin) {
      setError('Los PINs no coinciden');
      setLoading(false);
      return;
    }

    try {
      const pinHash = simpleHash(pin);
      await usersApi.updateUser(loggedInUser.id, { pin: pinHash });
      
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
        const usersWithPin = JSON.parse(localStorage.getItem('usersWithPin') || '[]');
        if (!usersWithPin.includes(email)) {
          usersWithPin.push(email);
          localStorage.setItem('usersWithPin', JSON.stringify(usersWithPin));
        }
      }
      
      localStorage.setItem('user', JSON.stringify({
        id: loggedInUser.id,
        email: loggedInUser.email,
        role: loggedInUser.role,
        fullName: loggedInUser.full_name,
        club_id: loggedInUser.club_id
      }));
      await linkPlayerToSession(loggedInUser.id, loggedInUser.role);
      await linkParentToSession(loggedInUser.email, loggedInUser.role);
      window.location.href = '/';
    } catch (error) {
      console.error('Error setting PIN:', error);
      setError('Error al configurar el PIN');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (step === 'pin' && !loggedInUser) {
      const user = await usersApi.loginWithPin(email, pin);
      if (user) {
        localStorage.setItem('user', JSON.stringify({
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
          club_id: user.club_id
        }));
        await linkPlayerToSession(user.id, user.role);
        await linkParentToSession(user.email, user.role);
        window.location.href = '/';
      } else {
        setError('PIN incorrecto');
      }
      setLoading(false);
      return;
    }

    if (!loggedInUser) {
      const user = await usersApi.loginUser(email, password);
      if (user && user.pin === simpleHash(pin)) {
        if (rememberMe) {
          const usersWithPin = JSON.parse(localStorage.getItem('usersWithPin') || '[]');
          if (!usersWithPin.includes(email)) {
            usersWithPin.push(email);
            localStorage.setItem('usersWithPin', JSON.stringify(usersWithPin));
          }
        }
        localStorage.setItem('user', JSON.stringify({
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
          club_id: user.club_id
        }));
        await linkPlayerToSession(user.id, user.role);
        await linkParentToSession(user.email, user.role);
        window.location.href = '/';
      } else {
        setError('PIN incorrecto');
      }
    } else if (loggedInUser.pin === simpleHash(pin)) {
      localStorage.setItem('user', JSON.stringify({
        id: loggedInUser.id,
        email: loggedInUser.email,
        role: loggedInUser.role,
        fullName: loggedInUser.full_name,
        club_id: loggedInUser.club_id
      }));
      await linkPlayerToSession(loggedInUser.id, loggedInUser.role);
      await linkParentToSession(loggedInUser.email, loggedInUser.role);
      window.location.href = '/';
    } else {
      setError('PIN incorrecto');
    }
    setLoading(false);
  };

  const handleBack = () => {
    setStep('credentials');
    setShowPinSetup(false);
    setNeedsPinSetup(false);
    setPin('');
    setConfirmPin('');
    setLoggedInUser(null);
    setPinOnlyMode(false);
  };

  const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  const linkPlayerToSession = async (userId: string, role: string) => {
    if (role?.includes('jugador')) {
      const { data } = await supabase
        .from('user_relations')
        .select('relation_id')
        .eq('user_id', userId)
        .eq('relation_type', 'player')
        .single();
      
      if (data?.relation_id) {
        localStorage.setItem('selectedPlayerId', data.relation_id);
        const { data: player } = await supabase
          .from('players')
          .select('full_name')
          .eq('id', data.relation_id)
          .single();
        if (player) {
          localStorage.setItem('selectedPlayerName', player.full_name);
        }
      }
    }
  };

  const linkParentToSession = async (userEmail: string, role: string) => {
    if (role?.includes('padre')) {
      const { data: parentsData } = await supabase
        .from('parents')
        .select('player_id')
        .eq('email', userEmail.toLowerCase());
      
      if (parentsData && parentsData.length > 0) {
        const playerIds = parentsData.map(p => p.player_id);
        
        localStorage.setItem('parentPlayerIds', JSON.stringify(playerIds));
        localStorage.setItem('selectedPlayerId', playerIds[0]);
        
        const { data: players } = await supabase
          .from('players')
          .select('id, full_name')
          .in('id', playerIds);
        
        if (players) {
          localStorage.setItem('parentPlayers', JSON.stringify(players));
        }
      }
    }
  };

  const completeLogin = async (user: any) => {
    localStorage.setItem('user', JSON.stringify({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      club_id: user.club_id
    }));
    await linkPlayerToSession(user.id, user.role);
    window.location.href = '/';
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
              Hockey Club Sanse Complutense
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {showPinSetup ? (
          <form onSubmit={handleSetupPin}>
            <div className="text-center mb-4">
              <p className="text-lg font-semibold text-sanse-blue">Configura tu PIN</p>
              <p className="text-sm text-gray-600">Crea un PIN de 6 dígitos para acceso rápido</p>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Ingresa tu PIN
              </label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue text-center text-2xl tracking-widest"
                required
                disabled={loading}
                placeholder="******"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Confirma tu PIN
              </label>
              <input
                type="password"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue text-center text-2xl tracking-widest"
                required
                disabled={loading}
                placeholder="******"
              />
            </div>

            <button
              type="submit"
              disabled={loading || pin.length !== 6 || confirmPin.length !== 6}
              className="w-full bg-sanse-red text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition duration-200 disabled:opacity-50 mb-3"
            >
              {loading ? 'Guardando...' : 'Guardar PIN'}
            </button>
            
            <button
              type="button"
              onClick={handleBack}
              className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition duration-200"
            >
              Atrás
            </button>
          </form>
        ) : step === 'pin' ? (
          <form onSubmit={handlePinSubmit}>
            <div className="text-center mb-4">
              <p className="text-lg font-semibold text-sanse-blue">Bienvenido</p>
              <p className="text-sm text-gray-600">{email}</p>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Ingresa tu PIN
              </label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue text-center text-2xl tracking-widest"
                required
                disabled={loading}
                placeholder="******"
              />
            </div>

            <button
              type="submit"
              disabled={loading || pin.length !== 6}
              className="w-full bg-sanse-red text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition duration-200 disabled:opacity-50 mb-3"
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            
            <button
              type="button"
              onClick={handleBack}
              className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition duration-200"
            >
              Cambiar usuario
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmitCredentials}>
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

            <div className="mb-4">
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

            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="mr-2 h-4 w-4 text-sanse-blue"
                />
                <span className="text-sm text-gray-600">Recordar usuario</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sanse-red text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition duration-200 disabled:opacity-50"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default Login;