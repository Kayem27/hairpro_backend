const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  message_id: { type: String, unique: true, required: true },
  conversation_id: { type: String, required: true, ref: 'Conversation' },
  sender_id: { type: String, required: true },
  content: { type: String, required: true },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

messageSchema.index({ conversation_id: 1, created_at: 1 });

module.exports = mongoose.model('Message', messageSchema);
