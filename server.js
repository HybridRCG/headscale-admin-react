const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

app.use(express.json());
app.use(cors());

const userTokenMap = new Map();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
};

const getUserRoleFromACL = (email, aclPolicy) => {
  if (!aclPolicy || !aclPolicy.groups) return 'viewer';
  const adminGroups = aclPolicy.tagOwners?.['tag:admin'] || [];
  for (const groupName in aclPolicy.groups) {
    const members = aclPolicy.groups[groupName];
    if (members.includes(email) && adminGroups.includes(groupName)) {
      return 'admin';
    }
  }
  return 'viewer';
};

app.post('/api/auth/login', async (req, res) => {
  const { email, apiKey, headscaleUrl } = req.body;
  if (!email || !apiKey || !headscaleUrl) return res.status(400).json({ message: 'Missing fields' });
  try {
    console.log(`\n[LOGIN] ${email}`);
    await axios.get(`${headscaleUrl}/api/v1/user`, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 5000 });
    console.log('✓ API key validated');
    
    const policyResponse = await axios.get(`${headscaleUrl}/api/v1/policy`, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 5000 });
    let aclPolicy = policyResponse.data;
    if (typeof aclPolicy.policy === 'string') {
      aclPolicy = JSON.parse(aclPolicy.policy);
    }
    
    const role = getUserRoleFromACL(email, aclPolicy);
    console.log(`Final role: ${role}\n`);
    
    const username = email.split('@')[0];
    userTokenMap.set(email, { apiKey, headscaleUrl, validatedAt: Date.now() });
    const sessionToken = jwt.sign({ email, username, role, id: email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ sessionToken, user: { email, username, role, id: email } });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({ message: 'Invalid API key' });
  }
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  if (req.user?.email) userTokenMap.delete(req.user.email);
  res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: { email: req.user?.email, role: req.user?.role, id: req.user?.email } });
});

app.post('/api/headscale/approve-route', authenticateToken, async (req, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) return res.status(401).json({ message: 'Unauthorized' });
  const tokenData = userTokenMap.get(userEmail);
  if (!tokenData) return res.status(401).json({ message: 'Session expired' });
  
  const { nodeId, route } = req.body;
  if (!nodeId || !route) return res.status(400).json({ message: 'Missing nodeId or route' });
  
  try {
    console.log(`\n[APPROVE] Route: ${route}, NodeId: ${nodeId}`);
    
    // First get the node to get current approved routes
    const nodeResponse = await axios.get(
      `${tokenData.headscaleUrl}/api/v1/node/${nodeId}`,
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    
    const node = nodeResponse.data.node;
    const currentApproved = new Set(node.approvedRoutes || []);
    currentApproved.add(route);
    const newRoutes = Array.from(currentApproved);
    
    console.log(`[APPROVE] New approved routes:`, newRoutes);
    
    const response = await axios.post(
      `${tokenData.headscaleUrl}/api/v1/node/${nodeId}/approve_routes`,
      { routes: newRoutes },
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    
    console.log(`[APPROVE] Success (${response.status})`);
    res.json({ message: 'Route approved', data: response.data });
  } catch (error) {
    console.error(`[APPROVE] Error (${error.response?.status}):`, error.message);
    res.status(error.response?.status || 500).json({ message: error.message });
  }
});

app.post('/api/headscale/disapprove-route', authenticateToken, async (req, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) return res.status(401).json({ message: 'Unauthorized' });
  const tokenData = userTokenMap.get(userEmail);
  if (!tokenData) return res.status(401).json({ message: 'Session expired' });
  
  const { nodeId, route } = req.body;
  if (!nodeId || !route) return res.status(400).json({ message: 'Missing nodeId or route' });
  
  try {
    console.log(`\n[DISAPPROVE] Route: ${route}, NodeId: ${nodeId}`);
    
    // First get the node to get current approved routes
    const nodeResponse = await axios.get(
      `${tokenData.headscaleUrl}/api/v1/node/${nodeId}`,
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    
    const node = nodeResponse.data.node;
    const currentApproved = new Set(node.approvedRoutes || []);
    currentApproved.delete(route);
    const newRoutes = Array.from(currentApproved);
    
    console.log(`[DISAPPROVE] New approved routes:`, newRoutes);
    
    const response = await axios.post(
      `${tokenData.headscaleUrl}/api/v1/node/${nodeId}/approve_routes`,
      { routes: newRoutes },
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    
    console.log(`[DISAPPROVE] Success (${response.status})`);
    res.json({ message: 'Route disapproved', data: response.data });
  } catch (error) {
    console.error(`[DISAPPROVE] Error (${error.response?.status}):`, error.message);
    res.status(error.response?.status || 500).json({ message: error.message });
  }
});

app.use('/api/headscale', authenticateToken, async (req, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) return res.status(401).json({ message: 'Unauthorized' });
  const tokenData = userTokenMap.get(userEmail);
  if (!tokenData) return res.status(401).json({ message: 'Session expired' });
  
  const targetPath = req.path.replace('/api/headscale', '');
  const targetUrl = `${tokenData.headscaleUrl}${targetPath}`;
  
  console.log(`Proxying ${req.method} ${req.path} -> ${targetUrl}`);
  
  try {
    const response = await axios({ method: req.method.toLowerCase(), url: targetUrl, headers: { Authorization: `Bearer ${tokenData.apiKey}` }, data: req.body || undefined, timeout: 10000 });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`Proxy error for ${targetUrl}:`, error.message);
    if (error.response) res.status(error.response.status || 500).json({ message: error.response.data?.message || error.message });
    else res.status(500).json({ message: `Proxy error: ${error.message}` });
  }
});

const buildPath = path.join(__dirname, 'build');
app.use('/admin/static', express.static(path.join(buildPath, 'static')));
app.use('/admin', express.static(buildPath, { index: false }));
app.use('/admin', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.get('/', (req, res) => res.redirect('/admin'));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
