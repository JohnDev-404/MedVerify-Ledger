const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');   // <-- new

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS
app.use(cors());

// Parse JSON & URL-encoded bodies (for login POST)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Parse cookies
app.use(cookieParser());

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// --- Login endpoint (POST) ---
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || ':E4-Tz9CpVvqT:4';

app.post('/login', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) {
    return res.status(400).json({ error: 'API key required' });
  }
  if (apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  // Set a cookie that expires in 1 hour
  res.cookie('adminLoggedIn', 'true', {
    maxAge: 60 * 60 * 1000, // 1 hour
    httpOnly: true,
    sameSite: 'lax',
  });
  // Also store the key in a secure httpOnly cookie? Not needed; localStorage handles it.
  return res.json({ success: true });
});

// --- Frontend Routes ---
// Login page (GET)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Admin dashboard (GET) – check cookie
app.get('/admin', (req, res) => {
  if (req.cookies.adminLoggedIn === 'true') {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } else {
    res.redirect('/login');
  }
});

// --- Helper: ensure URL has protocol ---
function buildTarget(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

// --- Proxy Routes (configured via environment variables) ---
const VERIFICATION_SERVICE_URL = process.env.VERIFICATION_SERVICE_URL || 'http://verification-service:8001';
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://admin-service:8002';
const SMS_SERVICE_URL = process.env.SMS_WEBHOOK_URL || 'http://sms-webhook-service:8003';

app.use(
  '/api/verify',
  createProxyMiddleware({
    target: VERIFICATION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/verify': '/verify' },
    logLevel: 'debug',
  })
);

app.use(
  '/api/admin',
  createProxyMiddleware({
    target: ADMIN_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/admin': '' },
    logLevel: 'debug',
  })
);

app.use(
  '/api/sms',
  createProxyMiddleware({
    target: SMS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/sms': '/sms' },
    logLevel: 'debug',
  })
);

// --- Fallback: serve index.html ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
  console.log(`Verification proxy → ${VERIFICATION_SERVICE_URL}`);
  console.log(`Admin proxy → ${ADMIN_SERVICE_URL}`);
  console.log(`SMS proxy → ${SMS_SERVICE_URL}`);
});