import type { AppSession } from '../types/app';

export const APP_SESSION_KEY = 'attendance_app_session';
export const AUTH_STATE_EVENT = 'attendance-auth-state-changed';

const notifyAuthStateChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_STATE_EVENT));
  }
};

export const getStoredSession = (): AppSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawSession = window.localStorage.getItem(APP_SESSION_KEY);
    if (!rawSession) {
      return null;
    }

    return JSON.parse(rawSession) as AppSession;
  } catch {
    window.localStorage.removeItem(APP_SESSION_KEY);
    return null;
  }
};

export const persistSession = (session: AppSession) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(APP_SESSION_KEY, JSON.stringify(session));
  window.localStorage.removeItem('attendance_student_session');
  notifyAuthStateChanged();
};

export const clearStoredSession = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(APP_SESSION_KEY);
  window.localStorage.removeItem('attendance_student_session');
  notifyAuthStateChanged();
};
