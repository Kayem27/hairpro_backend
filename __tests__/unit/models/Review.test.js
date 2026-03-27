const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Review = require('../../../models/Review');

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
  await Review.deleteMany({});
});

describe('Review Model', () => {
  const validReview = {
    review_id: 'rev-001',
    client_id: 'user-001',
    profile_id: 'pro-001',
    appointment_id: 'apt-001',
    rating: 4,
  };

  test('devrait créer un avis valide', async () => {
    const review = await Review.create(validReview);
    expect(review.review_id).toBe('rev-001');
    expect(review.rating).toBe(4);
    expect(review.comment).toBe('');
    expect(review.is_visible).toBe(true);
  });

  test('devrait accepter un commentaire', async () => {
    const review = await Review.create({ ...validReview, comment: 'Excellent service !' });
    expect(review.comment).toBe('Excellent service !');
  });

  test('devrait refuser une note < 1', async () => {
    await expect(
      Review.create({ ...validReview, rating: 0 })
    ).rejects.toThrow();
  });

  test('devrait refuser une note > 5', async () => {
    await expect(
      Review.create({ ...validReview, rating: 6 })
    ).rejects.toThrow();
  });

  test('devrait accepter les notes de 1 à 5', async () => {
    for (let rating = 1; rating <= 5; rating++) {
      const review = await Review.create({
        ...validReview,
        review_id: `rev-${rating}`,
        appointment_id: `apt-${rating}`,
        rating
      });
      expect(review.rating).toBe(rating);
    }
  });

  test('devrait pouvoir masquer un avis', async () => {
    const review = await Review.create(validReview);
    review.is_visible = false;
    await review.save();
    const updated = await Review.findOne({ review_id: 'rev-001' });
    expect(updated.is_visible).toBe(false);
  });
});
