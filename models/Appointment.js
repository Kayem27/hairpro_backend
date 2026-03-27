const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointment_id: { type: String, unique: true, required: true },
  client_id: { type: String, required: true, ref: 'User' },
  profile_id: { type: String, required: true, ref: 'Professional' },
  date: { type: String, required: true },
  slot_id: { type: String, required: true, ref: 'TimeSlot' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'], default: 'pending' },
  notes: { type: String, default: '' },
  service_ids: [{ type: String }],
  created_at: { type: Date, default: Date.now }
});

appointmentSchema.index({ client_id: 1, status: 1 });
appointmentSchema.index({ profile_id: 1, status: 1 });
appointmentSchema.index({ date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
