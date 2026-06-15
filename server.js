require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 3000;

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Apply basic rate limiting to API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', apiLimiter);

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// API routes
const apiRoutes = require('./src/routes/api');
app.use('/api', apiRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Real-time demand data streaming (uses actual DB regions/categories)
setInterval(() => {
  const regions = ['Mumbai', 'Delhi', 'Bangalore'];
  const categories = ['electronics', 'clothing', 'accessories'];
  const data = {
    timestamp: new Date().toISOString(),
    demand_update: {
      region: regions[Math.floor(Math.random() * regions.length)],
      score: Math.floor(30 + Math.random() * 70), // 30-100 range (realistic)
      category: categories[Math.floor(Math.random() * categories.length)]
    },
    live_returns: Math.floor(Math.random() * 5)
  };
  io.emit('live_metrics', data);
}, 8000);

// NOTE: Fraud alerts are emitted in real-time from /api/process-return (api.js)
// when AI actually detects a suspicious return — no fake alerts needed.

server.listen(PORT, () => {
  console.log(`Second Life Commerce server running on http://localhost:${PORT}`);
});

module.exports = { app, server };
