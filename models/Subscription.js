const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  subscription_id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true, ref: 'User' },
  plan: { type: String, enum: ['monthly', 'annual'], required: true },
  status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
  stripe_subscription_id: { type: String, default: '' },
  cancel_at_period_end: { type: Boolean, default: false },
  current_period_end: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

subscriptionSchema.index({ user_id: 1, status: 1 });
subscriptionSchema.index({ stripe_subscription_id: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
