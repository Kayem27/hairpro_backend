const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Subscription = require('../../../models/Subscription');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Subscription.deleteMany({});
});

describe('Subscription Model', () => {
  const validSub = {
    subscription_id: 'sub-001',
    user_id: 'user-001',
    plan: 'monthly',
    current_period_end: new Date('2026-05-01'),
  };

  test('devrait créer un abonnement valide', async () => {
    const sub = await Subscription.create(validSub);
    expect(sub.subscription_id).toBe('sub-001');
    expect(sub.plan).toBe('monthly');
    expect(sub.status).toBe('active');
    expect(sub.stripe_subscription_id).toBe('');
  });

  test('devrait accepter les plans monthly et annual', async () => {
    const monthly = await Subscription.create(validSub);
    expect(monthly.plan).toBe('monthly');

    const annual = await Subscription.create({
      ...validSub,
      subscription_id: 'sub-002',
      plan: 'annual'
    });
    expect(annual.plan).toBe('annual');
  });

  test('devrait refuser un plan invalide', async () => {
    await expect(
      Subscription.create({ ...validSub, plan: 'weekly' })
    ).rejects.toThrow();
  });

  test('devrait accepter les statuts valides', async () => {
    for (const status of ['active', 'cancelled', 'expired']) {
      const sub = await Subscription.create({
        ...validSub,
        subscription_id: `sub-${status}`,
        status
      });
      expect(sub.status).toBe(status);
    }
  });

  test('devrait refuser un statut invalide', async () => {
    await expect(
      Subscription.create({ ...validSub, status: 'paused' })
    ).rejects.toThrow();
  });
});
