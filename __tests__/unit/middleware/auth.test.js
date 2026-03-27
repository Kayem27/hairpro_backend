const jwt = require('jsonwebtoken');

// Mock User model
jest.mock('../../../models/User', () => {
  const findOneMock = jest.fn();
  return { findOne: findOneMock };
});

const User = require('../../../models/User');
const { auth, requireRole } = require('../../../middleware/auth');

process.env.JWT_SECRET = 'test-secret-key';

function mockReqResNext() {
  const req = { header: jest.fn() };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('auth middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devrait retourner 401 si pas de token', async () => {
    const { req, res, next } = mockReqResNext();
    req.header.mockReturnValue(undefined);

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentification requise' });
    expect(next).not.toHaveBeenCalled();
  });

  test('devrait retourner 401 si le token est invalide', async () => {
    const { req, res, next } = mockReqResNext();
    req.header.mockReturnValue('Bearer invalid-token');

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token invalide' });
    expect(next).not.toHaveBeenCalled();
  });

  test('devrait retourner 401 si l\'utilisateur n\'existe pas', async () => {
    const { req, res, next } = mockReqResNext();
    const token = jwt.sign({ user_id: 'nonexistent' }, process.env.JWT_SECRET);
    req.header.mockReturnValue(`Bearer ${token}`);
    User.findOne.mockResolvedValue(null);

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Utilisateur non trouvé' });
  });

  test('devrait retourner 403 si le compte est suspendu', async () => {
    const { req, res, next } = mockReqResNext();
    const token = jwt.sign({ user_id: 'suspended-user' }, process.env.JWT_SECRET);
    req.header.mockReturnValue(`Bearer ${token}`);
    User.findOne.mockResolvedValue({ user_id: 'suspended-user', status: 'suspended' });

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Compte suspendu' });
  });

  test('devrait appeler next() et attacher l\'utilisateur si le token est valide', async () => {
    const { req, res, next } = mockReqResNext();
    const mockUser = { user_id: 'valid-user', status: 'active', role: 'client' };
    const token = jwt.sign({ user_id: 'valid-user' }, process.env.JWT_SECRET);
    req.header.mockReturnValue(`Bearer ${token}`);
    User.findOne.mockResolvedValue(mockUser);

    await auth(req, res, next);

    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('devrait retourner 401 si le token est expiré', async () => {
    const { req, res, next } = mockReqResNext();
    const token = jwt.sign({ user_id: 'user-001' }, process.env.JWT_SECRET, { expiresIn: '0s' });
    req.header.mockReturnValue(`Bearer ${token}`);

    // Attendre un peu pour que le token expire
    await new Promise(resolve => setTimeout(resolve, 10));
    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token invalide' });
  });
});

describe('requireRole middleware', () => {
  test('devrait appeler next() si le rôle est autorisé', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'admin' };

    requireRole('admin', 'pro')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('devrait retourner 403 si le rôle n\'est pas autorisé', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'client' };

    requireRole('admin', 'pro')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Accès non autorisé' });
    expect(next).not.toHaveBeenCalled();
  });

  test('devrait accepter un seul rôle', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'pro' };

    requireRole('pro')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('devrait accepter plusieurs rôles', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'client' };

    requireRole('client', 'pro', 'admin')(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
