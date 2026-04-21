const express = require('express');
const router = express.Router();
const axios = require('axios');
const Analysis = require('../models/Analysis');

// @desc    Analyze text and store results
// @route   POST /api/analysis
router.post('/', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Please provide text for analysis' });
    }

    // Call ML Service
    const mlResponse = await axios.post(`${process.env.ML_SERVICE_URL}/predict`, { text });
    const { label, confidence, explanation } = mlResponse.data;

    // Store in MongoDB
    const analysis = await Analysis.create({
      text,
      label,
      confidence,
      explanation
    });

    res.status(201).json(analysis);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Get all analyses
// @route   GET /api/analysis
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const analyses = await Analysis.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Analysis.countDocuments();

    res.json({
      analyses,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get single analysis
// @route   GET /api/analysis/:id
router.get('/:id', async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.id);
    if (!analysis) {
      return res.status(404).json({ message: 'Analysis not found' });
    }
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Delete analysis
// @route   DELETE /api/analysis/:id
router.delete('/:id', async (req, res) => {
  try {
    const analysis = await Analysis.findByIdAndDelete(req.params.id);
    if (!analysis) {
      return res.status(404).json({ message: 'Analysis not found' });
    }
    res.json({ message: 'Analysis removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
