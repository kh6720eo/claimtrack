const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  dateOfLoss: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['submitted', 'in_review', 'approved', 'denied'],
    default: 'submitted',
  },
});

module.exports = mongoose.model('Claim', claimSchema);
