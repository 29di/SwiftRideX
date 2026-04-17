import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { driverService } from '../services/driverService';

const STORAGE_KEY = 'swiftridex_session';

const AuthContext = createContext(null);

const readSession = () => {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const persistSession = (session) => {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

const normalizeSession = (role, payload) => {
  const user = payload?.user || payload?.driver;

  return user && payload?.token
    ? {
        token: payload.token,
        role,
        user,
      }
    : null;
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readSession());
  const [bootstrapping, setBootstrapping] = useState(true);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      const savedSession = readSession();

      if (!savedSession?.token || !savedSession?.role) {
        setBootstrapping(false);
        return;
      }

      try {
        const profileData = savedSession.role === 'driver' ? await driverService.me() : await authService.me();
        const hydratedSession = {
          ...savedSession,
          user: profileData?.driver || profileData?.user || savedSession.user,
        };

        setSession(hydratedSession);
        persistSession(hydratedSession);
      } catch {
        persistSession(null);
        setSession(null);
      } finally {
        setBootstrapping(false);
      }
    };

    bootstrap();
  }, []);

  const register = async (role, payload) => {
    const response = role === 'driver' ? await driverService.register(payload) : await authService.register(payload);
    return response;
  };

  const login = async (role, payload) => {
    const response = role === 'driver' ? await driverService.login(payload) : await authService.login(payload);
    const normalized = normalizeSession(role, response);

    if (!normalized) {
      throw new Error('Unexpected login response');
    }

    setSession(normalized);
    persistSession(normalized);
    setSessionError('');
    return normalized;
  };

  const loginWithGoogle = async (credential) => {
    const response = await authService.googleLogin(credential);
    const normalized = normalizeSession('rider', response);

    if (!normalized) {
      throw new Error('Unexpected Google login response');
    }

    setSession(normalized);
    persistSession(normalized);
    setSessionError('');
    return normalized;
  };

  const logout = () => {
    persistSession(null);
    setSession(null);
    setSessionError('');
  };

  const refreshSession = async () => {
    if (!session?.role) {
      return null;
    }

    const profileData = session.role === 'driver' ? await driverService.me() : await authService.me();
    const updatedSession = {
      ...session,
      user: profileData?.driver || profileData?.user || session.user,
    };

    setSession(updatedSession);
    persistSession(updatedSession);
    return updatedSession;
  };

  const value = useMemo(
    () => ({
      session,
      bootstrapping,
      sessionError,
      setSessionError,
      register,
      login,
      loginWithGoogle,
      logout,
      refreshSession,
    }),
    [session, bootstrapping, sessionError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
