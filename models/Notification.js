const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  notification_id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['appointment_new', 'appointment_accepted', 'appointment_rejected', 'appointment_cancelled', 'new_message', 'new_review'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: '' },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

notificationSchema.index({ user_id: 1, is_read: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
