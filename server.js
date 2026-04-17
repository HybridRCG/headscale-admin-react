const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const HEADSCALE_URL = process.env.HEADSCALE_URL || 'http://headscale:8080';


// ── Auto-create users-mapping.json if it doesn't exist ──────────────────
const USERS_MAPPING_PATH = '/etc/headscale/users-mapping.json';
const defaultUsersMapping = {
  users: {
    "admin": {
      email: "admin@yourdomain.com",
      role: "super_admin",
      manageable_domains: ["*"]
    }
  },
  api_key_labels: {}
};

if (!fs.existsSync(USERS_MAPPING_PATH)) {
  try {
    fs.mkdirSync('/etc/headscale', { recursive: true });
    fs.writeFileSync(USERS_MAPPING_PATH, JSON.stringify(defaultUsersMapping, null, 2));
    console.log('[INIT] Created default users-mapping.json at', USERS_MAPPING_PATH);
    console.log('[INIT] Default admin user created - update email and username to match your Headscale user');
  } catch (err) {
    console.error('[INIT] Could not create users-mapping.json:', err.message);
  }
} else {
  console.log('[INIT] users-mapping.json found at', USERS_MAPPING_PATH);
}

app.use(express.json());

// Rate limit login to 20 attempts per 15 minutes per IP
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many login attempts, try again later' } });
app.use(cors());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

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

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, apiKey } = req.body;
  const headscaleUrl = HEADSCALE_URL;
  if (!username || !apiKey) return res.status(400).json({ message: 'Missing fields: username, apiKey' });
  try {
    console.log(`\n[LOGIN] ${username}`);
    await axios.get(`${headscaleUrl}/api/v1/user`, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 5000 });
    console.log('✓ API key validated');
    
    console.log('[LOGIN] Fetching policy...');
    const policyResponse = await axios.get(`${headscaleUrl}/api/v1/policy`, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 5000 });
    let aclPolicy = policyResponse.data;
    if (typeof aclPolicy.policy === 'string') {
      aclPolicy = JSON.parse(aclPolicy.policy);
    }
    
    console.log('[LOGIN] ACL Policy users:', Object.keys(aclPolicy.users || {}));
    let usersMapping;
    try {
      usersMapping = JSON.parse(fs.readFileSync('/etc/headscale/users-mapping.json', 'utf8'));
      console.log('[LOGIN] Users mapping loaded:', Object.keys(usersMapping.users || {}));
    } catch (err) {
      console.error('[LOGIN] Failed to load users mapping:', err.message);
      return res.status(500).json({ message: 'Failed to load users mapping' });
    }
    const userRecord = usersMapping.users?.[username];
    const email = userRecord?.email;
    console.log(`[LOGIN] Looking up email for username: ${username}`);
    if (!email) return res.status(400).json({ message: `Username "${username}" not found in ACL users mapping` });
    // Get role from users-mapping.json (not from ACL policy)
    const currentUser = Object.values(usersMapping.users || {}).find((u) => u.email === email);
    const role = currentUser?.role || 'user';
    
    userTokenMap.set(email, { apiKey, headscaleUrl, validatedAt: Date.now() });
    const manageable_domains = currentUser?.manageable_domains || [];
    const sessionToken = jwt.sign({ email, username, role, id: email, manageable_domains }, JWT_SECRET, { expiresIn: '24h' });
    console.log(`[LOGIN SUCCESS] ${username} (${email}) role: ${role}`);
    logAudit(username, 'login', `${username} logged in`, `role: ${role}`);
    res.json({ sessionToken, user: { email, username, role, id: email, manageable_domains } });
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
  try {
    const usersMapping = JSON.parse(fs.readFileSync('/etc/headscale/users-mapping.json', 'utf8'));
    // Try username first, fall back to email lookup for old tokens
    let username = req.user?.username;
    let userRecord = usersMapping.users?.[username];
    if (!userRecord && req.user?.email) {
      const entry = Object.entries(usersMapping.users || {}).find(([_, u]) => u.email === req.user.email);
      if (entry) { username = entry[0]; userRecord = entry[1]; }
    }
    userRecord = userRecord || {};
    const role = userRecord.role || req.user?.role || 'user';
    const manageable_domains = userRecord.manageable_domains || req.user?.manageable_domains || [];
    res.json({ user: { email: req.user?.email, username, role, id: req.user?.email, manageable_domains } });
  } catch (err) {
    res.json({ user: { email: req.user?.email, role: req.user?.role, id: req.user?.email, manageable_domains: req.user?.manageable_domains || [] } });
  }
});

app.post('/api/headscale/approve-route', authenticateToken, async (req, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) return res.status(401).json({ message: 'Unauthorized' });
  const tokenData = userTokenMap.get(userEmail);
  if (!tokenData) return res.status(401).json({ message: 'Session expired' });
  const { nodeId, route } = req.body;
  if (!nodeId || !route) return res.status(400).json({ message: 'Missing nodeId or route' });
  try {
    console.log(`[APPROVE] Route: ${route}, NodeId: ${nodeId}`);
    const nodeResponse = await axios.get(
      `${tokenData.headscaleUrl}/api/v1/node/${nodeId}`,
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    const node = nodeResponse.data.node;
    const newApproved = [...new Set([...(node.approvedRoutes || []), route])];
    console.log(`[APPROVE] Calling API with routes: ${newApproved.join(', ')}`);
    const updateResponse = await axios.post(
      `${tokenData.headscaleUrl}/api/v1/node/${nodeId}/approve_routes`,
      { routes: newApproved },
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    console.log(`[APPROVE] Success`);
    res.json({ message: 'Route approved', node: updateResponse.data.node });
  } catch (error) {
    console.error(`[APPROVE] Error:`, error.message);
    res.status(500).json({ message: error.message });
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
    console.log(`[DISAPPROVE] Route: ${route}, NodeId: ${nodeId}`);
    const nodeResponse = await axios.get(
      `${tokenData.headscaleUrl}/api/v1/node/${nodeId}`,
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    const node = nodeResponse.data.node;
    const newApproved = (node.approvedRoutes || []).filter(r => r !== route);
    console.log(`[DISAPPROVE] Calling API with routes: ${newApproved.join(', ')}`);
    const updateResponse = await axios.post(
      `${tokenData.headscaleUrl}/api/v1/node/${nodeId}/approve_routes`,
      { routes: newApproved },
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    console.log(`[DISAPPROVE] Success`);
    res.json({ message: 'Route disapproved', node: updateResponse.data.node });
  } catch (error) {
    console.error(`[DISAPPROVE] Error:`, error.message);
    res.status(500).json({ message: error.message });
  }
});



app.post('/api/headscale/user/create', authenticateToken, async (req, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) return res.status(401).json({ message: 'Unauthorized' });
  const tokenData = userTokenMap.get(userEmail);
  if (!tokenData) return res.status(401).json({ message: 'Session expired' });
  
  const { username, email } = req.body;
  if (!username) return res.status(400).json({ message: 'Username required' });
  
  try {
    console.log(`\n[CREATE-USER] Creating user: ${username}`);
    const userResponse = await axios.post(
      `${tokenData.headscaleUrl}/api/v1/user`,
      { name: username },
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    console.log(`[CREATE-USER] User created successfully`);
    
    // If email provided, set it via CLI
    if (email && email.trim()) {
      try {
        console.log(`[CREATE-USER] Setting email via CLI: ${email}`);
        const cmd = `docker exec headscale /ko-app/headscale users rename --name '${username}' --new-name '${username}'`;
        execSync(cmd, { encoding: 'utf-8' });
        console.log(`[CREATE-USER] User renamed (preparing for email)`);
      } catch (cliError) {
        console.error(`[CREATE-USER] Warning: Could not set email via CLI`, cliError.message);
      }
    }
    
    res.json({ message: 'User created successfully', username, email });
  } catch (error) {
    console.error('Failed to create user:', error.message);
    res.status(500).json({ message: error.message });
  }
});


// DNS Configuration Endpoints
const HEADSCALE_CONFIG_PATH = '/etc/headscale/config.yaml';
const execHeadscaleCommand = (cmd) => execSync(`docker exec headscale ${cmd}`, { encoding: 'utf-8' });

// DNS Configuration Endpoints
app.get('/api/config/dns', authenticateToken, async (req, res) => {
  try {
    const configContent = fs.readFileSync('/etc/headscale/config.yaml', 'utf8');
    const yaml = require('js-yaml');
    const config = yaml.load(configContent);
    const dnsConfig = {
      tailnetName: config.dns?.base_domain || 'tailnet.local',
      magicDns: config.dns?.magic_dns ?? true,
      overrideLocalDns: config.dns?.override_local_dns ?? true,
      nameservers: config.dns?.nameservers?.global || [],
      searchDomains: config.dns?.search_domains || [],
      splitDns: config.dns?.nameservers?.split || {},
      extraRecords: config.dns?.extra_records || []
    };
    res.json(dnsConfig);
  } catch (error) {
    console.error('Failed to read DNS config:', error.message);
    res.status(500).json({ message: `Failed to read DNS config: ${error.message}` });
  }
});

app.post('/api/config/dns', authenticateToken, async (req, res) => {
  try {
    const yaml = require('js-yaml');
    const { tailnetName, magicDns, overrideLocalDns, nameservers, searchDomains, splitDns, extraRecords } = req.body;
    const configContent = fs.readFileSync('/etc/headscale/config.yaml', 'utf8');
    const config = yaml.load(configContent);
    config.dns = {
      base_domain: tailnetName || 'tailnet.local',
      magic_dns: magicDns !== undefined ? magicDns : true,
      override_local_dns: overrideLocalDns !== undefined ? overrideLocalDns : true,
      nameservers: {
        global: nameservers || [],
        split: splitDns || {}
      },
      search_domains: searchDomains || [],
      extra_records: extraRecords || []
    };
    const updatedConfig = yaml.dump(config);
    fs.writeFileSync('/etc/headscale/config.yaml', updatedConfig, 'utf8');
    console.log('[DNS-CONFIG] Updated DNS configuration');
    res.json({ message: 'DNS configuration updated', config: config.dns });
  } catch (error) {
    console.error('Failed to update DNS config:', error.message);
    res.status(500).json({ message: `Failed to update DNS config: ${error.message}` });
  }
});


// Nodes Management Endpoints
app.post('/api/headscale/node/rename', authenticateToken, async (req, res) => {
  const { nodeId, newName } = req.body;
  if (!nodeId || !newName) return res.status(400).json({ message: 'nodeId and newName required' });
  try {
    const userEmail = req.user.email;
    const tokenData = userTokenMap.get(userEmail);
    if (!tokenData) return res.status(401).json({ message: 'Session expired' });
    const response = await axios.post(`${tokenData.headscaleUrl}/api/v1/node/${nodeId}/rename`, { name: newName }, { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 });
    console.log(`[NODE-RENAME] ${nodeId} → ${newName}`);
    res.json({ message: 'Node renamed', nodeId, newName, node: response.data.node });
  } catch (error) {
    console.error('Failed to rename node:', error.message);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/headscale/node/delete', authenticateToken, async (req, res) => {
  const { nodeId } = req.body;
  if (!nodeId) return res.status(400).json({ message: 'nodeId required' });
  if (!/^[0-9]+$/.test(String(nodeId))) return res.status(400).json({ message: 'Invalid nodeId' });
  try {
    const cmd = `docker exec headscale /ko-app/headscale nodes delete --identifier '${nodeId}' --force`;
    execSync(cmd, { encoding: 'utf-8' });
    console.log(`[NODE-DELETE] ${nodeId}`);
    res.json({ message: 'Node deleted', nodeId });
  } catch (error) {
    console.error('Failed to delete node:', error.message);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/headscale/node/expire', authenticateToken, async (req, res) => {
  const { nodeId } = req.body;
  if (!nodeId) return res.status(400).json({ message: 'nodeId required' });
  if (!/^[0-9]+$/.test(String(nodeId))) return res.status(400).json({ message: 'Invalid nodeId' });
  try {
    const cmd = `docker exec headscale /ko-app/headscale nodes update --identifier '${nodeId}' --expiration now`;
    execSync(cmd, { encoding: 'utf-8' });
    console.log(`[NODE-EXPIRE] ${nodeId}`);
    res.json({ message: 'Node expired', nodeId });
  } catch (error) {
    console.error('Failed to expire node:', error.message);
    res.status(500).json({ message: error.message });
  }
});
app.get('/api/headscale/user-mapping', authenticateToken, async (req, res) => {
  const userEmail = req.user.email;
  const tokenData = userTokenMap.get(userEmail);
  if (!tokenData) return res.status(401).json({ message: 'Session expired' });
  try {
    const policyResp = await axios.get(`${tokenData.headscaleUrl}/api/v1/policy`, { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 });
    let policy = policyResp.data;
    if (typeof policy.policy === 'string') policy = JSON.parse(policy.policy);
    const usersResp = await axios.get(`${tokenData.headscaleUrl}/api/v1/user`, { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 });
    const map = {};
    const groups = policy.groups || {};
    Object.values(groups).forEach(emails => {
      emails.forEach(email => {
        const user = usersResp.data.users.find(u => u.email === email);
        if (user) map[user.name] = email;
      });
    });
    usersResp.data.users.forEach(user => {
      if (user.email && !map[user.name]) map[user.name] = user.email;
    });
    // Fallback: fill in emails from users-mapping.json for users with no headscale email
    try {
      const usersMapping = JSON.parse(fs.readFileSync('/etc/headscale/users-mapping.json', 'utf8'));
      Object.entries(usersMapping.users || {}).forEach(([username, record]) => {
        if (record.email && !map[username]) map[username] = record.email;
      });
    } catch (e) { /* mapping file optional */ }
    console.log('[USER-MAPPING] Generated:', Object.keys(map).length, 'users');
    res.json(map);
  } catch (e) {
    console.error('[USER-MAPPING]', e.message);
    res.status(500).json({ message: e.message });
  }
});

// Move node to different user - proper Headscale workflow
// This deletes the node and returns instructions for re-registration under new user


// Move node to different user - proper Headscale workflow
// This deletes the node and returns instructions for re-registration under new user
app.post('/api/headscale/node/move-user', authenticateToken, async (req, res) => {
  const { nodeId, newUser } = req.body;
  if (!nodeId || !newUser) return res.status(400).json({ message: 'nodeId and newUser required' });
  try {
    const userEmail = req.user.email;
    const tokenData = userTokenMap.get(userEmail);
    if (!tokenData) return res.status(401).json({ message: 'Session expired' });
    const usersResp = await axios.get(tokenData.headscaleUrl + '/api/v1/user', { headers: { Authorization: 'Bearer ' + tokenData.apiKey }, timeout: 10000 });
    const targetUser = usersResp.data.users.find(u => u.name === newUser);
    if (!targetUser) return res.status(400).json({ message: 'User not found' });
    const nodesResp = await axios.get(tokenData.headscaleUrl + '/api/v1/node', { headers: { Authorization: 'Bearer ' + tokenData.apiKey }, timeout: 10000 });
    const node = nodesResp.data.nodes.find(n => n.id.toString() === nodeId.toString());
    if (!node) return res.status(400).json({ message: 'Node not found' });
    await axios.delete(tokenData.headscaleUrl + '/api/v1/node/' + nodeId, { headers: { Authorization: 'Bearer ' + tokenData.apiKey }, timeout: 10000 });
    const preauthResp = await axios.post(tokenData.headscaleUrl + '/api/v1/preauthkey', { user: parseInt(targetUser.id, 10), ephemeral: false, expiration: new Date(Date.now() + 90*24*60*60*1000).toISOString() }, { headers: { Authorization: 'Bearer ' + tokenData.apiKey }, timeout: 10000 });
    const newKey = preauthResp.data.pre_auth_key.key;
    console.log('[NODE-MOVE-USER] Node ' + nodeId + ' (' + node.hostname + ') deleted. New pre-auth key created for user ' + newUser);
    res.json({ message: 'Node deleted and new pre-auth key created', nodeId, hostname: node.hostname, newUser, newKey, instructions: 'Device must reconnect with: tailscale login --auth-key=' + newKey });
  } catch (error) {
    console.error('Failed to move node to user:', error.message);
    res.status(500).json({ message: error.message });
  }
});


// ACL Management Endpoints
app.get('/api/headscale/acl', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const tokenData = userTokenMap.get(userEmail);
    if (!tokenData) return res.status(401).json({ message: 'Session expired' });
    const policyResp = await axios.get(`${tokenData.headscaleUrl}/api/v1/policy`, { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 });
    let policy = policyResp.data.policy;
    if (typeof policy === 'string') policy = JSON.parse(policy);
    res.json(policy);
  } catch (error) {
    console.error('Failed to get ACL:', error.message);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/headscale/acl', authenticateToken, async (req, res) => {
  const { groups, tagOwners, hosts, acls, ssh } = req.body;
  try {
    const userEmail = req.user.email;
    const tokenData = userTokenMap.get(userEmail);
    if (!tokenData) return res.status(401).json({ message: 'Session expired' });
    const policy = { groups, tagOwners, hosts, acls, ssh };
    const updateResp = await axios.post(`${tokenData.headscaleUrl}/api/v1/policy`, { policy: JSON.stringify(policy) }, { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 });
    console.log('[ACL] Policy updated');
    res.json({ message: 'ACL updated', policy });
  } catch (error) {
    console.error('Failed to update ACL:', error.message);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/headscale/user-emails', authenticateToken, async (req, res) => {
  try {
    const data = fs.readFileSync('/etc/headscale/users-mapping.json', 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ message: 'Failed to read users' });
  }
});


// GET api key labels from mapping file
app.get('/api/headscale/apikey/labels', authenticateToken, (req, res) => {
  try {
    const mapping = JSON.parse(fs.readFileSync('/etc/headscale/users-mapping.json', 'utf8'));
    res.json({ labels: mapping.api_key_labels || {}, owners: mapping.api_key_owners || {} });
  } catch (e) {
    res.json({ labels: {}, owners: {} });
  }
});

// POST update a label for an api key prefix
app.post('/api/headscale/apikey/label', authenticateToken, (req, res) => {
  const { prefix, label } = req.body;
  if (!prefix) return res.status(400).json({ message: 'prefix required' });
  try {
    const mapping = JSON.parse(fs.readFileSync('/etc/headscale/users-mapping.json', 'utf8'));
    if (!mapping.api_key_labels) mapping.api_key_labels = {};
    if (label === null || label === '') {
      delete mapping.api_key_labels[prefix];
    } else {
      mapping.api_key_labels[prefix] = label;
    }
    fs.writeFileSync('/etc/headscale/users-mapping.json', JSON.stringify(mapping, null, 2));
    res.json({ success: true, labels: mapping.api_key_labels });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// Group admin creates an API key for a user in their domain
app.post('/api/headscale/apikey/create-for-user', authenticateToken, async (req, res) => {
  const { targetUsername, label, expiryDays } = req.body;
  const adminEmail = req.user?.email;
  const adminUsername = req.user?.username;
  if (!targetUsername) return res.status(400).json({ message: 'targetUsername required' });
  try {
    const mapping = JSON.parse(fs.readFileSync('/etc/headscale/users-mapping.json', 'utf8'));
    const adminRecord = mapping.users?.[adminUsername] || {};
    const targetRecord = mapping.users?.[targetUsername] || {};
    // Check admin has permission for this user's domain
    const adminDomains = adminRecord.manageable_domains || [];
    const targetEmail = targetRecord.email || '';
    const canManage = adminDomains.includes('*') || adminDomains.some(d => targetEmail.endsWith(d.replace('@','')));
    if (!canManage) return res.status(403).json({ message: 'Not authorized to manage this user' });
    // Get the admin's API key to create the new key
    const tokenData = userTokenMap.get(adminEmail);
    if (!tokenData) return res.status(401).json({ message: 'Session expired' });
    // Create the API key via headscale
    const days = expiryDays || 90;
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + days);
    // Get user ID for the target user
    const allUsersResp = await axios.get(`${tokenData.headscaleUrl}/api/v1/user`, { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 });
    const targetUserObj = allUsersResp.data.users?.find((u) => u.name === targetUsername);
    if (!targetUserObj) return res.status(400).json({ message: `User ${targetUsername} not found` });
    const createResp = await axios.post(
      `${tokenData.headscaleUrl}/api/v1/apikey`,
      { expiration: expDate.toISOString() },
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    const newKey = createResp.data.apiKey;
    // Auto-label with target username
    const autoLabel = label || `${targetUsername} - Login Key`;
    // Get prefix from key list
    const keysResp = await axios.get(`${tokenData.headscaleUrl}/api/v1/apikey`, { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 });
    const keys = keysResp.data.apiKeys || [];
    // Find the newest key (just created)
    const newestKey = keys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (newestKey) {
      if (!mapping.api_key_labels) mapping.api_key_labels = {};
      mapping.api_key_labels[newestKey.prefix] = autoLabel;
      fs.writeFileSync('/etc/headscale/users-mapping.json', JSON.stringify(mapping, null, 2));
    }
    res.json({ apiKey: newKey, label: autoLabel, prefix: newestKey?.prefix });
  } catch (e) {
    console.error('[CREATE-FOR-USER]', e.message);
    res.status(500).json({ message: e.message });
  }
});



// ── Update checker ──────────────────────────────────────────────────────────
app.get('/api/headscale/check-update', authenticateToken, async (req, res) => {
  try {
    const currentVersion = require('./build/static/js/main.*.js') || '';
    // Fetch latest commit from GitHub API
    const ghResp = await axios.get(
      'https://api.github.com/repos/HybridRCG/headscale-admin-react/commits/main',
      { headers: { 'User-Agent': 'hs-react-update-check' }, timeout: 5000 }
    );
    // Get version from latest commit message
    const commitMsg = ghResp.data.commit?.message || '';
    const match = commitMsg.match(/v(\d+\.\d+\.\d+)/);
    const latestVersion = match ? match[1] : null;
    res.json({ latestVersion, currentVersion: process.env.APP_VERSION || null });
  } catch (e) {
    res.json({ latestVersion: null, error: e.message });
  }
});

// ── Registration / Licensing ────────────────────────────────────────────────
const HS_LICENSE_SECRET = process.env.HS_LICENSE_SECRET || 'CHANGE-THIS-TO-YOUR-PRIVATE-SECRET-MIN-32-CHARS';
const REGISTRATION_FILE = '/etc/headscale/registration.json';

function readRegistration() {
  try { return JSON.parse(fs.readFileSync(REGISTRATION_FILE, 'utf8')); }
  catch { return { registered: false }; }
}

function validateLicenseKey(key) {
  try {
    // Format: HSR-{CLIENTNAME}-{YEAR}-{12char HMAC}
    const parts = key.trim().split('-');
    if (parts.length < 4 || parts[0] !== 'HSR') return null;
    const hmacPart = parts[parts.length - 1];
    const payload = parts.slice(1, parts.length - 1).join('-');
    const expected = require('crypto')
      .createHmac('sha256', HS_LICENSE_SECRET)
      .update(payload)
      .digest('hex')
      .substring(0, 12)
      .toUpperCase();
    if (hmacPart !== expected) return null;
    return { valid: true, payload };
  } catch { return null; }
}

app.post('/api/headscale/register', authenticateToken, (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ message: 'License key required' });
  const result = validateLicenseKey(key);
  if (!result) return res.status(400).json({ message: 'Invalid license key' });
  try {
    const reg = { registered: true, key: key.trim(), payload: result.payload, registeredAt: new Date().toISOString() };
    fs.writeFileSync(REGISTRATION_FILE, JSON.stringify(reg, null, 2));
    // Log to instances file for tracking
    const instances = readInstances();
    const existingIdx = instances.findIndex(i => i.payload === result.payload);
    const instanceEntry = { payload: result.payload, registeredAt: new Date().toISOString(), domain: req.headers.host || 'unknown' };
    if (existingIdx >= 0) instances[existingIdx] = instanceEntry;
    else instances.push(instanceEntry);
    try { fs.writeFileSync(INSTANCES_FILE, JSON.stringify(instances, null, 2)); } catch(e) {}
    logAudit(req.user.username, 'register', 'instance registration', result.payload);
    console.log('[REGISTER] Instance registered:', result.payload);
    res.json({ success: true, payload: result.payload });
  } catch (e) {
    res.status(500).json({ message: 'Failed to save registration: ' + e.message });
  }
});

app.get('/api/headscale/registration', authenticateToken, (req, res) => {
  const reg = readRegistration();
  res.json(reg);
});

app.post('/api/headscale/unregister', authenticateToken, (req, res) => {
  try {
    fs.writeFileSync(REGISTRATION_FILE, JSON.stringify({ registered: false }, null, 2));
    logAudit(req.user.username, 'unregister', 'instance unregistered', '');
    console.log('[UNREGISTER] Instance unregistered');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: 'Failed to unregister: ' + e.message });
  }
});


// ── Registered Instances Log ────────────────────────────────────────────────
const INSTANCES_FILE = '/etc/headscale/registered-instances.json';

function readInstances() {
  try { return JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf8')); }
  catch { return []; }
}

app.get('/api/headscale/instances', authenticateToken, (req, res) => {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ message: 'Forbidden' });
  res.json(readInstances());
});

// ── Audit Log ──────────────────────────────────────────────────────────────
const AUDIT_LOG_PATH = '/etc/headscale/audit-log.json';

function readAuditLog() {
  try {
    return JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf8'));
  } catch { return []; }
}

function writeAuditLog(entries) {
  // Keep last 1000 entries
  const trimmed = entries.slice(-1000);
  fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(trimmed, null, 2));
}

function logAudit(actor, action, target, details) {
  const entries = readAuditLog();
  entries.push({
    id: Date.now().toString() + Math.random().toString(36).substr(2,5),
    timestamp: new Date().toISOString(),
    actor: actor || 'unknown',
    action,
    target,
    details: details || ''
  });
  writeAuditLog(entries);
}


app.delete('/api/headscale/audit-log', authenticateToken, (req, res) => {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify([], null, 2));
    logAudit(req.user.username, 'clear', 'audit log', 'all entries cleared');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/headscale/audit-log/export', authenticateToken, (req, res) => {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    const logs = readAuditLog();
    const csv = [
      'Timestamp,Actor,Action,Target,Details',
      ...logs.map(l => [
        l.timestamp, l.actor, l.action,
        `"${(l.target||'').replace(/"/g,'""')}"`,
        `"${(l.details||'').replace(/"/g,'""')}"`
      ].join(','))
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/headscale/audit-log', authenticateToken, (req, res) => {
  const entries = readAuditLog();
  // Filter by manageable_domains for non-super_admins
  res.json(entries.reverse()); // newest first
});


// Create pre-auth key - properly handles user lookup
app.post('/api/headscale/preauthkey/create', authenticateToken, async (req, res) => {
  const { userId, reusable, ephemeral, expiration, tags } = req.body;
  if (!userId) return res.status(400).json({ message: 'userId required' });
  try {
    const userEmail = req.user.email;
    const tokenData = userTokenMap.get(userEmail);
    if (!tokenData) return res.status(401).json({ message: 'Session expired' });

    // Find user by id or name
    const usersResp = await axios.get(`${tokenData.headscaleUrl}/api/v1/user`, { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 });
    const allUsers = usersResp.data.users || [];
    const targetUser = allUsers.find(u => String(u.id) === String(userId) || u.name === userId);
    if (!targetUser) return res.status(400).json({ message: `User not found: ${userId}` });

    // headscale v0.28 requires numeric user ID as string for the user field
    // headscale v0.28 REST API requires user as uint64 (numeric ID)
    const expDate = expiration ? new Date(expiration) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    if (expDate <= new Date()) expDate.setDate(expDate.getDate() + 90);
    const payload = {
      user: parseInt(targetUser.id, 10),
      reusable: !!reusable,
      ephemeral: !!ephemeral,
      expiration: expDate.toISOString(),
    };
    if (tags && tags.length > 0) payload.aclTags = tags;
    console.log('[PREAUTHKEY-CREATE] user id:', targetUser.id, 'expiry:', expDate.toISOString());

    const resp = await axios.post(
      `${tokenData.headscaleUrl}/api/v1/preauthkey`,
      payload,
      { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
    );
    const key = resp.data.preAuthKey?.key || resp.data.pre_auth_key?.key || '';
    logAudit(req.user.username, 'create-preauthkey', `user: ${targetUser.name}`, `reusable:${reusable} ephemeral:${ephemeral}`);
    res.json({ key, user: targetUser.name });
  } catch (e) {
    console.error('[PREAUTHKEY-CREATE]', e.response?.data || e.message);
    res.status(500).json({ message: e.response?.data?.message || e.message });
  }
});


// Expire a pre-auth key - uses key ID via headscale CLI
app.post('/api/headscale/preauthkey/expire', authenticateToken, async (req, res) => {
  const { user, key, id } = req.body;
  if (!id && !key) return res.status(400).json({ message: 'id or key required' });
  try {
    const userEmail = req.user.email;
    const tokenData = userTokenMap.get(userEmail);
    if (!tokenData) return res.status(401).json({ message: 'Session expired' });

    // If we have an ID use it, otherwise find it via the API
    let keyId = id;
    if (!keyId && user && key) {
      const keysResp = await axios.get(
        `${tokenData.headscaleUrl}/api/v1/preauthkey?user=${encodeURIComponent(user)}`,
        { headers: { Authorization: `Bearer ${tokenData.apiKey}` }, timeout: 10000 }
      );
      const found = (keysResp.data.preAuthKeys || []).find(k => k.key === key);
      if (!found) return res.status(404).json({ message: 'Key not found' });
      keyId = found.id;
    }

    // Use headscale CLI to expire by ID
    if (!/^[0-9]+$/.test(String(keyId))) return res.status(400).json({ message: 'Invalid key id' });
    execSync(`docker exec headscale /ko-app/headscale preauthkeys expire --id ${keyId}`, { timeout: 10000 });
    logAudit(req.user.username, 'expire-preauthkey', `user: ${user}`, `id: ${keyId}`);
    res.json({ success: true });
  } catch (e) {
    console.error('[PREAUTHKEY-EXPIRE]', e.response?.data || e.message);
    res.status(500).json({ message: e.response?.data?.message || e.message });
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
app.use('/static', express.static(path.join(buildPath, 'static')));
app.use('/', express.static(buildPath, { index: false }));
app.use('/', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

;

// NOTE: app.listen moved to end of file

// update-email endpoint removed (was broken - used undefined routesStr)

// GET user emails and permissions

// POST user emails and permissions
app.post('/api/headscale/user-emails', authenticateToken, async (req, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const currentData = JSON.parse(fs.readFileSync('/etc/headscale/users-mapping.json', 'utf8'));
    const currentUser = Object.values(currentData.users).find(u => u.email === userEmail);
    
    if (!currentUser || currentUser.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can modify users' });
    }

    const newData = req.body;
    fs.writeFileSync('/etc/headscale/users-mapping.json', JSON.stringify(newData, null, 2));
    res.json({ message: 'Users updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update users: ' + err.message });
  }
});


app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// apikey/create endpoint removed (superseded by create-for-user)
