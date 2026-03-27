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
        // règle déterministe : environ 2 slots sur 3 dispo selon jour/pro/slot
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

    const passwordHash = await bcrypt.hash('password', 10);

    // ===== USERS =====
    const users = await User.insertMany(
      [
        {
          user_id: 'user-admin-001',
          email: 'admin@example.com',
          password_hash: passwordHash,
          first_name: 'Admin',
          last_name: 'HairPro',
          role: 'admin',
          status: 'active'
        },
        {
          user_id: 'user-pro-001',
          email: 'pro@example.com',
          password_hash: passwordHash,
          first_name: 'Sophie',
          last_name: 'Martin',
          role: 'pro',
          status: 'active'
        },
        {
          user_id: 'user-pro-002',
          email: 'pro2@example.com',
          password_hash: passwordHash,
          first_name: 'Lucas',
          last_name: 'Bernard',
          role: 'pro',
          status: 'active'
        },
        {
          user_id: 'user-pro-003',
          email: 'pro3@example.com',
          password_hash: passwordHash,
          first_name: 'Emma',
          last_name: 'Dubois',
          role: 'pro',
          status: 'active'
        },
        {
          user_id: 'user-pro-004',
          email: 'pro4@example.com',
          password_hash: passwordHash,
          first_name: 'Thomas',
          last_name: 'Leroy',
          role: 'pro',
          status: 'active'
        },
        {
          user_id: 'user-pro-005',
          email: 'pro5@example.com',
          password_hash: passwordHash,
          first_name: 'Camille',
          last_name: 'Moreau',
          role: 'pro',
          status: 'active'
        },
        {
          user_id: 'user-pro-006',
          email: 'pro6@example.com',
          password_hash: passwordHash,
          first_name: 'Julie',
          last_name: 'Petit',
          role: 'pro',
          status: 'active'
        },
        {
          user_id: 'user-client-001',
          email: 'client@example.com',
          password_hash: passwordHash,
          first_name: 'Marie',
          last_name: 'Dupont',
          role: 'client',
          status: 'active'
        },
        {
          user_id: 'user-client-002',
          email: 'client2@example.com',
          password_hash: passwordHash,
          first_name: 'Pierre',
          last_name: 'Laurent',
          role: 'client',
          status: 'active'
        }
      ],
      { ordered: true }
    );

    const [
      adminUser,
      proUser1,
      proUser2,
      proUser3,
      proUser4,
      proUser5,
      proUser6,
      clientUser,
      clientUser2
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
            "Coiffeuse passionnée avec 10 ans d'expérience. Spécialisée dans les colorations naturelles et les coupes modernes. Je me déplace chez vous dans tout Paris et sa proche banlieue.",
          city: 'Paris',
          lat: 48.8566,
          lng: 2.3522,
          radius_km: 15,
          photo_url: '',
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
          city: 'Lyon',
          lat: 45.764,
          lng: 4.8357,
          radius_km: 20,
          photo_url: '',
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
          photo_url: '',
          is_verified: true,
          is_active: true,
          average_rating: 4.9,
          review_count: 15
        },
        {
          profile_id: 'pro-004',
          user_id: proUser4.user_id,
          description:
            'Coiffeur polyvalent, homme et femme. Passionné par les nouvelles tendances. Formations régulières pour rester à la pointe.',
          city: 'Marseille',
          lat: 43.2965,
          lng: 5.3698,
          radius_km: 15,
          photo_url: '',
          is_verified: false,
          is_active: true,
          average_rating: 4.2,
          review_count: 5
        },
        {
          profile_id: 'pro-005',
          user_id: proUser5.user_id,
          description:
            'Experte en lissage brésilien, soins kératine et techniques de coloration balayage. Produits bio et naturels privilégiés.',
          city: 'Paris',
          lat: 48.845,
          lng: 2.36,
          radius_km: 10,
          photo_url: '',
          is_verified: true,
          is_active: true,
          average_rating: 4.7,
          review_count: 10
        },
        {
          profile_id: 'pro-006',
          user_id: proUser6.user_id,
          description:
            'Coiffeuse spécialisée cheveux bouclés et afro. Techniques de twist, tresses et soins adaptés. Ambiance chaleureuse et bienveillante.',
          city: 'Lyon',
          lat: 45.758,
          lng: 4.832,
          radius_km: 12,
          photo_url: '',
          is_verified: false,
          is_active: true,
          average_rating: 4.6,
          review_count: 7
        }
      ],
      { ordered: true }
    );

    console.log('Profils professionnels créés');

    // ===== SERVICES =====
    await Service.insertMany(
      [
        { service_id: 'svc-001', profile_id: 'pro-001', name: 'Coupe femme', estimated_price: 35, duration: 45 },
        { service_id: 'svc-002', profile_id: 'pro-001', name: 'Coloration', estimated_price: 55, duration: 90 },
        { service_id: 'svc-003', profile_id: 'pro-001', name: 'Balayage', estimated_price: 70, duration: 120 },
        { service_id: 'svc-004', profile_id: 'pro-001', name: 'Brushing', estimated_price: 25, duration: 30 },

        { service_id: 'svc-005', profile_id: 'pro-002', name: 'Coupe homme', estimated_price: 20, duration: 30 },
        { service_id: 'svc-006', profile_id: 'pro-002', name: 'Taille de barbe', estimated_price: 15, duration: 20 },
        { service_id: 'svc-007', profile_id: 'pro-002', name: 'Coupe + Barbe', estimated_price: 30, duration: 45 },
        { service_id: 'svc-008', profile_id: 'pro-002', name: 'Dégradé', estimated_price: 25, duration: 40 },

        { service_id: 'svc-009', profile_id: 'pro-003', name: 'Coiffure mariage', estimated_price: 120, duration: 120 },
        { service_id: 'svc-010', profile_id: 'pro-003', name: 'Chignon', estimated_price: 60, duration: 60 },
        { service_id: 'svc-011', profile_id: 'pro-003', name: 'Essai coiffure', estimated_price: 80, duration: 90 },
        { service_id: 'svc-012', profile_id: 'pro-003', name: 'Coupe femme', estimated_price: 40, duration: 45 },

        { service_id: 'svc-013', profile_id: 'pro-004', name: 'Coupe homme', estimated_price: 18, duration: 30 },
        { service_id: 'svc-014', profile_id: 'pro-004', name: 'Coupe femme', estimated_price: 30, duration: 45 },
        { service_id: 'svc-015', profile_id: 'pro-004', name: 'Coloration', estimated_price: 45, duration: 90 },

        { service_id: 'svc-016', profile_id: 'pro-005', name: 'Lissage brésilien', estimated_price: 150, duration: 180 },
        { service_id: 'svc-017', profile_id: 'pro-005', name: 'Soin kératine', estimated_price: 90, duration: 120 },
        { service_id: 'svc-018', profile_id: 'pro-005', name: 'Balayage', estimated_price: 75, duration: 120 },
        { service_id: 'svc-019', profile_id: 'pro-005', name: 'Coupe + Brushing', estimated_price: 50, duration: 60 },

        { service_id: 'svc-020', profile_id: 'pro-006', name: 'Tresses africaines', estimated_price: 60, duration: 120 },
        { service_id: 'svc-021', profile_id: 'pro-006', name: 'Twist', estimated_price: 45, duration: 90 },
        { service_id: 'svc-022', profile_id: 'pro-006', name: 'Soin cheveux bouclés', estimated_price: 40, duration: 60 },
        { service_id: 'svc-023', profile_id: 'pro-006', name: 'Coupe afro', estimated_price: 35, duration: 45 }
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
          comment: "Sophie est incroyable ! Ma coloration est exactement ce que je voulais. Très professionnelle et à l'écoute.",
          is_visible: true
        },
        {
          review_id: 'rev-002',
          client_id: clientUser2.user_id,
          profile_id: 'pro-001',
          appointment_id: 'apt-005',
          rating: 5,
          comment: 'Excellente coupe, je recommande vivement ! Sophie est très sympa et talentueuse.',
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
          comment: "Lissage parfait, mes cheveux n'ont jamais été aussi beaux !",
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
        { favorite_id: uuidv4(), user_id: clientUser.user_id, profile_id: 'pro-005' },
        { favorite_id: uuidv4(), user_id: clientUser2.user_id, profile_id: 'pro-002' }
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
          content: "Bonjour Sophie, j'ai réservé pour mercredi matin. Est-ce que vous pourriez apporter des échantillons de couleurs ?",
          is_read: true
        },
        {
          message_id: uuidv4(),
          conversation_id: 'conv-001',
          sender_id: proUser1.user_id,
          content: "Bonjour Marie ! Bien sûr, je viendrai avec mon nuancier complet. Avez-vous une idée de la couleur souhaitée ?",
          is_read: true
        },
        {
          message_id: uuidv4(),
          conversation_id: 'conv-001',
          sender_id: clientUser.user_id,
          content: "Je pensais à un blond cendré, mais je suis ouverte à vos suggestions !",
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
          content: "Bonjour Marie ! Moi aussi ! Pouvez-vous m'envoyer des photos d'inspiration ?",
          is_read: false
        }
      ],
      { ordered: true }
    );

    console.log('Conversations et messages créés');

    // ===== SUBSCRIPTION =====
    await Subscription.create({
      subscription_id: uuidv4(),
      user_id: proUser1.user_id,
      plan: 'monthly',
      status: 'active',
      current_period_end: addDays(today, 25)
    });

    console.log('Abonnements créés');

    console.log('\n✅ Seed terminé avec succès !');
    console.log(`Base utilisée : ${mongoose.connection.name}`);
    console.log('\nComptes de test :');
    console.log('  Admin  : admin@example.com / password');
    console.log('  Pro    : pro@example.com / password');
    console.log('  Client : client@example.com / password');
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