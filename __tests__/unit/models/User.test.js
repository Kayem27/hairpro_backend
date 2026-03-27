const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../../models/User');

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
  await User.deleteMany({});
});

describe('User Model', () => {
  const validUser = {
    user_id: 'test-user-001',
    email: 'test@example.com',
    password_hash: '$2a$10$hashedpassword',
    first_name: 'Jean',
    last_name: 'Dupont',
  };

  test('devrait créer un utilisateur avec des données valides', async () => {
    const user = await User.create(validUser);
    expect(user.user_id).toBe('test-user-001');
    expect(user.email).toBe('test@example.com');
    expect(user.first_name).toBe('Jean');
    expect(user.last_name).toBe('Dupont');
    expect(user.role).toBe('client'); // default
    expect(user.status).toBe('active'); // default
    expect(user.email_verified).toBe(false); // default
    expect(user.created_at).toBeInstanceOf(Date);
  });

  test('devrait échouer sans user_id', async () => {
    const { user_id, ...noId } = validUser;
    await expect(User.create(noId)).rejects.toThrow();
  });

  test('devrait échouer sans email', async () => {
    const { email, ...noEmail } = validUser;
    await expect(User.create(noEmail)).rejects.toThrow();
  });

  test('devrait échouer sans password_hash', async () => {
    const { password_hash, ...noPassword } = validUser;
    await expect(User.create(noPassword)).rejects.toThrow();
  });

  test('devrait échouer sans first_name', async () => {
    const { first_name, ...noFirstName } = validUser;
    await expect(User.create(noFirstName)).rejects.toThrow();
  });

  test('devrait échouer sans last_name', async () => {
    const { last_name, ...noLastName } = validUser;
    await expect(User.create(noLastName)).rejects.toThrow();
  });

  test('devrait refuser un email dupliqué', async () => {
    await User.create(validUser);
    const duplicate = { ...validUser, user_id: 'test-user-002' };
    await expect(User.create(duplicate)).rejects.toThrow();
  });

  test('devrait refuser un user_id dupliqué', async () => {
    await User.create(validUser);
    const duplicate = { ...validUser, email: 'other@example.com' };
    await expect(User.create(duplicate)).rejects.toThrow();
  });

  test('devrait convertir l\'email en minuscules', async () => {
    const user = await User.create({ ...validUser, email: 'TEST@EXAMPLE.COM' });
    expect(user.email).toBe('test@example.com');
  });

  test('devrait accepter les rôles valides', async () => {
    for (const role of ['client', 'pro', 'admin']) {
      const user = await User.create({
        ...validUser,
        user_id: `test-${role}`,
        email: `${role}@example.com`,
        role
      });
      expect(user.role).toBe(role);
    }
  });

  test('devrait refuser un rôle invalide', async () => {
    await expect(
      User.create({ ...validUser, role: 'superadmin' })
    ).rejects.toThrow();
  });

  test('devrait accepter les statuts valides', async () => {
    for (const status of ['active', 'inactive', 'suspended']) {
      const user = await User.create({
        ...validUser,
        user_id: `test-${status}`,
        email: `${status}@example.com`,
        status
      });
      expect(user.status).toBe(status);
    }
  });

  test('devrait refuser un statut invalide', async () => {
    await expect(
      User.create({ ...validUser, status: 'banned' })
    ).rejects.toThrow();
  });

  test('devrait avoir les champs de reset à null par défaut', async () => {
    const user = await User.create(validUser);
    expect(user.reset_token).toBeNull();
    expect(user.reset_token_expires).toBeNull();
    expect(user.email_verification_token).toBeNull();
  });
});
