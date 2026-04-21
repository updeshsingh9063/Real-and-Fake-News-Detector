const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Please add the text to analyze'],
    index: true
  },
  label: {
    type: String,
    required: true,
    enum: ['Real', 'Fake', 'Misleading', 'Partially True']
  },
  confidence: {
    type: Number,
    required: true
  },
  explanation: {
    type: String,
    required: true
  },
  source: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Full-text index on text field
AnalysisSchema.index({ text: 'text' });

module.exports = mongoose.model('Analysis', AnalysisSchema);
