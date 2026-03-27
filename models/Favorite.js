const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  favorite_id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true, ref: 'User' },
  profile_id: { type: String, required: true, ref: 'Professional' },
  created_at: { type: Date, default: Date.now }
});

favoriteSchema.index({ user_id: 1 });
favoriteSchema.index({ user_id: 1, profile_id: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
