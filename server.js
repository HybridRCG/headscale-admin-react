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

app.post('/api/auth/login', async (req, res) => {
  const { email, apiKey, headscaleUrl } = req.body;
  if (!email || !apiKey || !headscaleUrl) return res.status(400).json({ message: 'Missing fields' });
  try {
    await axios.get(`${headscaleUrl}/api/v1/user`, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 5000 });
    const username = email.split('@')[0];
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
    const managerEmails = (process.env.MANAGER_EMAILS || '').split(',').map(e => e.trim());
    let role = 'viewer';
    if (adminEmails.includes(email)) role = 'admin';
    else if (managerEmails.includes(email)) role = 'manager';
    userTokenMap.set(email, { apiKey, headscaleUrl, validatedAt: Date.now() });
    const sessionToken = jwt.sign({ email, username, role, id: email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ sessionToken, user: { email, username, role, id: email } });
  } catch (error) {
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

app.use('/api/headscale', authenticateToken, async (req, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) return res.status(401).json({ message: 'Unauthorized' });
  const tokenData = userTokenMap.get(userEmail);
  if (!tokenData) return res.status(401).json({ message: 'Session expired' });
  const targetPath = req.path;
  const targetUrl = `${tokenData.headscaleUrl}${targetPath}`;
  try {
    const response = await axios({ method: req.method.toLowerCase(), url: targetUrl, headers: { ...req.headers, Authorization: `Bearer ${tokenData.apiKey}` }, data: req.body || undefined, timeout: 10000 });
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) res.status(error.response.status || 500).json({ message: error.response.data?.message || error.message });
    else res.status(500).json({ message: 'Proxy error' });
  }
});

const buildPath = path.join(__dirname, 'build');

app.use('/admin/static', express.static(path.join(buildPath, 'static')));
app.use('/admin', express.static(buildPath, { index: false }));
app.use('/admin', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
