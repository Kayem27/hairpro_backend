const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const request = require('supertest');

// Set env before requiring routes
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.APP_URL = 'http://localhost:5173';

const User = require('../../models/User');
const Professional = require('../../models/Professional');
const authRouter = require('../../routes/auth');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('POST /api/auth/register', () => {
  const validRegistration = {
    email: 'test@example.com',
    password: 'MyP@ssw0rd',
    firstName: 'Jean',
    lastName: 'Dupont',
  };

  test('devrait créer un utilisateur et retourner un token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegistration);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.first_name).toBe('Jean');
    expect(res.body.user.role).toBe('client');
  });

  test('devrait créer un pro si le rôle est spécifié', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, role: 'pro' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('pro');
  });

  test('devrait créer automatiquement un profil Professional pour un pro', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, email: 'pro@example.com', role: 'pro' });

    expect(res.status).toBe(201);
    const profile = await Professional.findOne({ user_id: res.body.user.user_id });
    expect(profile).not.toBeNull();
    expect(profile.profile_id).toBeDefined();
    expect(profile.is_active).toBe(true);
  });

  test('ne devrait pas créer de profil Professional pour un client', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, email: 'client@example.com', role: 'client' });

    expect(res.status).toBe(201);
    const profile = await Professional.findOne({ user_id: res.body.user.user_id });
    expect(profile).toBeNull();
  });

  test('devrait refuser un email déjà utilisé', async () => {
    await request(app).post('/api/auth/register').send(validRegistration);
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegistration);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cet email est déjà utilisé');
  });

  test('devrait refuser un mot de passe faible', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, password: 'weakpassword' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('mot de passe');
  });

  test('devrait hasher le mot de passe en base', async () => {
    await request(app).post('/api/auth/register').send(validRegistration);
    const user = await User.findOne({ email: 'test@example.com' });
    expect(user.password_hash).not.toBe(validRegistration.password);
    const isMatch = await bcrypt.compare(validRegistration.password, user.password_hash);
    expect(isMatch).toBe(true);
  });

  test('devrait générer un token de vérification email', async () => {
    await request(app).post('/api/auth/register').send(validRegistration);
    const user = await User.findOne({ email: 'test@example.com' });
    expect(user.email_verification_token).toBeTruthy();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    const password_hash = await bcrypt.hash('MyP@ssw0rd', 10);
    await User.create({
      user_id: 'user-login-test',
      email: 'login@example.com',
      password_hash,
      first_name: 'Jean',
      last_name: 'Dupont',
      role: 'client',
      status: 'active'
    });
  });

  test('devrait connecter un utilisateur valide', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'MyP@ssw0rd' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('login@example.com');
  });

  test('devrait refuser un mauvais mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Identifiants invalides');
  });

  test('devrait refuser un email inexistant', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: 'MyP@ssw0rd' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Identifiants invalides');
  });

  test('devrait refuser un compte suspendu', async () => {
    await User.updateOne({ user_id: 'user-login-test' }, { status: 'suspended' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'MyP@ssw0rd' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Compte suspendu');
  });
});

describe('GET /api/auth/me', () => {
  test('devrait retourner le profil de l\'utilisateur authentifié', async () => {
    // Register first to get a token
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'me@example.com',
        password: 'MyP@ssw0rd',
        firstName: 'Marie',
        lastName: 'Martin'
      });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${regRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@example.com');
    expect(res.body.first_name).toBe('Marie');
  });

  test('devrait retourner 401 sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/verify-email', () => {
  test('devrait vérifier un email avec un token valide', async () => {
    await User.create({
      user_id: 'user-verify',
      email: 'verify@example.com',
      password_hash: 'hash',
      first_name: 'Test',
      last_name: 'User',
      email_verification_token: 'valid-verify-token'
    });

    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token: 'valid-verify-token' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Email vérifié avec succès');

    const user = await User.findOne({ user_id: 'user-verify' });
    expect(user.email_verified).toBe(true);
    expect(user.email_verification_token).toBeNull();
  });

  test('devrait rejeter un token invalide', async () => {
    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token: 'invalid-token' });

    expect(res.status).toBe(400);
  });

  test('devrait rejeter sans token', async () => {
    const res = await request(app).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/forgot-password', () => {
  test('devrait retourner un message générique (prévention énumération)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Si cet email existe');
  });

  test('devrait générer un token de reset pour un utilisateur existant', async () => {
    await User.create({
      user_id: 'user-forgot',
      email: 'forgot@example.com',
      password_hash: 'hash',
      first_name: 'Test',
      last_name: 'User'
    });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'forgot@example.com' });

    expect(res.status).toBe(200);

    const user = await User.findOne({ user_id: 'user-forgot' });
    expect(user.reset_token).toBeTruthy();
    expect(user.reset_token_expires).toBeInstanceOf(Date);
    expect(user.reset_token_expires.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('POST /api/auth/reset-password', () => {
  beforeEach(async () => {
    const password_hash = await bcrypt.hash('OldP@ssw0rd', 10);
    await User.create({
      user_id: 'user-reset',
      email: 'reset@example.com',
      password_hash,
      first_name: 'Test',
      last_name: 'User',
      reset_token: 'valid-reset-token',
      reset_token_expires: new Date(Date.now() + 3600000)
    });
  });

  test('devrait réinitialiser le mot de passe avec un token valide', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'valid-reset-token', password: 'NewP@ssw0rd' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Mot de passe réinitialisé avec succès');

    // Verify password was changed
    const user = await User.findOne({ user_id: 'user-reset' });
    const isMatch = await bcrypt.compare('NewP@ssw0rd', user.password_hash);
    expect(isMatch).toBe(true);
    expect(user.reset_token).toBeNull();
    expect(user.reset_token_expires).toBeNull();
  });

  test('devrait rejeter un token expiré', async () => {
    await User.updateOne(
      { user_id: 'user-reset' },
      { reset_token_expires: new Date(Date.now() - 3600000) }
    );

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'valid-reset-token', password: 'NewP@ssw0rd' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Token invalide ou expiré');
  });

  test('devrait rejeter un mot de passe faible', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'valid-reset-token', password: 'weak' });

    expect(res.status).toBe(400);
    // Validation middleware rejects short passwords before the route handler
    expect(res.body.error).toBeDefined();
  });
});
