import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AUTH_STATE_EVENT, clearStoredSession, getStoredSession, persistSession } from '../lib/session';
import { AuthContext, type AuthContextValue } from './context';
import type { AppSession } from '../types/app';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AppSession | null>(() => getStoredSession());

  useEffect(() => {
    const syncSession = () => {
      setSession(getStoredSession());
    };

    window.addEventListener('storage', syncSession);
    window.addEventListener(AUTH_STATE_EVENT, syncSession);

    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener(AUTH_STATE_EVENT, syncSession);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isAuthenticated: Boolean(session?.token),
    role: session?.role || null,
    student: session?.student || null,
    login: (nextSession) => {
      persistSession(nextSession);
      setSession(nextSession);
    },
    logout: () => {
      clearStoredSession();
      setSession(null);
    }
  }), [session]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
