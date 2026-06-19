/**
 * server.js - Main entry point for the Bill Reader backend
 * Sets up Express server with CORS, JSON parsing, and routes
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const extractRoutes = require('./routes/extractRoutes');
const metroRoutes = require('./routes/metroRoutes');
const gstRoutes = require('./routes/gstRoutes');
const retailRoutes = require('./routes/retailRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server default port
  methods: ['GET', 'POST', 'DELETE'],
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', extractRoutes);
app.use('/api/metro', metroRoutes);
app.use('/api/gst', gstRoutes);
app.use('/api/retail', retailRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Bill Reader API is running' });
});

app.listen(PORT, () => {
  console.log(`✅ Bill Reader server running on http://localhost:${PORT}`);
});
