const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  review_id: { type: String, unique: true, required: true },
  client_id: { type: String, required: true, ref: 'User' },
  profile_id: { type: String, required: true, ref: 'Professional' },
  appointment_id: { type: String, required: true, ref: 'Appointment' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  is_visible: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

reviewSchema.index({ profile_id: 1, created_at: -1 });
reviewSchema.index({ client_id: 1 });

module.exports = mongoose.model('Review', reviewSchema);
