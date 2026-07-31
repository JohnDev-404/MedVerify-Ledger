const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

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

// --- Service URLs ---
const VERIFICATION_SERVICE_URL = process.env.VERIFICATION_SERVICE_URL || 'https://medverify-verification.onrender.com';
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'https://medverify-admin.onrender.com';
const SMS_SERVICE_URL = process.env.SMS_WEBHOOK_URL || 'https://medverify-sms.onrender.com';

// ================================================================
//  Helper: request with retry (exponential backoff)
// ================================================================
async function requestWithRetry(method, url, options = {}, retries = 3) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const response = await axios({ method, url, ...options });
      return response;
    } catch (error) {
      // If it's a 429 or 5xx, we retry; otherwise throw immediately.
      const status = error.response?.status || 0;
      const shouldRetry = (status === 429 || status >= 500) && attempt < retries - 1;
      if (!shouldRetry) throw error;

      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`Retry ${attempt+1}/${retries} for ${method} ${url} after ${delay}ms (status ${status})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
  // Should not reach here, but fallback
  throw new Error(`Max retries exceeded for ${method} ${url}`);
}

// ================================================================
//  Simple cache for GET /api/admin/batches (10s TTL)
// ================================================================
let batchesCache = {
  data: null,
  timestamp: 0,
  ttl: 10000, // 10 seconds
};

// --- Verification endpoint ---
app.post('/api/verify', async (req, res) => {
  try {
    const response = await requestWithRetry('post', `${VERIFICATION_SERVICE_URL}/verify`, {
      data: req.body,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Verification service error:', error.message);
    if (error.response) {
      // If it's still 429 after retries, send a friendly message
      if (error.response.status === 429) {
        res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
      } else {
        res.status(error.response.status).json(error.response.data);
      }
    } else {
      res.status(504).json({ error: 'Verification service unavailable' });
    }
  }
});

// --- Admin endpoints (GET, POST, PUT, DELETE) ---
app.get('/api/admin/batches', async (req, res) => {
  try {
    const apiKey = req.headers['api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API key required' });

    // Check cache
    const now = Date.now();
    if (batchesCache.data && (now - batchesCache.timestamp) < batchesCache.ttl) {
      console.log('Serving batches from cache');
      return res.status(200).json(batchesCache.data);
    }

    const response = await requestWithRetry('get', `${ADMIN_SERVICE_URL}/batches`, {
      headers: { 'api-key': apiKey },
      timeout: 30000,
    });

    // Update cache
    batchesCache.data = response.data;
    batchesCache.timestamp = now;

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Admin GET error:', error.message);
    if (error.response) {
      if (error.response.status === 429) {
        res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
      } else {
        res.status(error.response.status).json(error.response.data);
      }
    } else {
      res.status(504).json({ error: 'Admin service unavailable' });
    }
  }
});

app.post('/api/admin/batches', async (req, res) => {
  try {
    const apiKey = req.headers['api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API key required' });

    const response = await requestWithRetry('post', `${ADMIN_SERVICE_URL}/batches`, {
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      timeout: 30000,
    });

    // Invalidate cache after a successful POST
    batchesCache.data = null;
    batchesCache.timestamp = 0;

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Admin POST error:', error.message);
    if (error.response) {
      if (error.response.status === 429) {
        res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
      } else {
        res.status(error.response.status).json(error.response.data);
      }
    } else {
      res.status(504).json({ error: 'Admin service unavailable' });
    }
  }
});

app.put('/api/admin/batches/:batchNumber', async (req, res) => {
  try {
    const apiKey = req.headers['api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API key required' });
    const { batchNumber } = req.params;

    const response = await requestWithRetry('put', `${ADMIN_SERVICE_URL}/batches/${batchNumber}`, {
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      timeout: 30000,
    });

    // Invalidate cache
    batchesCache.data = null;
    batchesCache.timestamp = 0;

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Admin PUT error:', error.message);
    if (error.response) {
      if (error.response.status === 429) {
        res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
      } else {
        res.status(error.response.status).json(error.response.data);
      }
    } else {
      res.status(504).json({ error: 'Admin service unavailable' });
    }
  }
});

app.delete('/api/admin/batches/:batchNumber', async (req, res) => {
  try {
    const apiKey = req.headers['api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API key required' });
    const { batchNumber } = req.params;

    const response = await requestWithRetry('delete', `${ADMIN_SERVICE_URL}/batches/${batchNumber}`, {
      headers: { 'api-key': apiKey },
      timeout: 30000,
    });

    // Invalidate cache
    batchesCache.data = null;
    batchesCache.timestamp = 0;

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Admin DELETE error:', error.message);
    if (error.response) {
      if (error.response.status === 429) {
        res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
      } else {
        res.status(error.response.status).json(error.response.data);
      }
    } else {
      res.status(504).json({ error: 'Admin service unavailable' });
    }
  }
});

// --- SMS endpoint (direct axios) ---
app.post('/api/sms', async (req, res) => {
  try {
    const response = await requestWithRetry('post', `${SMS_SERVICE_URL}/sms`, {
      data: req.body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
    });
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('SMS service error:', error.message);
    if (error.response) {
      if (error.response.status === 429) {
        res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
      } else {
        res.status(error.response.status).send(error.response.data);
      }
    } else {
      res.status(504).json({ error: 'SMS service unavailable' });
    }
  }
});

// --- Fallback ---
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`✅ Gateway running on port ${PORT}`);
  console.log(`Verification service → ${VERIFICATION_SERVICE_URL}`);
  console.log(`Admin service → ${ADMIN_SERVICE_URL}`);
  console.log(`SMS service → ${SMS_SERVICE_URL}`);
});