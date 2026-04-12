import { create } from 'zustand';
import axios from 'axios';

export interface AuthUser {
  email: string;
  username: string;
  role: 'admin' | 'manager' | 'viewer';
  id: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionToken: string | null;
}

export interface AuthActions {
  login: (email: string, apiKey: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export type AuthStore = AuthState & AuthActions;

const API_BASE = process.env.REACT_APP_API_URL || '/admin/api';

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionToken: null,

  login: async (username: string, apiKey: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        username,
        apiKey,
      });

      const { sessionToken, user } = response.data;
      axios.defaults.headers.common['Authorization'] = `Bearer ${sessionToken}`;

      set({
        user,
        sessionToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : 'Login failed';
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`);
    } catch (err) {
      console.warn('Logout request failed, clearing local session anyway');
    }
    delete axios.defaults.headers.common['Authorization'];
    set({
      user: null,
      sessionToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get(`${API_BASE}/auth/me`);
      const { user } = response.data;
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
