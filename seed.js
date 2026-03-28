require('dotenv').config();

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const User = require('./models/User');
const Professional = require('./models/Professional');
const Service = require('./models/Service');
const TimeSlot = require('./models/TimeSlot');
const Availability = require('./models/Availability');
const Appointment = require('./models/Appointment');
const Review = require('./models/Review');
const Favorite = require('./models/Favorite');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const PortfolioImage = require('./models/PortfolioImage');
const Subscription = require('./models/Subscription');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/hairpro';

function assertValidMongoUrl(uri) {
  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname?.replace('/', '').trim();

    if (!dbName) {
      throw new Error(
        'MONGO_URL invalide : aucun nom de base détecté. Exemple attendu : mongodb+srv://user:pass@cluster.mongodb.net/hairpro?retryWrites=true&w=majority'
      );
    }
  } catch (error) {
    throw new Error(`MONGO_URL invalide : ${error.message}`);
  }
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d;
}

async function connectToDatabase() {
  assertValidMongoUrl(MONGO_URL);

  await mongoose.connect(MONGO_URL, {
    serverSelectionTimeoutMS: 10000,
    family: 4
  });

  console.log(`MongoDB connecté : ${mongoose.connection.name}`);
}

async function clearCollections() {
  await Promise.all([
    Message.deleteMany({}),
    Conversation.deleteMany({}),
    Favorite.deleteMany({}),
    Review.deleteMany({}),
    Appointment.deleteMany({}),
    Availability.deleteMany({}),
    PortfolioImage.deleteMany({}),
    Service.deleteMany({}),
    Subscription.deleteMany({}),
    Professional.deleteMany({}),
    TimeSlot.deleteMany({}),
    User.deleteMany({})
  ]);

  console.log('Collections vidées');
}

function buildDeterministicAvailabilities(profileIds, slotIds, days = 14) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const availabilities = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const dateStr = formatDateOnly(date);

    for (let p = 0; p < profileIds.length; p++) {
      for (let s = 0; s < slotIds.length; s++) {
        const isAvailable = ((i + p + s) % 3) !== 0;

        if (isAvailable) {
          availabilities.push({
            availability_id: uuidv4(),
            profile_id: profileIds[p],
            date: dateStr,
            slot_id: slotIds[s],
            status: 'available'
          });
        }
      }
    }
  }

  return availabilities;
}

async function seed() {
  try {
    await connectToDatabase();

    await clearCollections();

    // Mots de passe
    const strongHash = await bcrypt.hash('H@irpro6437', 10);
    const fakeHash = await bcrypt.hash('FakeUser123!', 10);

    // ===== USERS =====
    const users = await User.insertMany(
      [
        // --- Admin (réel) ---
        {
          user_id: 'user-admin-001',
          email: 'abdoulatuf.pro@gmail.com',
          password_hash: strongHash,
          first_name: 'Abdou',
          last_name: 'Latuf',
          role: 'admin',
          status: 'active',
          email_verified: true
        },
        // --- Pro réel ---
        {
          user_id: 'user-pro-001',
          email: 'abdoulatuf.hatem02@gmail.com',
          password_hash: strongHash,
          first_name: 'Hatem',
          last_name: 'Bouazza',
          role: 'pro',
          status: 'active',
          email_verified: true
        },
        // --- Pros fictifs ---
        {
          user_id: 'user-pro-002',
          email: 'lucas.bernard@fakehairpro.test',
          password_hash: fakeHash,
          first_name: 'Lucas',
          last_name: 'Bernard',
          role: 'pro',
          status: 'active',
          email_verified: true
        },
        {
          user_id: 'user-pro-003',
          email: 'emma.dubois@fakehairpro.test',
          password_hash: fakeHash,
          first_name: 'Emma',
          last_name: 'Dubois',
          role: 'pro',
          status: 'active',
          email_verified: true
        },
        {
          user_id: 'user-pro-004',
          email: 'thomas.leroy@fakehairpro.test',
          password_hash: fakeHash,
          first_name: 'Thomas',
          last_name: 'Leroy',
          role: 'pro',
          status: 'active',
          email_verified: true
        },
        {
          user_id: 'user-pro-005',
          email: 'camille.moreau@fakehairpro.test',
          password_hash: fakeHash,
          first_name: 'Camille',
          last_name: 'Moreau',
          role: 'pro',
          status: 'active',
          email_verified: true
        },
        {
          user_id: 'user-pro-006',
          email: 'aminata.diallo@fakehairpro.test',
          password_hash: fakeHash,
          first_name: 'Aminata',
          last_name: 'Diallo',
          role: 'pro',
          status: 'active',
          email_verified: true
        },
        // --- Client réel ---
        {
          user_id: 'user-client-001',
          email: 'kyrsirius52@gmail.com',
          password_hash: strongHash,
          first_name: 'Kyrian',
          last_name: 'Sirius',
          role: 'client',
          status: 'active',
          email_verified: true
        },
        // --- Client fictif ---
        {
          user_id: 'user-client-002',
          email: 'pierre.laurent@fakehairpro.test',
          password_hash: fakeHash,
          first_name: 'Pierre',
          last_name: 'Laurent',
          role: 'client',
          status: 'active',
          email_verified: true
        }
      ],
      { ordered: true }
    );

    const [
      adminUser,
      proUser1, proUser2, proUser3, proUser4, proUser5, proUser6,
      clientUser, clientUser2
    ] = users;

    console.log('Utilisateurs créés');

    // ===== TIME SLOTS =====
    await TimeSlot.insertMany(
      [
        { slot_id: 'slot-morning', label: 'Matin', start_time: '08:00', end_time: '12:00' },
        { slot_id: 'slot-afternoon', label: 'Après-midi', start_time: '13:00', end_time: '17:00' },
        { slot_id: 'slot-evening', label: 'Soir', start_time: '18:00', end_time: '21:00' }
      ],
      { ordered: true }
    );

    console.log('Créneaux créés');

    // ===== PROFESSIONALS =====
    await Professional.insertMany(
      [
        {
          profile_id: 'pro-001',
          user_id: proUser1.user_id,
          description:
            "Coiffeur passionné avec 8 ans d'expérience. Spécialisé dans les coupes modernes homme et femme, colorations et techniques tendance. Je me déplace chez vous dans tout Paris.",
          city: 'Paris',
          lat: 48.8566,
          lng: 2.3522,
          radius_km: 15,
          photo_url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&h=400&fit=crop&crop=face',
          is_verified: true,
          is_active: true,
          average_rating: 4.8,
          review_count: 12
        },
        {
          profile_id: 'pro-002',
          user_id: proUser2.user_id,
          description:
            'Barbier et coiffeur homme. Expert en dégradés, tailles de barbe et soins capillaires masculins. Ambiance détendue garantie !',
          city: 'Paris',
          lat: 48.8606,
          lng: 2.3376,
          radius_km: 20,
          photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
          is_verified: true,
          is_active: true,
          average_rating: 4.5,
          review_count: 8
        },
        {
          profile_id: 'pro-003',
          user_id: proUser3.user_id,
          description:
            'Spécialiste des coiffures de mariage et événements. Maquillage et coiffure pour vos plus beaux jours. Diplômée des plus grandes écoles parisiennes.',
          city: 'Paris',
          lat: 48.87,
          lng: 2.34,
          radius_km: 25,
          photo_url: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400&h=400&fit=crop&crop=face',
          is_verified: true,
          is_active: true,
          average_rating: 4.9,
          review_count: 15
        },
        {
          profile_id: 'pro-004',
          user_id: proUser4.user_id,
          description:
            'Coiffeur polyvalent homme et femme. Passionné par les nouvelles tendances. Formations régulières pour rester à la pointe de la mode capillaire.',
          city: 'Paris',
          lat: 48.845,
          lng: 2.375,
          radius_km: 15,
          photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
          is_verified: true,
          is_active: true,
          average_rating: 4.3,
          review_count: 6
        },
        {
          profile_id: 'pro-005',
          user_id: proUser5.user_id,
          description:
            'Experte en lissage brésilien, soins kératine et techniques de coloration balayage. Produits bio et naturels privilégiés pour le respect de vos cheveux.',
          city: 'Paris',
          lat: 48.852,
          lng: 2.36,
          radius_km: 10,
          photo_url: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=400&h=400&fit=crop&crop=face',
          is_verified: true,
          is_active: true,
          average_rating: 4.7,
          review_count: 10
        },
        {
          profile_id: 'pro-006',
          user_id: proUser6.user_id,
          description:
            'Coiffeuse spécialisée cheveux bouclés, crépus et afro. Techniques de twist, tresses, tissages et soins adaptés. Ambiance chaleureuse et bienveillante.',
          city: 'Paris',
          lat: 48.865,
          lng: 2.325,
          radius_km: 12,
          photo_url: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=400&h=400&fit=crop&crop=face',
          is_verified: true,
          is_active: true,
          average_rating: 4.6,
          review_count: 9
        }
      ],
      { ordered: true }
    );

    console.log('Profils professionnels créés');

    // ===== PORTFOLIO IMAGES =====
    await PortfolioImage.insertMany(
      [
        // Pro 1 - Hatem (coupes modernes)
        { image_id: uuidv4(), profile_id: 'pro-001', url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-001', url: 'https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-001', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=600&fit=crop' },

        // Pro 2 - Lucas (barbier)
        { image_id: uuidv4(), profile_id: 'pro-002', url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-002', url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-002', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&h=600&fit=crop' },

        // Pro 3 - Emma (mariage)
        { image_id: uuidv4(), profile_id: 'pro-003', url: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-003', url: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-003', url: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&h=600&fit=crop' },

        // Pro 4 - Thomas (polyvalent)
        { image_id: uuidv4(), profile_id: 'pro-004', url: 'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-004', url: 'https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=600&h=600&fit=crop' },

        // Pro 5 - Camille (lissage/coloration)
        { image_id: uuidv4(), profile_id: 'pro-005', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-005', url: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-005', url: 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&h=600&fit=crop' },

        // Pro 6 - Aminata (afro/tresses)
        { image_id: uuidv4(), profile_id: 'pro-006', url: 'https://images.unsplash.com/photo-1595959183082-7b570b7e1e6b?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-006', url: 'https://images.unsplash.com/photo-1522337094846-8a818d899ae4?w=600&h=600&fit=crop' },
        { image_id: uuidv4(), profile_id: 'pro-006', url: 'https://images.unsplash.com/photo-1611042553365-9b101441c135?w=600&h=600&fit=crop' }
      ],
      { ordered: true }
    );

    console.log('Images portfolio créées');

    // ===== SERVICES =====
    await Service.insertMany(
      [
        // Pro 1 - Hatem (coupes modernes, coloration)
        { service_id: 'svc-001', profile_id: 'pro-001', name: 'Coupe femme', estimated_price: 35, duration: 45 },
        { service_id: 'svc-002', profile_id: 'pro-001', name: 'Coloration', estimated_price: 55, duration: 90 },
        { service_id: 'svc-003', profile_id: 'pro-001', name: 'Balayage', estimated_price: 70, duration: 120 },
        { service_id: 'svc-004', profile_id: 'pro-001', name: 'Brushing', estimated_price: 25, duration: 30 },

        // Pro 2 - Lucas (barbier)
        { service_id: 'svc-005', profile_id: 'pro-002', name: 'Coupe homme', estimated_price: 20, duration: 30 },
        { service_id: 'svc-006', profile_id: 'pro-002', name: 'Taille de barbe', estimated_price: 15, duration: 20 },
        { service_id: 'svc-007', profile_id: 'pro-002', name: 'Coupe + Barbe', estimated_price: 30, duration: 45 },
        { service_id: 'svc-008', profile_id: 'pro-002', name: 'Dégradé', estimated_price: 25, duration: 40 },

        // Pro 3 - Emma (mariage/événements)
        { service_id: 'svc-009', profile_id: 'pro-003', name: 'Coiffure mariage', estimated_price: 120, duration: 120 },
        { service_id: 'svc-010', profile_id: 'pro-003', name: 'Chignon', estimated_price: 60, duration: 60 },
        { service_id: 'svc-011', profile_id: 'pro-003', name: 'Essai coiffure', estimated_price: 80, duration: 90 },
        { service_id: 'svc-012', profile_id: 'pro-003', name: 'Coupe femme', estimated_price: 40, duration: 45 },

        // Pro 4 - Thomas (polyvalent)
        { service_id: 'svc-013', profile_id: 'pro-004', name: 'Coupe homme', estimated_price: 18, duration: 30 },
        { service_id: 'svc-014', profile_id: 'pro-004', name: 'Coupe femme', estimated_price: 30, duration: 45 },
        { service_id: 'svc-015', profile_id: 'pro-004', name: 'Coloration', estimated_price: 45, duration: 90 },

        // Pro 5 - Camille (lissage/soins)
        { service_id: 'svc-016', profile_id: 'pro-005', name: 'Lissage brésilien', estimated_price: 150, duration: 180 },
        { service_id: 'svc-017', profile_id: 'pro-005', name: 'Soin kératine', estimated_price: 90, duration: 120 },
        { service_id: 'svc-018', profile_id: 'pro-005', name: 'Balayage', estimated_price: 75, duration: 120 },
        { service_id: 'svc-019', profile_id: 'pro-005', name: 'Coupe + Brushing', estimated_price: 50, duration: 60 },

        // Pro 6 - Aminata (afro/tresses)
        { service_id: 'svc-020', profile_id: 'pro-006', name: 'Tresses africaines', estimated_price: 60, duration: 120 },
        { service_id: 'svc-021', profile_id: 'pro-006', name: 'Twist', estimated_price: 45, duration: 90 },
        { service_id: 'svc-022', profile_id: 'pro-006', name: 'Soin cheveux bouclés', estimated_price: 40, duration: 60 },
        { service_id: 'svc-023', profile_id: 'pro-006', name: 'Tissage', estimated_price: 80, duration: 150 }
      ],
      { ordered: true }
    );

    console.log('Services créés');

    // ===== AVAILABILITY =====
    const slotIds = ['slot-morning', 'slot-afternoon', 'slot-evening'];
    const profileIds = ['pro-001', 'pro-002', 'pro-003', 'pro-004', 'pro-005', 'pro-006'];

    const availabilities = buildDeterministicAvailabilities(profileIds, slotIds, 14);
    await Availability.insertMany(availabilities, { ordered: true });

    console.log('Disponibilités créées');

    // ===== APPOINTMENTS =====
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    await Appointment.insertMany(
      [
        {
          appointment_id: 'apt-001',
          client_id: clientUser.user_id,
          profile_id: 'pro-001',
          date: formatDateOnly(addDays(today, 2)),
          slot_id: 'slot-morning',
          status: 'accepted',
          notes: 'Je souhaite une coupe avec un léger dégradé',
          service_ids: ['svc-001']
        },
        {
          appointment_id: 'apt-002',
          client_id: clientUser.user_id,
          profile_id: 'pro-003',
          date: formatDateOnly(addDays(today, 5)),
          slot_id: 'slot-afternoon',
          status: 'pending',
          notes: 'Mariage le mois prochain, je voudrais un essai',
          service_ids: ['svc-011']
        },
        {
          appointment_id: 'apt-003',
          client_id: clientUser.user_id,
          profile_id: 'pro-001',
          date: formatDateOnly(addDays(today, -7)),
          slot_id: 'slot-afternoon',
          status: 'completed',
          notes: 'Coloration blonde cendrée',
          service_ids: ['svc-002']
        },
        {
          appointment_id: 'apt-004',
          client_id: clientUser2.user_id,
          profile_id: 'pro-002',
          date: formatDateOnly(addDays(today, -3)),
          slot_id: 'slot-morning',
          status: 'completed',
          notes: 'Dégradé classique',
          service_ids: ['svc-008']
        },
        {
          appointment_id: 'apt-005',
          client_id: clientUser2.user_id,
          profile_id: 'pro-001',
          date: formatDateOnly(addDays(today, -14)),
          slot_id: 'slot-evening',
          status: 'completed',
          notes: '',
          service_ids: ['svc-001', 'svc-004']
        },
        {
          appointment_id: 'apt-006',
          client_id: clientUser.user_id,
          profile_id: 'pro-003',
          date: formatDateOnly(addDays(today, -10)),
          slot_id: 'slot-morning',
          status: 'completed',
          notes: 'Essai coiffure pour mariage civil',
          service_ids: ['svc-011']
        },
        {
          appointment_id: 'apt-007',
          client_id: clientUser2.user_id,
          profile_id: 'pro-005',
          date: formatDateOnly(addDays(today, -6)),
          slot_id: 'slot-afternoon',
          status: 'completed',
          notes: 'Lissage + soin',
          service_ids: ['svc-016']
        },
        {
          appointment_id: 'apt-008',
          client_id: clientUser.user_id,
          profile_id: 'pro-006',
          date: formatDateOnly(addDays(today, -5)),
          slot_id: 'slot-morning',
          status: 'completed',
          notes: 'Tresses pour un événement',
          service_ids: ['svc-020']
        },
        {
          appointment_id: 'apt-009',
          client_id: clientUser2.user_id,
          profile_id: 'pro-004',
          date: formatDateOnly(addDays(today, -4)),
          slot_id: 'slot-afternoon',
          status: 'completed',
          notes: 'Coupe classique',
          service_ids: ['svc-013']
        }
      ],
      { ordered: true }
    );

    console.log('Rendez-vous créés');

    // ===== REVIEWS =====
    await Review.insertMany(
      [
        {
          review_id: 'rev-001',
          client_id: clientUser.user_id,
          profile_id: 'pro-001',
          appointment_id: 'apt-003',
          rating: 5,
          comment: "Hatem est incroyable ! Ma coloration est exactement ce que je voulais. Très professionnel et à l'écoute.",
          is_visible: true
        },
        {
          review_id: 'rev-002',
          client_id: clientUser2.user_id,
          profile_id: 'pro-001',
          appointment_id: 'apt-005',
          rating: 5,
          comment: 'Excellente coupe, je recommande vivement ! Hatem est très sympa et talentueux.',
          is_visible: true
        },
        {
          review_id: 'rev-003',
          client_id: clientUser2.user_id,
          profile_id: 'pro-002',
          appointment_id: 'apt-004',
          rating: 4,
          comment: 'Très bon dégradé, Lucas maîtrise bien son art. Un peu en retard mais le résultat était top.',
          is_visible: true
        },
        {
          review_id: 'rev-004',
          client_id: clientUser.user_id,
          profile_id: 'pro-003',
          appointment_id: 'apt-006',
          rating: 5,
          comment: 'Emma est une artiste ! Ma coiffure de mariage était magnifique.',
          is_visible: true
        },
        {
          review_id: 'rev-005',
          client_id: clientUser2.user_id,
          profile_id: 'pro-005',
          appointment_id: 'apt-007',
          rating: 5,
          comment: "Lissage parfait, mes cheveux n'ont jamais été aussi beaux ! Camille est une experte.",
          is_visible: true
        },
        {
          review_id: 'rev-006',
          client_id: clientUser.user_id,
          profile_id: 'pro-006',
          appointment_id: 'apt-008',
          rating: 5,
          comment: 'Aminata fait des tresses magnifiques ! Très patiente et le résultat est superbe.',
          is_visible: true
        },
        {
          review_id: 'rev-007',
          client_id: clientUser2.user_id,
          profile_id: 'pro-004',
          appointment_id: 'apt-009',
          rating: 4,
          comment: 'Bonne coupe, Thomas est à la page niveau tendances. Je reviendrai.',
          is_visible: true
        }
      ],
      { ordered: true }
    );

    console.log('Avis créés');

    // ===== FAVORITES =====
    await Favorite.insertMany(
      [
        { favorite_id: uuidv4(), user_id: clientUser.user_id, profile_id: 'pro-001' },
        { favorite_id: uuidv4(), user_id: clientUser.user_id, profile_id: 'pro-003' },
        { favorite_id: uuidv4(), user_id: clientUser.user_id, profile_id: 'pro-006' },
        { favorite_id: uuidv4(), user_id: clientUser2.user_id, profile_id: 'pro-002' },
        { favorite_id: uuidv4(), user_id: clientUser2.user_id, profile_id: 'pro-005' }
      ],
      { ordered: true }
    );

    console.log('Favoris créés');

    // ===== CONVERSATIONS & MESSAGES =====
    await Conversation.insertMany(
      [
        {
          conversation_id: 'conv-001',
          participants: [clientUser.user_id, proUser1.user_id],
          appointment_id: 'apt-001'
        },
        {
          conversation_id: 'conv-002',
          participants: [clientUser.user_id, proUser3.user_id],
          appointment_id: 'apt-002'
        }
      ],
      { ordered: true }
    );

    await Message.insertMany(
      [
        {
          message_id: uuidv4(),
          conversation_id: 'conv-001',
          sender_id: clientUser.user_id,
          content: "Bonjour Hatem, j'ai réservé pour mercredi matin. Est-ce que vous pourriez apporter des échantillons de couleurs ?",
          is_read: true
        },
        {
          message_id: uuidv4(),
          conversation_id: 'conv-001',
          sender_id: proUser1.user_id,
          content: "Bonjour Kyrian ! Bien sûr, je viendrai avec mon nuancier complet. Avez-vous une idée de la couleur souhaitée ?",
          is_read: true
        },
        {
          message_id: uuidv4(),
          conversation_id: 'conv-001',
          sender_id: clientUser.user_id,
          content: "Je pensais à un blond cendré, mais je suis ouvert à vos suggestions !",
          is_read: false
        },
        {
          message_id: uuidv4(),
          conversation_id: 'conv-002',
          sender_id: clientUser.user_id,
          content: "Bonjour Emma, j'ai hâte de notre essai coiffure !",
          is_read: true
        },
        {
          message_id: uuidv4(),
          conversation_id: 'conv-002',
          sender_id: proUser3.user_id,
          content: "Bonjour Kyrian ! Moi aussi ! Pouvez-vous m'envoyer des photos d'inspiration ?",
          is_read: false
        }
      ],
      { ordered: true }
    );

    console.log('Conversations et messages créés');

    // ===== SUBSCRIPTIONS (tous les pros actifs) =====
    await Subscription.insertMany(
      [
        {
          subscription_id: uuidv4(),
          user_id: proUser1.user_id,
          plan: 'monthly',
          status: 'active',
          current_period_end: addDays(today, 25)
        },
        {
          subscription_id: uuidv4(),
          user_id: proUser2.user_id,
          plan: 'monthly',
          status: 'active',
          current_period_end: addDays(today, 20)
        },
        {
          subscription_id: uuidv4(),
          user_id: proUser3.user_id,
          plan: 'annual',
          status: 'active',
          current_period_end: addDays(today, 180)
        },
        {
          subscription_id: uuidv4(),
          user_id: proUser4.user_id,
          plan: 'monthly',
          status: 'active',
          current_period_end: addDays(today, 15)
        },
        {
          subscription_id: uuidv4(),
          user_id: proUser5.user_id,
          plan: 'annual',
          status: 'active',
          current_period_end: addDays(today, 300)
        },
        {
          subscription_id: uuidv4(),
          user_id: proUser6.user_id,
          plan: 'monthly',
          status: 'active',
          current_period_end: addDays(today, 10)
        }
      ],
      { ordered: true }
    );

    console.log('Abonnements créés (6 pros actifs)');

    console.log('\n✅ Seed terminé avec succès !');
    console.log(`Base utilisée : ${mongoose.connection.name}`);
    console.log('\nComptes :');
    console.log('  Admin  : abdoulatuf.pro@gmail.com / H@irpro6437');
    console.log('  Pro    : abdoulatuf.hatem02@gmail.com / H@irpro6437');
    console.log('  Client : kyrsirius52@gmail.com / H@irpro6437');
  } catch (err) {
    console.error('\n❌ Erreur seed :');

    if (err?.name === 'ValidationError') {
      for (const field in err.errors) {
        console.error(`- ${field}: ${err.errors[field].message}`);
      }
    } else {
      console.error(err);
    }

    process.exitCode = 1;
  } finally {
    try {
      await mongoose.connection.close();
      console.log('\nConnexion MongoDB fermée');
    } catch (closeErr) {
      console.error('Erreur fermeture MongoDB:', closeErr);
    }
  }
}

seed();
