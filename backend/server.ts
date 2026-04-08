import express, { Request, Response, NextFunction } from 'express';
import axios, { AxiosError } from 'axios';
import jwt from 'jsonwebtoken';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const HEADSCALE_API_URL = process.env.HEADSCALE_API_URL || 'https://hs.groblers.co.uk';

app.use(express.json());
app.use(cors());

const userTokenMap: Map<string, { apiKey: string; headscaleUrl: string; validatedAt: number }> = new Map();
const TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000;

interface AuthRequest extends Request {
  user?: {
    email: string;
    role: 'admin' | 'manager' | 'viewer';
  };
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
};

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, apiKey, headscaleUrl } = req.body;

  if (!email || !apiKey || !headscaleUrl) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const testResponse = await axios.get(`${headscaleUrl}/api/v1/user`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 5000,
    });

    const username = email.split('@')[0];
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
    const managerEmails = (process.env.MANAGER_EMAILS || '').split(',').map(e => e.trim());
    
    let role: 'admin' | 'manager' | 'viewer' = 'viewer';
    if (adminEmails.includes(email)) {
      role = 'admin';
    } else if (managerEmails.includes(email)) {
      role = 'manager';
    }

    userTokenMap.set(email, {
      apiKey,
      headscaleUrl,
      validatedAt: Date.now(),
    });

    const sessionToken = jwt.sign(
      { email, username, role, id: email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      sessionToken,
      user: {
        email,
        username,
        role,
        id: email,
      },
    });
  } catch (error) {
    console.error('Login validation failed:', error);
    const message = axios.isAxiosError(error)
      ? error.response?.status === 401
        ? 'Invalid API key'
        : error.message
      : 'Validation failed';
    res.status(401).json({ message });
  }
});

app.post('/api/auth/logout', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user?.email) {
    userTokenMap.delete(req.user.email);
  }
  res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({
    user: {
      email: req.user?.email,
      role: req.user?.role,
      id: req.user?.email,
    },
  });
});

app.all('/api/headscale/*', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userEmail = req.user?.email;
  if (!userEmail) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const tokenData = userTokenMap.get(userEmail);
  if (!tokenData) {
    return res.status(401).json({ message: 'Session expired' });
  }

  if (Date.now() - tokenData.validatedAt > 6 * 60 * 60 * 1000) {
    try {
      await axios.get(`${tokenData.headscaleUrl}/api/v1/user`, {
        headers: { Authorization: `Bearer ${tokenData.apiKey}` },
        timeout: 5000,
      });
      tokenData.validatedAt = Date.now();
    } catch (error) {
      userTokenMap.delete(userEmail);
      return res.status(401).json({ message: 'Session expired, please re-login' });
    }
  }

  const targetPath = req.path.replace('/api/headscale', '');
  const targetUrl = `${tokenData.headscaleUrl}${targetPath}`;

  try {
    const axiosConfig = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      headers: {
        ...req.headers,
        Authorization: `Bearer ${tokenData.apiKey}`,
      },
      data: req.body || undefined,
      timeout: 10000,
    };

    delete axiosConfig.headers.host;
    delete axiosConfig.headers['content-length'];

    const response = await axios(axiosConfig);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Headscale proxy error:', error);
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        message: error.response?.data?.message || error.message,
      });
    } else {
      res.status(500).json({ message: 'Proxy error' });
    }
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
  console.log(`JWT_SECRET configured: ${JWT_SECRET === 'dev-secret-change-in-prod' ? '⚠️  USING DEV SECRET' : '✓'}`);
  console.log(`Headscale API: ${HEADSCALE_API_URL}`);
});
