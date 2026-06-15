require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

const rateLimit = require('express-rate-limit');

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

// API routes
const apiRoutes = require('./src/routes/api');
app.use('/api', apiRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server);

// Mock real-time data streaming
setInterval(() => {
  const regions = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'];
  const data = {
    timestamp: new Date().toISOString(),
    demand_update: {
      region: regions[Math.floor(Math.random() * regions.length)],
      score: Math.floor(Math.random() * 100),
      category: 'electronics'
    },
    live_returns: Math.floor(Math.random() * 5)
  };
  io.emit('live_metrics', data);
}, 3000);

// Mock fraud alert streaming
setInterval(() => {
  const reasons = [
    "Image mismatch (Uploaded photo of dog for iPhone)",
    "Bill verification failed (Date outside 30d window)",
    "Condition dispute (Claimed 'Like New', AI scored 20/100)",
    "Trust score too low (Multiple recent rejections)"
  ];
  const alert = {
    user: `user_${Math.floor(Math.random() * 900) + 100}`,
    reason: reasons[Math.floor(Math.random() * reasons.length)],
    time: new Date().toLocaleTimeString()
  };
  io.emit('fraud_alert', alert);
}, 12000);

server.listen(PORT, () => {
  console.log(`Second Life Commerce server running on http://localhost:${PORT}`);
});

module.exports = { app, server };
