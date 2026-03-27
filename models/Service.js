const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  service_id: { type: String, unique: true, required: true },
  profile_id: { type: String, required: true, ref: 'Professional' },
  name: { type: String, required: true },
  estimated_price: { type: Number, required: true },
  duration: { type: Number, default: 60 }
});

serviceSchema.index({ profile_id: 1 });

module.exports = mongoose.model('Service', serviceSchema);
