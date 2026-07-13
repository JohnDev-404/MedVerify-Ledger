const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS
app.use(cors());

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// --- ADMIN PAGE (explicit route) ---
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- PROXY ROUTES ---

// Proxy: /api/verify → verification-service
app.use(
  '/api/verify',
  createProxyMiddleware({
    target: 'http://verification-service:8001',
    changeOrigin: true,
    pathRewrite: { '^/api/verify': '/verify' },
  })
);

// Proxy: /api/admin → admin-service
app.use(
  '/api/admin',
  createProxyMiddleware({
    target: 'http://admin-service:8002',
    changeOrigin: true,
    pathRewrite: { '^/api/admin': '' },
  })
);

// Proxy: /api/sms → sms-webhook-service
app.use(
  '/api/sms',
  createProxyMiddleware({
    target: 'http://sms-webhook-service:8003',
    changeOrigin: true,
    pathRewrite: { '^/api/sms': '/sms' },
  })
);

// --- FALLBACK: Serve index.html for any unknown route (SPA support) ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});