import { create } from 'zustand';

export interface Group {
  name: string;
  users: string[];
}

export interface Policy {
  action: 'accept' | 'reject';
  src: string[];
  dst: string[];
  proto?: string;
  ports?: string;
}

export interface Host {
  [name: string]: string; // name -> CIDR
}

export interface TagOwner {
  tag: string;
  owners: string[];
}

export interface SSHRule {
  action: 'accept' | 'reject';
  src: string[];
  dst: string[];
  users: string[];
}

export interface EmailUser {
  [email: string]: string; // email -> username
}

interface AclStore {
  // Groups
  groups: Group[];
  fetchGroups: () => Promise<void>;
  createGroup: (name: string, users: string[]) => Promise<void>;
  deleteGroup: (name: string) => Promise<void>;

  // Policies
  policies: Policy[];
  fetchPolicies: () => Promise<void>;
  createPolicy: (policy: Policy) => Promise<void>;
  updatePolicy: (index: number, policy: Policy) => Promise<void>;
  deletePolicy: (index: number) => Promise<void>;

  // Hosts
  hosts: Host;
  fetchHosts: () => Promise<void>;
  createHost: (name: string, cidr: string) => Promise<void>;
  deleteHost: (name: string) => Promise<void>;

  // Tag Owners
  tagOwners: TagOwner[];
  fetchTagOwners: () => Promise<void>;
  createTagOwner: (tag: string, owners: string[]) => Promise<void>;
  deleteTagOwner: (tag: string) => Promise<void>;

  // SSH
  sshRules: SSHRule[];
  fetchSSHRules: () => Promise<void>;
  createSSHRule: (rule: SSHRule) => Promise<void>;
  updateSSHRule: (index: number, rule: SSHRule) => Promise<void>;
  deleteSSHRule: (index: number) => Promise<void>;

  // Email Users
  emailUsers: EmailUser;
  fetchEmailUsers: () => Promise<void>;
  createEmailUser: (email: string, username: string) => Promise<void>;
  deleteEmailUser: (email: string) => Promise<void>;

  // Loading
  loading: boolean;
  error: string | null;
}

const API_BASE = '/admin/api/acl';

export const useAclStore = create<AclStore>((set, get) => ({
  groups: [],
  policies: [],
  hosts: {},
  tagOwners: [],
  sshRules: [],
  emailUsers: {},
  loading: false,
  error: null,

  // ===== GROUPS =====
  fetchGroups: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/groups`);
      if (!res.ok) throw new Error('Failed to fetch groups');
      const groups = await res.json();
      set({ groups });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  createGroup: async (name: string, users: string[]) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, users })
      });
      if (!res.ok) throw new Error('Failed to create group');
      await get().fetchGroups();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  deleteGroup: async (name: string) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/groups/${name}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete group');
      await get().fetchGroups();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  // ===== POLICIES =====
  fetchPolicies: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/policies`);
      if (!res.ok) throw new Error('Failed to fetch policies');
      const policies = await res.json();
      set({ policies });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  createPolicy: async (policy: Policy) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      });
      if (!res.ok) throw new Error('Failed to create policy');
      await get().fetchPolicies();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  updatePolicy: async (index: number, policy: Policy) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/policies/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      });
      if (!res.ok) throw new Error('Failed to update policy');
      await get().fetchPolicies();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  deletePolicy: async (index: number) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/policies/${index}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete policy');
      await get().fetchPolicies();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  // ===== HOSTS =====
  fetchHosts: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/hosts`);
      if (!res.ok) throw new Error('Failed to fetch hosts');
      const hosts = await res.json();
      set({ hosts });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  createHost: async (name: string, cidr: string) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, cidr })
      });
      if (!res.ok) throw new Error('Failed to create host');
      await get().fetchHosts();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  deleteHost: async (name: string) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/hosts/${name}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete host');
      await get().fetchHosts();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  // ===== TAG OWNERS =====
  fetchTagOwners: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/tag-owners`);
      if (!res.ok) throw new Error('Failed to fetch tag owners');
      const tagOwners = await res.json();
      set({ tagOwners });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  createTagOwner: async (tag: string, owners: string[]) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/tag-owners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, owners })
      });
      if (!res.ok) throw new Error('Failed to create tag owner');
      await get().fetchTagOwners();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  deleteTagOwner: async (tag: string) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/tag-owners/${tag}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete tag owner');
      await get().fetchTagOwners();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  // ===== SSH =====
  fetchSSHRules: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/ssh`);
      if (!res.ok) throw new Error('Failed to fetch SSH rules');
      const sshRules = await res.json();
      set({ sshRules });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  createSSHRule: async (rule: SSHRule) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/ssh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      if (!res.ok) throw new Error('Failed to create SSH rule');
      await get().fetchSSHRules();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  updateSSHRule: async (index: number, rule: SSHRule) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/ssh/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      if (!res.ok) throw new Error('Failed to update SSH rule');
      await get().fetchSSHRules();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  deleteSSHRule: async (index: number) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/ssh/${index}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete SSH rule');
      await get().fetchSSHRules();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  // ===== EMAIL USERS =====
  fetchEmailUsers: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/email-users`);
      if (!res.ok) throw new Error('Failed to fetch email users');
      const emailUsers = await res.json();
      set({ emailUsers });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  createEmailUser: async (email: string, username: string) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/email-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username })
      });
      if (!res.ok) throw new Error('Failed to create email user');
      await get().fetchEmailUsers();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  deleteEmailUser: async (email: string) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`${API_BASE}/email-users/${email}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete email user');
      await get().fetchEmailUsers();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  }
}));
