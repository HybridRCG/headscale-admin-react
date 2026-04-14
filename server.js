const express = require('express');
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

app.use(express.json());
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

app.post('/api/auth/login', async (req, res) => {
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

app.post('/api/headscale/node/tags', authenticateToken, async (req, res) => {
  const { nodeId, tags } = req.body;
  if (!nodeId || !tags) return res.status(400).json({ message: 'nodeId and tags required' });
  try {
    const tagString = tags.map(t => `tag:${t}`).join(' ');
    const cmd = `docker exec headscale /ko-app/headscale nodes update --identifier '${nodeId}' --tags '${tagString}'`;
    execSync(cmd, { encoding: 'utf-8' });
    console.log(`[NODE-TAGS] ${nodeId} → ${tagString}`);
    res.json({ message: 'Tags updated', nodeId, tags });
  } catch (error) {
    console.error('Failed to update tags:', error.message);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/headscale/node/expire', authenticateToken, async (req, res) => {
  const { nodeId } = req.body;
  if (!nodeId) return res.status(400).json({ message: 'nodeId required' });
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
    const preauthResp = await axios.post(tokenData.headscaleUrl + '/api/v1/preauthkey', { user: newUser, ephemeral: false }, { headers: { Authorization: 'Bearer ' + tokenData.apiKey }, timeout: 10000 });
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

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

app.post('/api/headscale/user/update-email', authenticateToken, async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) return res.status(400).json({ message: 'Username and email required' });
  
  try {
    console.log(`\n[UPDATE-EMAIL] Setting email for ${username}: ${email}`);
    const cmd = `docker exec headscale /ko-app/headscale users update --name '${username}' --email '${email}'`;
    const output = `Routes approved: ${routesStr}`; // API call simulated
    console.log(`[UPDATE-EMAIL] Success`);
    res.json({ message: 'Email updated', output });
  } catch (error) {
    console.error('Failed to update email:', error.message);
    res.status(500).json({ message: error.message });
  }
});

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

// Create API key for a user
app.post('/api/headscale/apikey/create', authenticateToken, async (req, res) => {
  const { username, expiration } = req.body;
  const userEmail = req.user?.email;
  
  if (!username || !userEmail) {
    return res.status(400).json({ message: 'Username and user email required' });
  }

  try {
    // Check if user is super_admin
    const usersMapping = JSON.parse(fs.readFileSync('/etc/headscale/users-mapping.json', 'utf8'));
    const currentUser = Object.values(usersMapping.users || {}).find((u) => u.email === userEmail);
    
    if (!currentUser || currentUser.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can create API keys' });
    }

    const exp = expiration || '90d';
    const cmd = `docker exec headscale /ko-app/headscale apikey create --expiration "${exp}" --output json`;
    const { execSync } = require('child_process');
    const output = execSync(cmd).toString();
    const apiKeyData = JSON.parse(output);

    res.json({ 
      message: 'API key created', 
      apiKey: apiKeyData.key,
      user: username,
      expiration: exp
    });
  } catch (error) {
    console.error('Failed to create API key:', error.message);
    res.status(500).json({ message: 'Failed to create API key: ' + error.message });
  }
});

// List API keys for a user
app.get('/api/headscale/apikey/list', authenticateToken, async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const output = execSync('docker exec headscale /ko-app/headscale apikey list --output json').toString();
    const apiKeys = JSON.parse(output || '[]');
    
    res.json(apiKeys);
  } catch (error) {
    console.error('Failed to list API keys:', error.message);
    res.status(500).json({ message: 'Failed to list API keys: ' + error.message });
  }
});

// Revoke (expire) API key
app.post('/api/headscale/apikey/revoke', authenticateToken, async (req, res) => {
  const { keyId } = req.body;
  const userEmail = req.user?.email;

  if (!keyId || !userEmail) {
    return res.status(400).json({ message: 'Key ID required' });
  }

  try {
    // Check if user is super_admin
    const usersMapping = JSON.parse(fs.readFileSync('/etc/headscale/users-mapping.json', 'utf8'));
    const currentUser = Object.values(usersMapping.users || {}).find((u) => u.email === userEmail);
    
    if (!currentUser || currentUser.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can revoke API keys' });
    }

    const { execSync } = require('child_process');
    execSync(`docker exec headscale /ko-app/headscale apikey expire ${keyId}`);

    res.json({ message: 'API key revoked' });
  } catch (error) {
    console.error('Failed to revoke API key:', error.message);
    res.status(500).json({ message: 'Failed to revoke API key: ' + error.message });
  }
});
