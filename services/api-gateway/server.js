const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS
app.use(cors());

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// --- Frontend Routes (example) ---
// Login page at /login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Admin dashboard at /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- Proxy Routes (configured via environment variables) ---

// 1. Verification Service
const VERIFICATION_SERVICE_URL = process.env.VERIFICATION_SERVICE_URL || 'http://verification-service:8001';
app.use(
  '/api/verify',
  createProxyMiddleware({
    target: VERIFICATION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/verify': '/verify' },
    logLevel: 'debug', // helpful to see proxy activity in logs
  })
);

// 2. Admin Service
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://admin-service:8002';
app.use(
  '/api/admin',
  createProxyMiddleware({
    target: ADMIN_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/admin': '' },
    logLevel: 'debug',
  })
);

// 3. SMS Webhook Service
const SMS_SERVICE_URL = process.env.SMS_WEBHOOK_URL || 'http://sms-webhook-service:8003';
app.use(
  '/api/sms',
  createProxyMiddleware({
    target: SMS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/sms': '/sms' },
    logLevel: 'debug',
  })
);

function buildTarget(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `http://${url}`;
}

const VERIFICATION_SERVICE_URL = buildTarget(process.env.VERIFICATION_SERVICE_URL) || 'http://verification-service:8001';
const ADMIN_SERVICE_URL = buildTarget(process.env.ADMIN_SERVICE_URL) || 'http://admin-service:8002';
const SMS_SERVICE_URL = buildTarget(process.env.SMS_WEBHOOK_URL) || 'http://sms-webhook-service:8003';

// --- Fallback: serve index.html for any unknown route (SPA support) ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
  console.log(`Verification proxy → ${VERIFICATION_SERVICE_URL}`);
  console.log(`Admin proxy → ${ADMIN_SERVICE_URL}`);
  console.log(`SMS proxy → ${SMS_SERVICE_URL}`);
});