const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');
const http = require('http');
const https = require('https');

// --- Global error handlers ---
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION – keeping server alive:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('🔥 UNHANDLED REJECTION – keeping server alive:', reason);
});

const app = express();
const PORT = process.env.PORT || 8000;

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

// --- Proxy targets ---
const VERIFICATION_SERVICE_URL = process.env.VERIFICATION_SERVICE_URL || 'https://medverify-verification.onrender.com';
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'https://medverify-admin.onrender.com';
const SMS_SERVICE_URL = process.env.SMS_WEBHOOK_URL || 'https://medverify-sms.onrender.com';

// --- Helper: create proxy with keep-alive disabled ---
function createProxiedMiddleware(target, pathRewrite, routeName) {
  // Create an agent that disables keep-alive
  const agent = target.startsWith('https')
    ? new https.Agent({ keepAlive: false })
    : new http.Agent({ keepAlive: false });

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    timeout: 60000,
    proxyTimeout: 60000,
    agent, // <-- This disables keep-alive
    logLevel: 'debug',
    on: {
      error: (err, req, res) => {
        console.error(`🚨 Proxy ${routeName} error:`, err.code, err.message);
        if (!res.headersSent) {
          res.status(504).json({ error: `${routeName} service unavailable (${err.code})` });
        }
      },
      proxyReq: (proxyReq, req, res) => {
        // Catch socket errors
        proxyReq.on('error', (err) => {
          console.error(`🚨 Proxy ${routeName} socket error:`, err.code, err.message);
          if (!res.headersSent) {
            res.status(504).json({ error: `${routeName} connection reset (${err.code})` });
          }
        });
        console.log(`➡️ Proxying ${req.method} ${req.url} → ${target}`);
      },
      proxyRes: (proxyRes, req) => {
        console.log(`⬅️ Proxy ${routeName} response: ${proxyRes.statusCode}`);
      }
    }
  });
}

// --- Apply proxies ---
app.use('/api/verify', createProxiedMiddleware(VERIFICATION_SERVICE_URL, { '^/api/verify': '/verify' }, 'Verification'));
app.use('/api/admin', createProxiedMiddleware(ADMIN_SERVICE_URL, { '^/api/admin': '' }, 'Admin'));
app.use('/api/sms', createProxiedMiddleware(SMS_SERVICE_URL, { '^/api/sms': '/sms' }, 'SMS'));

// --- Fallback ---
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`✅ Gateway running on port ${PORT}`);
  console.log(`Verification proxy → ${VERIFICATION_SERVICE_URL}`);
  console.log(`Admin proxy → ${ADMIN_SERVICE_URL}`);
  console.log(`SMS proxy → ${SMS_SERVICE_URL}`);
});