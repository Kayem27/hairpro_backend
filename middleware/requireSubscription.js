const Subscription = require('../models/Subscription');

const requireSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({
      user_id: req.user.user_id,
      status: 'active',
      current_period_end: { $gt: new Date() }
    });

    if (!sub) {
      return res.status(403).json({
        error: 'Abonnement actif requis',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }

    req.subscription = sub;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Erreur de vérification d\'abonnement' });
  }
};

module.exports = { requireSubscription };
