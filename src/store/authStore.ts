import { create } from 'zustand';
import { AuthState, AuthUser } from '../types';

interface AuthStoreState extends AuthState {
  login: (user: AuthUser, apiKey: string, apiUrl: string) => void;
  logout: () => void;
  setAuthFromStorage: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  apiKey: null,
  apiUrl: null,
  isAuthenticated: false,

  login: (user: AuthUser, apiKey: string, apiUrl: string) => {
    localStorage.setItem('authUser', JSON.stringify(user));
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('apiUrl', apiUrl);
    set({ user, apiKey, apiUrl, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('authUser');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('apiUrl');
    set({ user: null, apiKey: null, apiUrl: null, isAuthenticated: false });
  },

  setAuthFromStorage: () => {
    const user = localStorage.getItem('authUser');
    const apiKey = localStorage.getItem('apiKey');
    const apiUrl = localStorage.getItem('apiUrl');
    if (user && apiKey && apiUrl) {
      set({ user: JSON.parse(user), apiKey, apiUrl, isAuthenticated: true });
    }
  },
}));
