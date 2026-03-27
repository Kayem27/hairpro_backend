const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
  profile_id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true, ref: 'User' },
  description: { type: String, default: '' },
  city: { type: String, default: '' },
  lat: { type: Number, default: 0 },
  lng: { type: Number, default: 0 },
  radius_km: { type: Number, default: 10 },
  photo_url: { type: String, default: '' },
  is_verified: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  average_rating: { type: Number, default: 0 },
  review_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

professionalSchema.index({ user_id: 1 });
professionalSchema.index({ city: 1 });
professionalSchema.index({ is_active: 1, is_verified: 1 });
professionalSchema.index({ average_rating: -1 });

module.exports = mongoose.model('Professional', professionalSchema);
