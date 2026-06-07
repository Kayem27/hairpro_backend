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

// Bascule automatique : un RDV confirmé (accepted) dont la date est passée
// devient "completed". Appelé avant de lister les RDV (côté client et pro)
// pour que la possibilité de laisser un avis apparaisse sans action manuelle.
// `filter` restreint le lot (ex: { client_id } ou { profile_id }).
appointmentSchema.statics.autoCompletePast = async function (filter = {}) {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  return this.updateMany(
    { ...filter, status: 'accepted', date: { $lt: today } },
    { status: 'completed' }
  );
};

module.exports = mongoose.model('Appointment', appointmentSchema);
