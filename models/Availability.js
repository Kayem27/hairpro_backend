const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  availability_id: { type: String, unique: true, required: true },
  profile_id: { type: String, required: true, ref: 'Professional' },
  date: { type: String, required: true },
  slot_id: { type: String, required: true, ref: 'TimeSlot' },
  status: { type: String, enum: ['available', 'unavailable', 'booked', 'pending'], default: 'available' }
});

availabilitySchema.index({ profile_id: 1, date: 1 });
availabilitySchema.index({ profile_id: 1, date: 1, status: 1 });

module.exports = mongoose.model('Availability', availabilitySchema);
