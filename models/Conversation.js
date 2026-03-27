const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  conversation_id: { type: String, unique: true, required: true },
  participants: [{ type: String }],
  appointment_id: { type: String, default: null },
  created_at: { type: Date, default: Date.now }
});

conversationSchema.index({ participants: 1 });
conversationSchema.index({ appointment_id: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
