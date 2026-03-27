const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_id: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  first_name: { type: String, required: true, trim: true },
  last_name: { type: String, required: true, trim: true },
  role: { type: String, enum: ['client', 'pro', 'admin'], default: 'client' },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  email_verified: { type: Boolean, default: false },
  email_verification_token: { type: String, default: null },
  reset_token: { type: String, default: null },
  reset_token_expires: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
