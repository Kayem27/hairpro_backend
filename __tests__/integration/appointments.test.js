const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.APP_URL = 'http://localhost:5173';

const User = require('../../models/User');
const Professional = require('../../models/Professional');
const Appointment = require('../../models/Appointment');
const Availability = require('../../models/Availability');
const Review = require('../../models/Review');
const TimeSlot = require('../../models/TimeSlot');
const Conversation = require('../../models/Conversation');
const appointmentsRouter = require('../../routes/appointments');

let mongoServer, app, clientToken, clientUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = express();
  app.use(express.json());
  app.use('/api/appointments', appointmentsRouter);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Create client user
  clientUser = await User.create({
    user_id: 'client-001',
    email: 'client@example.com',
    password_hash: await bcrypt.hash('Password1!', 10),
    first_name: 'Alice',
    last_name: 'Client',
    role: 'client'
  });
  clientToken = jwt.sign({ user_id: 'client-001' }, process.env.JWT_SECRET);

  // Create pro user + profile
  await User.create({
    user_id: 'pro-user-001',
    email: 'pro@example.com',
    password_hash: await bcrypt.hash('Password1!', 10),
    first_name: 'Bob',
    last_name: 'Coiffeur',
    role: 'pro'
  });
  await Professional.create({
    profile_id: 'pro-001',
    user_id: 'pro-user-001',
    city: 'Paris',
    is_active: true
  });

  // Create time slot
  await TimeSlot.create({ slot_id: 'slot-09h', label: '09:00 - 10:00', start_time: '09:00', end_time: '10:00' });

  // Create availability
  await Availability.create({
    availability_id: 'avail-001',
    profile_id: 'pro-001',
    date: '2026-04-15',
    slot_id: 'slot-09h',
    status: 'available'
  });
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('POST /api/appointments', () => {
  test('devrait créer un rendez-vous', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        profile_id: 'pro-001',
        date: '2026-04-15',
        slot_id: 'slot-09h',
        notes: 'Coupe simple'
      });

    expect(res.status).toBe(201);
    expect(res.body.client_id).toBe('client-001');
    expect(res.body.profile_id).toBe('pro-001');
    expect(res.body.status).toBe('pending');
  });

  test('devrait marquer la disponibilité comme pending', async () => {
    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        profile_id: 'pro-001',
        date: '2026-04-15',
        slot_id: 'slot-09h'
      });

    const avail = await Availability.findOne({ availability_id: 'avail-001' });
    expect(avail.status).toBe('pending');
  });

  test('devrait créer une conversation', async () => {
    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        profile_id: 'pro-001',
        date: '2026-04-15',
        slot_id: 'slot-09h'
      });

    const conv = await Conversation.findOne({ participants: { $all: ['client-001', 'pro-user-001'] } });
    expect(conv).not.toBeNull();
  });

  test('devrait refuser un créneau non disponible', async () => {
    await Availability.updateOne({ availability_id: 'avail-001' }, { status: 'booked' });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        profile_id: 'pro-001',
        date: '2026-04-15',
        slot_id: 'slot-09h'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('disponible');
  });

  test('devrait refuser un professionnel inexistant', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        profile_id: 'pro-999',
        date: '2026-04-15',
        slot_id: 'slot-09h'
      });

    expect(res.status).toBe(404);
  });

  test('devrait refuser sans authentification', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .send({
        profile_id: 'pro-001',
        date: '2026-04-15',
        slot_id: 'slot-09h'
      });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/appointments/me', () => {
  test('devrait retourner les rendez-vous du client', async () => {
    await Appointment.create({
      appointment_id: 'apt-001',
      client_id: 'client-001',
      profile_id: 'pro-001',
      date: '2026-04-15',
      slot_id: 'slot-09h',
      status: 'pending'
    });

    const res = await request(app)
      .get('/api/appointments/me')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].appointment_id).toBe('apt-001');
    expect(res.body[0].professional).toBeDefined();
    expect(res.body[0].slot).toBeDefined();
  });

  test('devrait retourner un tableau vide si aucun rendez-vous', async () => {
    const res = await request(app)
      .get('/api/appointments/me')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/appointments/:id/cancel', () => {
  beforeEach(async () => {
    await Appointment.create({
      appointment_id: 'apt-cancel',
      client_id: 'client-001',
      profile_id: 'pro-001',
      date: '2026-04-15',
      slot_id: 'slot-09h',
      status: 'pending'
    });
  });

  test('devrait annuler un rendez-vous pending', async () => {
    const res = await request(app)
      .post('/api/appointments/apt-cancel/cancel')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  test('devrait libérer le créneau après annulation', async () => {
    await Availability.updateOne({ availability_id: 'avail-001' }, { status: 'pending' });

    await request(app)
      .post('/api/appointments/apt-cancel/cancel')
      .set('Authorization', `Bearer ${clientToken}`);

    const avail = await Availability.findOne({ availability_id: 'avail-001' });
    expect(avail.status).toBe('available');
  });

  test('devrait refuser l\'annulation d\'un RDV terminé', async () => {
    await Appointment.updateOne({ appointment_id: 'apt-cancel' }, { status: 'completed' });

    const res = await request(app)
      .post('/api/appointments/apt-cancel/cancel')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(400);
  });

  test('devrait refuser l\'annulation par un autre client', async () => {
    const otherUser = await User.create({
      user_id: 'client-other',
      email: 'other@example.com',
      password_hash: 'hash',
      first_name: 'Other',
      last_name: 'Client'
    });
    const otherToken = jwt.sign({ user_id: 'client-other' }, process.env.JWT_SECRET);

    const res = await request(app)
      .post('/api/appointments/apt-cancel/cancel')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  test('devrait retourner 404 pour un RDV inexistant', async () => {
    const res = await request(app)
      .post('/api/appointments/nonexistent/cancel')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/appointments/reviews', () => {
  beforeEach(async () => {
    await Appointment.create({
      appointment_id: 'apt-review',
      client_id: 'client-001',
      profile_id: 'pro-001',
      date: '2026-04-10',
      slot_id: 'slot-09h',
      status: 'completed'
    });
  });

  test('devrait créer un avis pour un RDV terminé', async () => {
    const res = await request(app)
      .post('/api/appointments/reviews')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        appointment_id: 'apt-review',
        rating: 5,
        comment: 'Excellent service !'
      });

    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(5);
    expect(res.body.comment).toBe('Excellent service !');
  });

  test('devrait mettre à jour la note moyenne du professionnel', async () => {
    await request(app)
      .post('/api/appointments/reviews')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ appointment_id: 'apt-review', rating: 4 });

    const pro = await Professional.findOne({ profile_id: 'pro-001' });
    expect(pro.average_rating).toBe(4);
    expect(pro.review_count).toBe(1);
  });

  test('devrait refuser un avis sur un RDV non terminé', async () => {
    await Appointment.updateOne({ appointment_id: 'apt-review' }, { status: 'pending' });

    const res = await request(app)
      .post('/api/appointments/reviews')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ appointment_id: 'apt-review', rating: 5 });

    expect(res.status).toBe(400);
  });

  test('devrait refuser un double avis', async () => {
    await request(app)
      .post('/api/appointments/reviews')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ appointment_id: 'apt-review', rating: 5 });

    const res = await request(app)
      .post('/api/appointments/reviews')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ appointment_id: 'apt-review', rating: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('déjà');
  });

  test('devrait refuser une note invalide', async () => {
    const res = await request(app)
      .post('/api/appointments/reviews')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ appointment_id: 'apt-review', rating: 0 });

    expect(res.status).toBe(400);
  });

  test('devrait refuser un avis d\'un autre client', async () => {
    await User.create({
      user_id: 'client-other2',
      email: 'other2@example.com',
      password_hash: 'hash',
      first_name: 'Other',
      last_name: 'Client'
    });
    const otherToken = jwt.sign({ user_id: 'client-other2' }, process.env.JWT_SECRET);

    const res = await request(app)
      .post('/api/appointments/reviews')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ appointment_id: 'apt-review', rating: 5 });

    expect(res.status).toBe(403);
  });
});
