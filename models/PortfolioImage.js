const mongoose = require('mongoose');

const portfolioImageSchema = new mongoose.Schema({
  image_id: { type: String, unique: true, required: true },
  profile_id: { type: String, required: true, ref: 'Professional' },
  url: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

portfolioImageSchema.index({ profile_id: 1 });

module.exports = mongoose.model('PortfolioImage', portfolioImageSchema);
