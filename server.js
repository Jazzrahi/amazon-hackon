require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

app.listen(PORT, () => {
  console.log(`Second Life Commerce server running on http://localhost:${PORT}`);
});

module.exports = app;
