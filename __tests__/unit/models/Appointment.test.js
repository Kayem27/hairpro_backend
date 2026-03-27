const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Appointment = require('../../../models/Appointment');

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
  await Appointment.deleteMany({});
});

describe('Appointment Model', () => {
  const validAppointment = {
    appointment_id: 'apt-001',
    client_id: 'user-001',
    profile_id: 'pro-001',
    date: '2026-04-15',
    slot_id: 'slot-09h',
  };

  test('devrait créer un rendez-vous avec des données valides', async () => {
    const apt = await Appointment.create(validAppointment);
    expect(apt.appointment_id).toBe('apt-001');
    expect(apt.client_id).toBe('user-001');
    expect(apt.profile_id).toBe('pro-001');
    expect(apt.date).toBe('2026-04-15');
    expect(apt.slot_id).toBe('slot-09h');
    expect(apt.status).toBe('pending');
    expect(apt.notes).toBe('');
    expect(apt.service_ids).toEqual([]);
  });

  test('devrait échouer sans champs obligatoires', async () => {
    await expect(Appointment.create({})).rejects.toThrow();
    await expect(Appointment.create({ appointment_id: 'apt-001' })).rejects.toThrow();
  });

  test('devrait accepter les statuts valides', async () => {
    const statuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'];
    for (let i = 0; i < statuses.length; i++) {
      const apt = await Appointment.create({
        ...validAppointment,
        appointment_id: `apt-${i}`,
        status: statuses[i]
      });
      expect(apt.status).toBe(statuses[i]);
    }
  });

  test('devrait refuser un statut invalide', async () => {
    await expect(
      Appointment.create({ ...validAppointment, status: 'unknown' })
    ).rejects.toThrow();
  });

  test('devrait stocker les service_ids', async () => {
    const apt = await Appointment.create({
      ...validAppointment,
      service_ids: ['svc-001', 'svc-002']
    });
    expect(apt.service_ids).toHaveLength(2);
    expect(apt.service_ids).toContain('svc-001');
  });

  test('devrait permettre la transition de statut', async () => {
    const apt = await Appointment.create(validAppointment);
    expect(apt.status).toBe('pending');

    apt.status = 'accepted';
    await apt.save();
    expect(apt.status).toBe('accepted');

    apt.status = 'completed';
    await apt.save();
    expect(apt.status).toBe('completed');
  });
});
