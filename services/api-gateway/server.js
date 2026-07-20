const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios'); // <-- Add this

const app = express();
const PORT = process.env.PORT || 8000;

// --- Global error handlers ---
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION – keeping server alive:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('🔥 UNHANDLED REJECTION – keeping server alive:', reason);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Health check ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Login endpoint ---
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || ':E4-Tz9CpVvqT:4';
app.post('/login', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API key required' });
  if (apiKey !== ADMIN_API_KEY) return res.status(401).json({ error: 'Invalid API key' });
  res.json({ success: true });
});

// --- Frontend routes ---
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin', (req, res) => {
  if (req.query.loggedIn === 'true' || req.cookies?.isLoggedIn === 'true') {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } else {
    res.redirect('/login');
  }
});
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// --- Direct handler for /api/verify (bypasses proxy) ---
const VERIFICATION_SERVICE_URL = process.env.VERIFICATION_SERVICE_URL || 'https://medverify-verification.onrender.com';

app.post('/api/verify', async (req, res) => {
  try {
    const response = await axios.post(`${VERIFICATION_SERVICE_URL}/verify`, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Verification service error:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(504).json({ error: 'Verification service unavailable' });
    }
  }
});

// --- Proxy routes for admin and SMS (keep these) ---
const { createProxyMiddleware } = require('http-proxy-middleware');
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'https://medverify-admin.onrender.com';
const SMS_SERVICE_URL = process.env.SMS_WEBHOOK_URL || 'https://medverify-sms.onrender.com';

app.use(
  '/api/admin',
  createProxyMiddleware({
    target: ADMIN_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/admin': '' },
    timeout: 60000,
    proxyTimeout: 60000,
    logLevel: 'debug',
    on: {
      error: (err, req, res) => {
        console.error('Admin proxy error:', err.message);
        if (!res.headersSent) {
          res.status(504).json({ error: 'Admin service unavailable' });
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
    timeout: 60000,
    proxyTimeout: 60000,
    logLevel: 'debug',
    on: {
      error: (err, req, res) => {
        console.error('SMS proxy error:', err.message);
        if (!res.headersSent) {
          res.status(504).json({ error: 'SMS service unavailable' });
        }
      }
    }
  })
);

// --- Fallback ---
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`✅ Gateway running on port ${PORT}`);
  console.log(`Verification service → ${VERIFICATION_SERVICE_URL}`);
  console.log(`Admin proxy → ${ADMIN_SERVICE_URL}`);
  console.log(`SMS proxy → ${SMS_SERVICE_URL}`);
});