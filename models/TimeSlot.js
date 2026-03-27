const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  slot_id: { type: String, unique: true, required: true },
  label: { type: String, required: true },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true }
});

module.exports = mongoose.model('TimeSlot', timeSlotSchema);
