import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../store/authStore';

let apiClient: AxiosInstance;

export const initializeApiClient = () => {
  const { apiUrl, apiKey } = useAuthStore.getState();
  apiClient = axios.create({
    baseURL: apiUrl || 'https://hs.groblers.co.uk',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  return apiClient;
};

export const getApiClient = (): AxiosInstance => {
  if (!apiClient) initializeApiClient();
  return apiClient;
};

export const headscaleApi = {
  getUsers: async () => {
    const client = getApiClient();
    const response = await client.get('/api/v1/user');
    return response.data.users || [];
  },
  getNodes: async () => {
    const client = getApiClient();
    const response = await client.get('/api/v1/node');
    return response.data.nodes || [];
  },
  getPolicy: async () => {
    const client = getApiClient();
    const response = await client.get('/api/v1/policy');
    return response.data;
  },
};

export const authenticateUser = async (
  email: string,
  headscaleUrl: string,
  headscaleApiKey: string
) => {
  const tempClient = axios.create({
    baseURL: headscaleUrl,
    headers: { Authorization: `Bearer ${headscaleApiKey}` },
  });

  const usersRes = await tempClient.get('/api/v1/user');
  const user = usersRes.data.users?.find((u: any) => u.email === email);
  if (!user) throw new Error('User not found');

  const policyRes = await tempClient.get('/api/v1/policy');
  const aclData = JSON.parse(policyRes.data.policy);
  const groups = aclData.groups || {};

  let role: 'admin' | 'manager' | 'viewer' = 'viewer';
  for (const [groupName, members] of Object.entries(groups)) {
    if ((members as string[]).includes(email)) {
      if (groupName === 'group:admin') {
        role = 'admin';
        break;
      } else if (groupName === 'group:manager') {
        role = 'manager';
      }
    }
  }

  return { user: { email, name: user.name, role }, apiKey: headscaleApiKey };
};
