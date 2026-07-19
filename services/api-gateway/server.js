const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

// --- Global error handlers (last resort) ---
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION – keeping server alive:', err.message);
  // Do not exit – keep the process running
});

process.on('unhandledRejection', (reason) => {
  console.error('🔥 UNHANDLED REJECTION – keeping server alive:', reason);
});

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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

// --- Proxy targets (use internal URLs) ---
const VERIFICATION_SERVICE_URL = process.env.VERIFICATION_SERVICE_URL || 'http://medverify-verification:10000';
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://medverify-admin:10000';
const SMS_SERVICE_URL = process.env.SMS_WEBHOOK_URL || 'http://medverify-sms:10000';

// --- Helper: create a proxy with robust error handling ---
function createProxiedMiddleware(target, pathRewrite, routeName) {
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    timeout: 60000,          // 60 seconds
    proxyTimeout: 60000,
    logLevel: 'debug',
  });

  // Attach an error listener directly to the proxy
  proxy.on('error', (err, req, res) => {
    console.error(`🚨 Proxy ${routeName} error:`, err.message);
    if (!res.headersSent) {
      res.status(504).json({ error: `${routeName} service unavailable` });
    }
  });

  // Also catch any other events that might cause crashes
  proxy.on('close', () => {
    console.log(`Proxy ${routeName} closed`);
  });

  return proxy;
}

// --- Apply proxies ---
app.use('/api/verify', createProxiedMiddleware(VERIFICATION_SERVICE_URL, { '^/api/verify': '/verify' }, 'Verification'));
app.use('/api/admin', createProxiedMiddleware(ADMIN_SERVICE_URL, { '^/api/admin': '' }, 'Admin'));
app.use('/api/sms', createProxiedMiddleware(SMS_SERVICE_URL, { '^/api/sms': '/sms' }, 'SMS'));

// --- Fallback ---
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
  console.log(`Verification proxy → ${VERIFICATION_SERVICE_URL}`);
  console.log(`Admin proxy → ${ADMIN_SERVICE_URL}`);
  console.log(`SMS proxy → ${SMS_SERVICE_URL}`);
});