/**
 * @file Configuration globale des tests backend
 * @description Initialise une instance MongoDB en mémoire (MongoMemoryServer)
 * pour isoler les tests de la base de données de production.
 * Gère le cycle de vie de la connexion (connexion, déconnexion, nettoyage).
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
