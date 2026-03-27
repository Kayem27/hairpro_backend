const express = require('express');
const request = require('supertest');
const {
  registerValidation,
  loginValidation,
  appointmentValidation,
  reviewValidation,
  billingValidation,
  forgotPasswordValidation,
  resetPasswordValidation
} = require('../../../middleware/validate');

function createApp(validationMiddleware, handler) {
  const app = express();
  app.use(express.json());
  app.post('/test', validationMiddleware, handler || ((req, res) => res.json({ success: true })));
  return app;
}

describe('Validation Middleware', () => {
  describe('registerValidation', () => {
    const app = createApp(registerValidation);

    test('devrait accepter des données valides', async () => {
      const res = await request(app).post('/test').send({
        email: 'test@example.com',
        password: 'Password1!',
        firstName: 'Jean',
        lastName: 'Dupont'
      });
      expect(res.status).toBe(200);
    });

    test('devrait rejeter un email invalide', async () => {
      const res = await request(app).post('/test').send({
        email: 'not-an-email',
        password: 'Password1!',
        firstName: 'Jean',
        lastName: 'Dupont'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Données invalides');
    });

    test('devrait rejeter un mot de passe trop court', async () => {
      const res = await request(app).post('/test').send({
        email: 'test@example.com',
        password: 'short',
        firstName: 'Jean',
        lastName: 'Dupont'
      });
      expect(res.status).toBe(400);
    });

    test('devrait rejeter un prénom vide', async () => {
      const res = await request(app).post('/test').send({
        email: 'test@example.com',
        password: 'Password1!',
        firstName: '',
        lastName: 'Dupont'
      });
      expect(res.status).toBe(400);
    });

    test('devrait rejeter un nom vide', async () => {
      const res = await request(app).post('/test').send({
        email: 'test@example.com',
        password: 'Password1!',
        firstName: 'Jean',
        lastName: ''
      });
      expect(res.status).toBe(400);
    });

    test('devrait accepter un rôle valide', async () => {
      const res = await request(app).post('/test').send({
        email: 'test@example.com',
        password: 'Password1!',
        firstName: 'Jean',
        lastName: 'Dupont',
        role: 'pro'
      });
      expect(res.status).toBe(200);
    });

    test('devrait rejeter un rôle invalide', async () => {
      const res = await request(app).post('/test').send({
        email: 'test@example.com',
        password: 'Password1!',
        firstName: 'Jean',
        lastName: 'Dupont',
        role: 'admin'
      });
      expect(res.status).toBe(400);
    });
  });

  describe('loginValidation', () => {
    const app = createApp(loginValidation);

    test('devrait accepter des identifiants valides', async () => {
      const res = await request(app).post('/test').send({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(res.status).toBe(200);
    });

    test('devrait rejeter un email invalide', async () => {
      const res = await request(app).post('/test').send({
        email: 'invalid',
        password: 'password123'
      });
      expect(res.status).toBe(400);
    });

    test('devrait rejeter un mot de passe vide', async () => {
      const res = await request(app).post('/test').send({
        email: 'test@example.com',
        password: ''
      });
      expect(res.status).toBe(400);
    });
  });

  describe('appointmentValidation', () => {
    const app = createApp(appointmentValidation);

    test('devrait accepter des données valides', async () => {
      const res = await request(app).post('/test').send({
        profile_id: 'pro-001',
        date: '2026-04-15',
        slot_id: 'slot-09h'
      });
      expect(res.status).toBe(200);
    });

    test('devrait rejeter un format de date invalide', async () => {
      const res = await request(app).post('/test').send({
        profile_id: 'pro-001',
        date: '15/04/2026',
        slot_id: 'slot-09h'
      });
      expect(res.status).toBe(400);
    });

    test('devrait rejeter un profile_id vide', async () => {
      const res = await request(app).post('/test').send({
        profile_id: '',
        date: '2026-04-15',
        slot_id: 'slot-09h'
      });
      expect(res.status).toBe(400);
    });

    test('devrait rejeter un slot_id manquant', async () => {
      const res = await request(app).post('/test').send({
        profile_id: 'pro-001',
        date: '2026-04-15'
      });
      expect(res.status).toBe(400);
    });
  });

  describe('reviewValidation', () => {
    const app = createApp(reviewValidation);

    test('devrait accepter une note valide', async () => {
      const res = await request(app).post('/test').send({ rating: 4 });
      expect(res.status).toBe(200);
    });

    test('devrait rejeter une note < 1', async () => {
      const res = await request(app).post('/test').send({ rating: 0 });
      expect(res.status).toBe(400);
    });

    test('devrait rejeter une note > 5', async () => {
      const res = await request(app).post('/test').send({ rating: 6 });
      expect(res.status).toBe(400);
    });

    test('devrait rejeter une note non entière', async () => {
      const res = await request(app).post('/test').send({ rating: 3.5 });
      expect(res.status).toBe(400);
    });
  });

  describe('billingValidation', () => {
    const app = createApp(billingValidation);

    test('devrait accepter le plan monthly', async () => {
      const res = await request(app).post('/test').send({ plan: 'monthly' });
      expect(res.status).toBe(200);
    });

    test('devrait accepter le plan annual', async () => {
      const res = await request(app).post('/test').send({ plan: 'annual' });
      expect(res.status).toBe(200);
    });

    test('devrait rejeter un plan invalide', async () => {
      const res = await request(app).post('/test').send({ plan: 'weekly' });
      expect(res.status).toBe(400);
    });
  });

  describe('forgotPasswordValidation', () => {
    const app = createApp(forgotPasswordValidation);

    test('devrait accepter un email valide', async () => {
      const res = await request(app).post('/test').send({ email: 'test@example.com' });
      expect(res.status).toBe(200);
    });

    test('devrait rejeter un email invalide', async () => {
      const res = await request(app).post('/test').send({ email: 'not-email' });
      expect(res.status).toBe(400);
    });
  });

  describe('resetPasswordValidation', () => {
    const app = createApp(resetPasswordValidation);

    test('devrait accepter des données valides', async () => {
      const res = await request(app).post('/test').send({
        token: 'reset-token-abc',
        password: 'NewPassword1!'
      });
      expect(res.status).toBe(200);
    });

    test('devrait rejeter un token vide', async () => {
      const res = await request(app).post('/test').send({
        token: '',
        password: 'NewPassword1!'
      });
      expect(res.status).toBe(400);
    });

    test('devrait rejeter un mot de passe trop court', async () => {
      const res = await request(app).post('/test').send({
        token: 'reset-token-abc',
        password: 'short'
      });
      expect(res.status).toBe(400);
    });
  });
});
