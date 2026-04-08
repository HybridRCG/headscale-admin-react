import { create } from 'zustand';
import axios from 'axios';

export interface User {
  id: string;
  name: string;
  createdAt: string;
  lastSeen: string;
}

export interface PreAuthKey {
  key: string;
  id: string;
  user: User;
  reusable: boolean;
  ephemeral: boolean;
  used: boolean;
  expiration: string;
  createdAt: string;
}

export interface Node {
  id: string;
  name: string;
  ipAddresses: string[];
  lastSeen: string;
  online: boolean;
  user: User;
  availableRoutes?: string[];
  enabledRoutes?: string[];
  forcedTags?: string[];
  createdAt: string;
}

export interface Route {
  node: Node;
  prefix: string;
  advertised: boolean;
  enabled: boolean;
  primary: boolean;
}

export type OnlineStatus = 'all' | 'online' | 'offline';
export type Direction = 'up' | 'down';

export interface HeadscaleState {
  users: User[];
  nodes: Node[];
  preAuthKeys: PreAuthKey[];
  routes: Route[];
  isLoading: boolean;
  error: string | null;
  lastRefresh: number | null;
}

export interface HeadscaleActions {
  fetchUsers: () => Promise<void>;
  fetchNodes: () => Promise<void>;
  fetchPreAuthKeys: () => Promise<void>;
  fetchRoutes: () => Promise<void>;
  createUser: (name: string) => Promise<User>;
  renameUser: (userId: string, newName: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  createPreAuthKey: (userId: string, reusable: boolean, ephemeral: boolean, expiration?: string) => Promise<PreAuthKey>;
  expirePreAuthKey: (keyId: string) => Promise<void>;
  enableRoute: (nodeId: string, prefix: string) => Promise<void>;
  disableRoute: (nodeId: string, prefix: string) => Promise<void>;
  expireNode: (nodeId: string) => Promise<void>;
  clearError: () => void;
}

export type HeadscaleStore = HeadscaleState & HeadscaleActions;

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
const HEADSCALE_PROXY = `${API_BASE}/headscale`;

export const useHeadscaleStore = create<HeadscaleStore>((set, get) => ({
  users: [],
  nodes: [],
  preAuthKeys: [],
  routes: [],
  isLoading: false,
  error: null,
  lastRefresh: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.get(`${HEADSCALE_PROXY}/api/v1/user`);
      const users = response.data.users || [];
      set({ users, lastRefresh: Date.now() });
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to fetch users';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchNodes: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.get(`${HEADSCALE_PROXY}/api/v1/node`);
      const nodes = response.data.nodes || [];
      set({ nodes, lastRefresh: Date.now() });
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to fetch nodes';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPreAuthKeys: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.get(`${HEADSCALE_PROXY}/api/v1/preauthkey`);
      const preAuthKeys = response.data.preAuthKeys || [];
      set({ preAuthKeys, lastRefresh: Date.now() });
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to fetch preauth keys';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRoutes: async () => {
    set({ isLoading: true, error: null });
    try {
      const { nodes } = get();
      const routes: Route[] = [];
      nodes.forEach((node) => {
        if (node.availableRoutes) {
          node.availableRoutes.forEach((prefix) => {
            routes.push({
              node,
              prefix,
              advertised: true,
              enabled: node.enabledRoutes?.includes(prefix) || false,
              primary: false,
            });
          });
        }
      });
      set({ routes, lastRefresh: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch routes';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  createUser: async (name: string) => {
    try {
      const response = await axios.post(`${HEADSCALE_PROXY}/api/v1/user`, { name });
      const newUser = response.data.user;
      set((state) => ({ users: [...state.users, newUser] }));
      return newUser;
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to create user';
      set({ error: message });
      throw error;
    }
  },

  renameUser: async (userId: string, newName: string) => {
    try {
      await axios.post(`${HEADSCALE_PROXY}/api/v1/user/${userId}`, { name: newName });
      set((state) => ({
        users: state.users.map((u) => (u.id === userId ? { ...u, name: newName } : u)),
      }));
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to rename user';
      set({ error: message });
      throw error;
    }
  },

  deleteUser: async (userId: string) => {
    try {
      await axios.delete(`${HEADSCALE_PROXY}/api/v1/user/${userId}`);
      set((state) => ({ users: state.users.filter((u) => u.id !== userId) }));
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to delete user';
      set({ error: message });
      throw error;
    }
  },

  createPreAuthKey: async (userId: string, reusable: boolean, ephemeral: boolean, expiration?: string) => {
    try {
      const response = await axios.post(`${HEADSCALE_PROXY}/api/v1/preauthkey`, { user: userId, reusable, ephemeral, expiration });
      const newKey = response.data.preAuthKey;
      set((state) => ({ preAuthKeys: [...state.preAuthKeys, newKey] }));
      return newKey;
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to create preauth key';
      set({ error: message });
      throw error;
    }
  },

  expirePreAuthKey: async (keyId: string) => {
    try {
      await axios.post(`${HEADSCALE_PROXY}/api/v1/preauthkey/${keyId}/expire`);
      set((state) => ({ preAuthKeys: state.preAuthKeys.filter((k) => k.id !== keyId) }));
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to expire preauth key';
      set({ error: message });
      throw error;
    }
  },

  enableRoute: async (nodeId: string, prefix: string) => {
    try {
      await axios.post(`${HEADSCALE_PROXY}/api/v1/node/${nodeId}/routes/enable`, { prefix });
      set((state) => ({
        routes: state.routes.map((r) =>
          r.node.id === nodeId && r.prefix === prefix ? { ...r, enabled: true } : r
        ),
      }));
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to enable route';
      set({ error: message });
      throw error;
    }
  },

  disableRoute: async (nodeId: string, prefix: string) => {
    try {
      await axios.post(`${HEADSCALE_PROXY}/api/v1/node/${nodeId}/routes/disable`, { prefix });
      set((state) => ({
        routes: state.routes.map((r) =>
          r.node.id === nodeId && r.prefix === prefix ? { ...r, enabled: false } : r
        ),
      }));
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to disable route';
      set({ error: message });
      throw error;
    }
  },

  expireNode: async (nodeId: string) => {
    try {
      await axios.post(`${HEADSCALE_PROXY}/api/v1/node/${nodeId}/expire`);
      set((state) => ({ nodes: state.nodes.filter((n) => n.id !== nodeId) }));
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : 'Failed to expire node';
      set({ error: message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
