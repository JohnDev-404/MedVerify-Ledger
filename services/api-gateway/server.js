const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS
app.use(cors());

// --- Parse JSON bodies (for POST /login) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  // Success – return a 200 with a success flag
  return res.json({ success: true });
});

// --- Frontend Routes ---
// Login page (GET)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Admin dashboard (main admin page)
app.get('/admin', (req, res) => {
  const isLoggedIn = req.query.loggedIn === 'true' || req.cookies?.isLoggedIn === 'true';

  if (isLoggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } else {
    res.redirect('/login');
  }
});

// Admin dashboard (redirect target from login)
app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
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
      on: {
      error: (err, req, res) => {
        console.error('Admin Proxy Error:', err.message);
        // Prevent the server from crashing
        if (!res.headersSent) {
          res.status(504).json({ error: 'Admin service temporarily unavailable' });
        }
      }
    }
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