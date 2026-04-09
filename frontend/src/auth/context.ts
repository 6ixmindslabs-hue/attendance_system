import { createContext } from 'react';
import type { StudentProfile, UserRole, AppSession } from '../types/app';

export type AuthContextValue = {
  session: AppSession | null;
  isAuthenticated: boolean;
  role: UserRole | null;
  student: StudentProfile | null;
  login: (session: AppSession) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
