const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { auth, requireRole } = require('../middleware/auth');
const { billingValidation } = require('../middleware/validate');
const Subscription = require('../models/Subscription');

const router = express.Router();

let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder') {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch (e) {
  console.log('Stripe non configuré');
}

const PLANS = {
  monthly: { name: 'Mensuel', price: 2999, currency: 'eur', interval: 'month', period_days: 30 },
  annual: { name: 'Annuel', price: 30230, currency: 'eur', interval: 'year', period_days: 365 }
};

// POST /api/billing/create-checkout
router.post('/create-checkout', auth, requireRole('pro'), billingValidation, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Plan invalide' });

    if (!stripe) {
      // Simulate subscription without Stripe
      const periodMs = PLANS[plan].period_days * 24 * 60 * 60 * 1000;
      let sub = await Subscription.findOne({ user_id: req.user.user_id, status: 'active' });
      if (sub) {
        sub.plan = plan;
        sub.current_period_end = new Date(Date.now() + periodMs);
        await sub.save();
      } else {
        sub = await Subscription.create({
          subscription_id: uuidv4(),
          user_id: req.user.user_id,
          plan,
          status: 'active',
          current_period_end: new Date(Date.now() + periodMs)
        });
      }
      return res.json({ message: 'Abonnement activé (mode simulation)', subscription: sub });
    }

    // Créer le prix dynamiquement via Stripe (mode ad-hoc)
    const planInfo = PLANS[plan];
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: planInfo.currency,
          unit_amount: planInfo.price,
          recurring: { interval: planInfo.interval },
          product_data: {
            name: `HairPro ${planInfo.name}`,
            description: `Abonnement ${planInfo.name.toLowerCase()} HairPro`,
          },
        },
        quantity: 1,
      }],
      success_url: `${process.env.APP_URL}/dashboard/pro/subscription?checkout=success`,
      cancel_url: `${process.env.APP_URL}/dashboard/pro/subscription?checkout=cancel`,
      metadata: { user_id: req.user.user_id, plan }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Create checkout error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du paiement. Veuillez réessayer.' });
  }
});

// GET /api/billing/subscription
router.get('/subscription', auth, async (req, res) => {
  try {
    const sub = await Subscription.findOne({
      user_id: req.user.user_id,
      status: 'active'
    }).lean();
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/billing/cancel
router.post('/cancel', auth, requireRole('pro'), async (req, res) => {
  try {
    const sub = await Subscription.findOne({ user_id: req.user.user_id, status: 'active' });
    if (!sub) return res.status(404).json({ error: 'Aucun abonnement actif' });

    if (stripe && sub.stripe_subscription_id) {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    }

    sub.status = 'cancelled';
    await sub.save();

    res.json({ message: 'Abonnement annulé' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/billing/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.json({ received: true });

  try {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { user_id, plan } = session.metadata;

      const periodMs = (PLANS[plan]?.period_days || 30) * 24 * 60 * 60 * 1000;
      await Subscription.create({
        subscription_id: uuidv4(),
        user_id,
        plan,
        status: 'active',
        stripe_subscription_id: session.subscription,
        current_period_end: new Date(Date.now() + periodMs)
      });
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        await Subscription.updateOne(
          { stripe_subscription_id: subscriptionId },
          { status: 'expired' }
        );
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      await Subscription.updateOne(
        { stripe_subscription_id: subscription.id },
        {
          status: subscription.status === 'active' ? 'active' : 'cancelled',
          current_period_end: new Date(subscription.current_period_end * 1000)
        }
      );
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      await Subscription.updateOne(
        { stripe_subscription_id: subscription.id },
        { status: 'cancelled' }
      );
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: 'Webhook error' });
  }
});

module.exports = router;
