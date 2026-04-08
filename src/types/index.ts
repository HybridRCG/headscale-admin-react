export interface User {
  id: string;
  name: string;
  email?: string;
}

export interface Node {
  id: string;
  name: string;
  givenName: string;
  user: User;
  ipAddresses: string[];
  online: boolean;
  lastSeen?: string;
  expiry?: string;
  approvedRoutes?: string[];
}

export interface AuthUser {
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'viewer';
}

export interface AuthState {
  user: AuthUser | null;
  apiKey: string | null;
  apiUrl: string | null;
  isAuthenticated: boolean;
}
