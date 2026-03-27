jest.mock('../../../models/Subscription', () => {
  return { findOne: jest.fn() };
});

const Subscription = require('../../../models/Subscription');
const { requireSubscription } = require('../../../middleware/requireSubscription');

function mockReqResNext() {
  const req = { user: { user_id: 'user-001' } };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('requireSubscription middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devrait appeler next() si un abonnement actif existe', async () => {
    const { req, res, next } = mockReqResNext();
    const mockSub = {
      subscription_id: 'sub-001',
      user_id: 'user-001',
      status: 'active',
      current_period_end: new Date('2027-01-01')
    };
    Subscription.findOne.mockResolvedValue(mockSub);

    await requireSubscription(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.subscription).toEqual(mockSub);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('devrait retourner 403 si pas d\'abonnement actif', async () => {
    const { req, res, next } = mockReqResNext();
    Subscription.findOne.mockResolvedValue(null);

    await requireSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Abonnement actif requis',
      code: 'SUBSCRIPTION_REQUIRED'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('devrait retourner 500 en cas d\'erreur de base de données', async () => {
    const { req, res, next } = mockReqResNext();
    Subscription.findOne.mockRejectedValue(new Error('DB Error'));

    await requireSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Erreur de vérification d'abonnement" });
    expect(next).not.toHaveBeenCalled();
  });

  test('devrait vérifier que la date de fin est dans le futur', async () => {
    const { req, res, next } = mockReqResNext();
    Subscription.findOne.mockResolvedValue(null);

    await requireSubscription(req, res, next);

    // Vérifier que la requête inclut $gt: new Date()
    expect(Subscription.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-001',
        status: 'active',
        current_period_end: expect.objectContaining({ $gt: expect.any(Date) })
      })
    );
  });
});
