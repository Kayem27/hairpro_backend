const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Professional = require('../../../models/Professional');

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
  await Professional.deleteMany({});
});

describe('Professional Model', () => {
  const validPro = {
    profile_id: 'pro-001',
    user_id: 'user-001',
  };

  test('devrait créer un professionnel avec des données valides', async () => {
    const pro = await Professional.create(validPro);
    expect(pro.profile_id).toBe('pro-001');
    expect(pro.user_id).toBe('user-001');
    expect(pro.description).toBe('');
    expect(pro.city).toBe('');
    expect(pro.lat).toBe(0);
    expect(pro.lng).toBe(0);
    expect(pro.radius_km).toBe(10);
    expect(pro.photo_url).toBe('');
    expect(pro.is_verified).toBe(false);
    expect(pro.is_active).toBe(true);
    expect(pro.average_rating).toBe(0);
    expect(pro.review_count).toBe(0);
  });

  test('devrait échouer sans profile_id', async () => {
    await expect(Professional.create({ user_id: 'user-001' })).rejects.toThrow();
  });

  test('devrait échouer sans user_id', async () => {
    await expect(Professional.create({ profile_id: 'pro-001' })).rejects.toThrow();
  });

  test('devrait refuser un profile_id dupliqué', async () => {
    await Professional.create(validPro);
    await expect(
      Professional.create({ profile_id: 'pro-001', user_id: 'user-002' })
    ).rejects.toThrow();
  });

  test('devrait mettre à jour les coordonnées et le rayon', async () => {
    const pro = await Professional.create(validPro);
    pro.lat = 48.8566;
    pro.lng = 2.3522;
    pro.radius_km = 25;
    await pro.save();

    const updated = await Professional.findOne({ profile_id: 'pro-001' });
    expect(updated.lat).toBeCloseTo(48.8566);
    expect(updated.lng).toBeCloseTo(2.3522);
    expect(updated.radius_km).toBe(25);
  });

  test('devrait mettre à jour la note moyenne', async () => {
    const pro = await Professional.create(validPro);
    pro.average_rating = 4.5;
    pro.review_count = 12;
    await pro.save();

    const updated = await Professional.findOne({ profile_id: 'pro-001' });
    expect(updated.average_rating).toBe(4.5);
    expect(updated.review_count).toBe(12);
  });
});
