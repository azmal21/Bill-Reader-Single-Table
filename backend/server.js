/**
 * server.js - Main entry point for the Bill Reader backend
 * Sets up Express server with CORS, JSON parsing, and routes
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const billRoutes = require('./routes/billRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'], // Vite dev server default port
  methods: ['GET', 'POST', 'DELETE'],
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/bills', billRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Bill Reader API is running' });
});

app.listen(PORT, () => {
  console.log(`✅ Bill Reader server running on http://localhost:${PORT}`);
});
