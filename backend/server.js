require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const analysisRoutes = require('./routes/analysisRoutes');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/analysis', analysisRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
