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

// ---------- Helpers ----------
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

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

// ---------- Reference data ----------
const CITIES = {
  Paris:     { lat: 48.8566, lng: 2.3522 },
  Lyon:      { lat: 45.7640, lng: 4.8357 },
  Marseille: { lat: 43.2965, lng: 5.3698 },
  Bordeaux:  { lat: 44.8378, lng: -0.5792 },
  Toulouse:  { lat: 43.6047, lng: 1.4442 },
  Lille:     { lat: 50.6292, lng: 3.0573 },
  Nantes:    { lat: 47.2184, lng: -1.5536 },
  Nice:      { lat: 43.7102, lng: 7.2620 },
  Strasbourg:{ lat: 48.5734, lng: 7.7521 },
  Rennes:    { lat: 48.1173, lng: -1.6778 }
};

// Service templates indexed by pro specialty
const SERVICE_TEMPLATES = {
  modern: [
    { name: 'Coupe femme',       estimated_price: 35, duration: 45 },
    { name: 'Coupe homme',       estimated_price: 22, duration: 30 },
    { name: 'Brushing',          estimated_price: 25, duration: 30 },
    { name: 'Coupe + Brushing',  estimated_price: 50, duration: 60 }
  ],
  color: [
    { name: 'Coloration',         estimated_price: 55, duration: 90 },
    { name: 'Balayage',           estimated_price: 75, duration: 120 },
    { name: 'Mèches',             estimated_price: 70, duration: 120 },
    { name: 'Patine',             estimated_price: 40, duration: 60 }
  ],
  barber: [
    { name: 'Coupe homme',        estimated_price: 22, duration: 30 },
    { name: 'Taille de barbe',    estimated_price: 15, duration: 20 },
    { name: 'Coupe + Barbe',      estimated_price: 32, duration: 45 },
    { name: 'Dégradé',            estimated_price: 25, duration: 40 },
    { name: 'Rasage traditionnel', estimated_price: 28, duration: 40 }
  ],
  bridal: [
    { name: 'Coiffure mariage',   estimated_price: 130, duration: 120 },
    { name: 'Chignon',            estimated_price: 65,  duration: 60 },
    { name: 'Essai coiffure',     estimated_price: 80,  duration: 90 },
    { name: 'Coiffure événement', estimated_price: 90,  duration: 90 }
  ],
  smoothing: [
    { name: 'Lissage brésilien',  estimated_price: 150, duration: 180 },
    { name: 'Soin kératine',      estimated_price: 90,  duration: 120 },
    { name: 'Défrisage',          estimated_price: 80,  duration: 120 },
    { name: 'Coupe + Lissage',    estimated_price: 170, duration: 200 }
  ],
  afro: [
    { name: 'Tresses africaines', estimated_price: 65, duration: 120 },
    { name: 'Vanilles',           estimated_price: 55, duration: 90 },
    { name: 'Twist',              estimated_price: 50, duration: 90 },
    { name: 'Tissage',            estimated_price: 85, duration: 150 },
    { name: 'Soin cheveux bouclés', estimated_price: 45, duration: 60 }
  ],
  kids: [
    { name: 'Coupe enfant',       estimated_price: 18, duration: 30 },
    { name: 'Coupe famille',      estimated_price: 60, duration: 90 }
  ]
};

const PORTFOLIO_POOL = [
  'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1595959183082-7b570b7e1e6b?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1522337094846-8a818d899ae4?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1611042553365-9b101441c135?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&h=600&fit=crop'
];

// Avatars hébergés sur Cloudinary (visages générés via thispersondoesnotexist.com).
// Séparés par genre pour assigner une photo cohérente à chaque pro.
const AVATAR_POOL_HOMME = [
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780765604/hairpro/avatars/homme-1.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780763490/hairpro/avatars/homme-2.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780763491/hairpro/avatars/homme-3.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780763493/hairpro/avatars/homme-5.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780765609/hairpro/avatars/homme-7.jpg'
];

const AVATAR_POOL_FEMME = [
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780763494/hairpro/avatars/femme-1.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780763495/hairpro/avatars/femme-2.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780765611/hairpro/avatars/femme-3.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780763497/hairpro/avatars/femme-4.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780763498/hairpro/avatars/femme-5.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780765614/hairpro/avatars/femme-6.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780763499/hairpro/avatars/femme-7.jpg',
  'https://res.cloudinary.com/dz7b1qlyw/image/upload/v1780765616/hairpro/avatars/femme-8.jpg'
];

// Prénoms féminins parmi les templates de pros (pour assigner le bon avatar).
const FEMALE_FIRST_NAMES = new Set([
  'Emma', 'Camille', 'Aminata', 'Sarah', 'Léa', 'Yasmine', 'Inès',
  'Marie', 'Clara', 'Awa', 'Manon', 'Soraya', 'Léonie'
]);
const isFemale = (firstName) => FEMALE_FIRST_NAMES.has(firstName);

// Pro templates : (firstName, lastName, city, specialty, description)
const PRO_TEMPLATES = [
  { firstName: 'Lucas',     lastName: 'Bernard',    city: 'Paris',     specialty: 'barber',    desc: "Barbier et coiffeur homme. Expert en dégradés, tailles de barbe et soins capillaires masculins." },
  { firstName: 'Emma',      lastName: 'Dubois',     city: 'Paris',     specialty: 'bridal',    desc: "Spécialiste des coiffures de mariage et événements. Diplômée des plus grandes écoles parisiennes." },
  { firstName: 'Thomas',    lastName: 'Leroy',      city: 'Paris',     specialty: 'modern',    desc: "Coiffeur polyvalent homme et femme. Passionné par les nouvelles tendances et les formations régulières." },
  { firstName: 'Camille',   lastName: 'Moreau',     city: 'Paris',     specialty: 'smoothing', desc: "Experte en lissage brésilien, soins kératine et balayage. Produits bio et naturels privilégiés." },
  { firstName: 'Aminata',   lastName: 'Diallo',     city: 'Paris',     specialty: 'afro',      desc: "Coiffeuse spécialisée cheveux bouclés, crépus et afro. Twist, tresses, tissages et soins adaptés." },
  { firstName: 'Sarah',     lastName: 'Cohen',      city: 'Paris',     specialty: 'color',     desc: "10 ans d'expérience en coloration. Spécialiste du balayage moderne et des techniques nordiques." },
  { firstName: 'Mehdi',     lastName: 'Belkacem',   city: 'Lyon',      specialty: 'barber',    desc: "Barbier passionné au cœur de Lyon. Coupes précises, soins de barbe et ambiance conviviale." },
  { firstName: 'Léa',       lastName: 'Garnier',    city: 'Lyon',      specialty: 'modern',    desc: "Coiffeuse à Lyon, formée chez Saint-Algue. Coupes contemporaines pour femmes et enfants." },
  { firstName: 'Julien',    lastName: 'Petit',      city: 'Lyon',      specialty: 'bridal',    desc: "Coiffeur événementiel basé à Lyon. Mariages, shootings, cérémonies — je me déplace dans toute la métropole." },
  { firstName: 'Yasmine',   lastName: 'Hadj',       city: 'Marseille', specialty: 'afro',      desc: "Spécialiste cheveux texturés à Marseille. Tresses, vanilles, locks et soins naturels." },
  { firstName: 'Antoine',   lastName: 'Rousseau',   city: 'Marseille', specialty: 'barber',    desc: "Barbier traditionnel à Marseille. Coupes homme, rasage à l'ancienne, taille de barbe." },
  { firstName: 'Inès',      lastName: 'Marchetti',  city: 'Marseille', specialty: 'color',     desc: "Coloriste à Marseille. Balayage, ombré, technique à la main pour un résultat sur-mesure." },
  { firstName: 'Marie',     lastName: 'Lemoine',    city: 'Bordeaux',  specialty: 'modern',    desc: "Coiffeuse à Bordeaux. Coupes femme/homme, brushing, conseils personnalisés à domicile." },
  { firstName: 'Romain',    lastName: 'Vidal',      city: 'Bordeaux',  specialty: 'smoothing', desc: "Spécialiste du lissage brésilien et japonais à Bordeaux. Soins en profondeur." },
  { firstName: 'Clara',     lastName: 'Fontaine',   city: 'Toulouse',  specialty: 'bridal',    desc: "Coiffure mariage et événement à Toulouse. Chignons, attaches, accessoires personnalisés." },
  { firstName: 'Hugo',      lastName: 'Renaud',     city: 'Toulouse',  specialty: 'modern',    desc: "Coiffeur toulousain polyvalent. Coupes mode, dégradés, conseils en stylisme." },
  { firstName: 'Awa',       lastName: 'Konaté',     city: 'Lille',     specialty: 'afro',      desc: "Coiffeuse afro à Lille. Tresses, twist, tissages, soins capillaires naturels." },
  { firstName: 'Pierre',    lastName: 'Lambert',    city: 'Lille',     specialty: 'barber',    desc: "Barbier à Lille. Coupes hommes tendance, taille de barbe, contours nets." },
  { firstName: 'Manon',     lastName: 'Caron',      city: 'Nantes',    specialty: 'kids',      desc: "Coiffeuse à Nantes spécialisée enfants et familles. Patience et douceur garanties." },
  { firstName: 'Olivier',   lastName: 'Joubert',    city: 'Nantes',    specialty: 'modern',    desc: "Coiffeur à domicile à Nantes. Coupes mixtes, brushing, événements." },
  { firstName: 'Soraya',    lastName: 'Bensaïd',    city: 'Nice',      specialty: 'color',     desc: "Coloriste à Nice. Spécialiste du soleil et du balayage californien." },
  { firstName: 'Jean-Paul', lastName: 'Reynaud',    city: 'Nice',      specialty: 'modern',    desc: "30 ans d'expérience. Coupes classiques et modernes pour femmes et hommes." },
  { firstName: 'Léonie',    lastName: 'Schmidt',    city: 'Strasbourg',specialty: 'modern',    desc: "Coiffeuse à Strasbourg. Coupes au carré, brushings et conseils personnalisés." },
  { firstName: 'Erwan',     lastName: 'Le Goff',    city: 'Rennes',    specialty: 'barber',    desc: "Barbier breton, mobile dans toute la métropole rennaise. Coupes hommes et taille de barbe." }
];

// Fake client templates
const CLIENT_TEMPLATES = [
  ['Pierre', 'Laurent'], ['Sophie', 'Martin'], ['Antoine', 'Bernard'], ['Julie', 'Petit'],
  ['Nicolas', 'Robert'], ['Léa', 'Richard'], ['Maxime', 'Durand'], ['Chloé', 'Dubois'],
  ['Vincent', 'Moreau'], ['Manon', 'Laurent'], ['Alexandre', 'Simon'], ['Pauline', 'Michel'],
  ['Romain', 'Lefèvre'], ['Élodie', 'Leroy'], ['Sébastien', 'Roux'], ['Anaïs', 'David'],
  ['Florian', 'Bertrand'], ['Mathilde', 'Morel'], ['Quentin', 'Fournier'], ['Marie', 'Girard'],
  ['Théo', 'Bonnet'], ['Audrey', 'Dupont'], ['Benjamin', 'Lambert'], ['Sarah', 'Fontaine'],
  ['Damien', 'Rousseau'], ['Sandra', 'Vincent'], ['Jérémy', 'Muller'], ['Laure', 'Lefebvre'],
  ['Étienne', 'François'], ['Aurélie', 'Henry']
];

const REVIEW_COMMENTS = [
  'Service excellent et très professionnel. Je recommande vivement !',
  'Pratique, ponctuel et le résultat est top.',
  "Très à l'écoute, le rendu correspond exactement à mes attentes.",
  "Une vraie pro, ambiance détendue à la maison. Je rebooke !",
  'Top du top, ma coupe a transformé mon look.',
  'Sympathique, doué et matériel impeccable. Parfait pour un service à domicile.',
  'Petit retard à signaler mais le résultat est très bon.',
  'Sans aucun doute le meilleur passage chez un coiffeur depuis longtemps.',
  'Service correct, dans l\'ensemble je suis satisfait.',
  'Vraiment ravi, hâte du prochain rendez-vous.',
  'Coupé propre, dégradé soigné, je recommande à mes amis.',
  'Une expérience à domicile très agréable. Merci !'
];

const SHORT_CITY = (city) => city.slice(0, 3).toLowerCase();

// ---------- Seed body ----------
async function seed() {
  try {
    await connectToDatabase();
    await clearCollections();

    // Mots de passe (hashs uniquement stockés en base)
    const strongHash = await bcrypt.hash('H@irpro6437', 10);
    const fakeHash   = await bcrypt.hash('FakeUser123!', 10);

    // ===== USERS =====
    // Real users (kept identical to previous seed)
    const realUsers = [
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
      {
        user_id: 'user-client-001',
        email: 'kyrsirius52@gmail.com',
        password_hash: strongHash,
        first_name: 'Kyrian',
        last_name: 'Sirius',
        role: 'client',
        status: 'active',
        email_verified: true
      }
    ];

    // Fake pro users (from templates)
    const proUserDocs = PRO_TEMPLATES.map((t, i) => {
      const seq = String(i + 2).padStart(3, '0'); // user-pro-002, 003, ...
      const emailLocal = `${t.firstName}.${t.lastName}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z.]/g, '');
      return {
        user_id: `user-pro-${seq}`,
        email: `${emailLocal}@fakehairpro.test`,
        password_hash: fakeHash,
        first_name: t.firstName,
        last_name: t.lastName,
        role: 'pro',
        status: 'active',
        email_verified: true
      };
    });

    // Fake client users
    const fakeClientDocs = CLIENT_TEMPLATES.map(([firstName, lastName], i) => {
      const seq = String(i + 2).padStart(3, '0'); // user-client-002, 003, ...
      const emailLocal = `${firstName}.${lastName}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z.]/g, '');
      return {
        user_id: `user-client-${seq}`,
        email: `${emailLocal}@fakehairpro.test`,
        password_hash: fakeHash,
        first_name: firstName,
        last_name: lastName,
        role: 'client',
        status: 'active',
        email_verified: true
      };
    });

    const allUsers = [...realUsers, ...proUserDocs, ...fakeClientDocs];
    await User.insertMany(allUsers, { ordered: true });
    console.log(`Utilisateurs créés : ${allUsers.length} (1 admin, ${1 + proUserDocs.length} pros, ${1 + fakeClientDocs.length} clients)`);

    const adminUser   = realUsers[0];
    const realProUser = realUsers[1];
    const realClient  = realUsers[2];
    const allProUsers     = [realProUser, ...proUserDocs];
    const allClientUsers  = [realClient, ...fakeClientDocs];

    // ===== TIME SLOTS =====
    await TimeSlot.insertMany(
      [
        { slot_id: 'slot-morning',   label: 'Matin',      start_time: '08:00', end_time: '12:00' },
        { slot_id: 'slot-afternoon', label: 'Après-midi', start_time: '13:00', end_time: '17:00' },
        { slot_id: 'slot-evening',   label: 'Soir',       start_time: '18:00', end_time: '21:00' }
      ],
      { ordered: true }
    );
    const slotIds = ['slot-morning', 'slot-afternoon', 'slot-evening'];
    console.log('Créneaux créés');

    // ===== PROFESSIONALS =====
    // Real pro (Hatem) : Paris, specialty modern + color
    const realProDescription =
      "Coiffeur passionné avec 8 ans d'expérience. Spécialisé dans les coupes modernes homme et femme, colorations et techniques tendance. Je me déplace chez vous dans tout Paris.";

    const proDocs = [];
    proDocs.push({
      profile_id: 'pro-001',
      user_id: realProUser.user_id,
      description: realProDescription,
      city: 'Paris',
      lat: CITIES.Paris.lat,
      lng: CITIES.Paris.lng,
      radius_km: 15,
      photo_url: AVATAR_POOL_HOMME[0], // Hatem est un homme

      is_verified: true,
      is_active: true,
      average_rating: 0,
      review_count: 0,
      // helper attached (not persisted as schema field, just for build)
      _specialty: 'modern_color'
    });

    // Compteurs séparés pour recycler les photos par genre.
    // Hatem (pro-001) ayant déjà pris la 1re photo homme, on démarre à 1 côté homme.
    let hommeIdx = 1;
    let femmeIdx = 0;
    PRO_TEMPLATES.forEach((t, i) => {
      const idx = i + 2; // pro-002 onwards
      const profileId = `pro-${String(idx).padStart(3, '0')}`;
      const photoUrl = isFemale(t.firstName)
        ? AVATAR_POOL_FEMME[femmeIdx++ % AVATAR_POOL_FEMME.length]
        : AVATAR_POOL_HOMME[hommeIdx++ % AVATAR_POOL_HOMME.length];
      const city = CITIES[t.city];
      const latJitter = (Math.random() - 0.5) * 0.02; // ~1 km
      const lngJitter = (Math.random() - 0.5) * 0.02;
      proDocs.push({
        profile_id: profileId,
        user_id: `user-pro-${String(idx).padStart(3, '0')}`,
        description: t.desc,
        city: t.city,
        lat: city.lat + latJitter,
        lng: city.lng + lngJitter,
        radius_km: rand(8, 25),
        photo_url: photoUrl,
        is_verified: true,
        is_active: true,
        average_rating: 0,
        review_count: 0,
        _specialty: t.specialty
      });
    });

    // Mongoose ignores fields not in schema, but cleaner to strip before insert
    const proDocsClean = proDocs.map(({ _specialty, ...rest }) => rest);
    await Professional.insertMany(proDocsClean, { ordered: true });
    console.log(`Profils professionnels créés : ${proDocs.length}`);

    // ===== SERVICES =====
    const serviceDocs = [];
    let svcCounter = 1;
    const servicesByPro = {}; // profile_id -> [service_id, ...]

    function addServicesForPro(profileId, specialtyKey) {
      // Two specialty groups + maybe kids variant for variety
      let groups = [];
      switch (specialtyKey) {
        case 'modern_color': groups = ['modern', 'color']; break;
        case 'modern':       groups = ['modern']; break;
        case 'color':        groups = ['color', 'modern']; break;
        case 'barber':       groups = ['barber']; break;
        case 'bridal':       groups = ['bridal', 'modern']; break;
        case 'smoothing':    groups = ['smoothing', 'modern']; break;
        case 'afro':         groups = ['afro']; break;
        case 'kids':         groups = ['kids', 'modern']; break;
        default:             groups = ['modern'];
      }
      // 25% chance to also offer kids
      if (Math.random() < 0.25 && !groups.includes('kids')) groups.push('kids');

      const services = [];
      groups.forEach((g) => {
        SERVICE_TEMPLATES[g].forEach((tpl) => {
          // avoid duplicate service names per pro
          if (services.some((s) => s.name === tpl.name)) return;
          services.push(tpl);
        });
      });

      // Keep 3 to 6 services
      const finalServices = pickN(services, Math.min(services.length, rand(3, 6)));

      const ids = [];
      finalServices.forEach((tpl) => {
        const svcId = `svc-${String(svcCounter++).padStart(3, '0')}`;
        ids.push(svcId);
        serviceDocs.push({
          service_id: svcId,
          profile_id: profileId,
          name: tpl.name,
          estimated_price: tpl.estimated_price,
          duration: tpl.duration
        });
      });
      servicesByPro[profileId] = ids;
    }

    proDocs.forEach((p) => addServicesForPro(p.profile_id, p._specialty));
    await Service.insertMany(serviceDocs, { ordered: true });
    console.log(`Services créés : ${serviceDocs.length}`);

    // ===== PORTFOLIO IMAGES =====
    const portfolioDocs = [];
    proDocs.forEach((p) => {
      const count = rand(2, 4);
      const urls = pickN(PORTFOLIO_POOL, count);
      urls.forEach((url) => {
        portfolioDocs.push({
          image_id: uuidv4(),
          profile_id: p.profile_id,
          url
        });
      });
    });
    await PortfolioImage.insertMany(portfolioDocs, { ordered: true });
    console.log(`Images portfolio créées : ${portfolioDocs.length}`);

    // ===== AVAILABILITY =====
    // 21 jours pour chaque pro, ~2/3 des créneaux disponibles
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const availabilityDocs = [];
    for (let d = 0; d < 21; d++) {
      const dateStr = formatDateOnly(addDays(today, d));
      proDocs.forEach((p, pIdx) => {
        slotIds.forEach((slotId, sIdx) => {
          const isAvailable = ((d + pIdx + sIdx) % 3) !== 0;
          if (isAvailable) {
            availabilityDocs.push({
              availability_id: uuidv4(),
              profile_id: p.profile_id,
              date: dateStr,
              slot_id: slotId,
              status: 'available'
            });
          }
        });
      });
    }
    await Availability.insertMany(availabilityDocs, { ordered: true });
    console.log(`Disponibilités créées : ${availabilityDocs.length}`);

    // ===== APPOINTMENTS =====
    // We build a realistic mix : ~60% completed (past), ~20% accepted (future),
    // ~15% pending (future), ~5% cancelled
    const appointmentDocs = [];
    let apptCounter = 1;

    function makeAppointment({ client_id, profile_id, daysOffset, slot_id, status, notes }) {
      const apptId = `apt-${String(apptCounter++).padStart(3, '0')}`;
      const proServices = servicesByPro[profile_id] || [];
      const svcCount = proServices.length ? rand(1, Math.min(2, proServices.length)) : 0;
      const service_ids = svcCount > 0 ? pickN(proServices, svcCount) : [];
      appointmentDocs.push({
        appointment_id: apptId,
        client_id,
        profile_id,
        date: formatDateOnly(addDays(today, daysOffset)),
        slot_id,
        status,
        notes: notes ?? '',
        service_ids
      });
      return apptId;
    }

    // Target counts
    const completedTarget = 70;
    const acceptedTarget  = 25;
    const pendingTarget   = 18;
    const cancelledTarget = 6;
    const rejectedTarget  = 3;

    const clientIds = allClientUsers.map((u) => u.user_id);
    const profileIds = proDocs.map((p) => p.profile_id);

    const SAMPLE_NOTES = [
      '', '', '', // many no-notes
      'Coloration ton sur ton',
      'Léger dégradé svp',
      'Brushing pour un événement',
      'Coupe + soin si possible',
      'Première fois à domicile, merci !',
      'Mariage dans 2 mois',
      'Mèches discrètes'
    ];

    // Completed (past, between 2 and 60 days ago)
    for (let i = 0; i < completedTarget; i++) {
      makeAppointment({
        client_id: pick(clientIds),
        profile_id: pick(profileIds),
        daysOffset: -rand(2, 60),
        slot_id: pick(slotIds),
        status: 'completed',
        notes: pick(SAMPLE_NOTES)
      });
    }

    // Accepted (future, 1-14 days)
    for (let i = 0; i < acceptedTarget; i++) {
      makeAppointment({
        client_id: pick(clientIds),
        profile_id: pick(profileIds),
        daysOffset: rand(1, 14),
        slot_id: pick(slotIds),
        status: 'accepted',
        notes: pick(SAMPLE_NOTES)
      });
    }

    // Pending (future, 1-21 days)
    for (let i = 0; i < pendingTarget; i++) {
      makeAppointment({
        client_id: pick(clientIds),
        profile_id: pick(profileIds),
        daysOffset: rand(1, 21),
        slot_id: pick(slotIds),
        status: 'pending',
        notes: pick(SAMPLE_NOTES)
      });
    }

    // Cancelled (mostly past, some future)
    for (let i = 0; i < cancelledTarget; i++) {
      makeAppointment({
        client_id: pick(clientIds),
        profile_id: pick(profileIds),
        daysOffset: rand(-20, 7),
        slot_id: pick(slotIds),
        status: 'cancelled',
        notes: pick(SAMPLE_NOTES)
      });
    }

    // Rejected (past)
    for (let i = 0; i < rejectedTarget; i++) {
      makeAppointment({
        client_id: pick(clientIds),
        profile_id: pick(profileIds),
        daysOffset: -rand(5, 30),
        slot_id: pick(slotIds),
        status: 'rejected',
        notes: pick(SAMPLE_NOTES)
      });
    }

    // Add a few deterministic appointments for the real client (so he has data in dashboard)
    const realClientFixedAppts = [
      { profile_id: 'pro-001', daysOffset: 2,   slot_id: 'slot-morning',   status: 'accepted',  notes: 'Je souhaite une coupe avec un léger dégradé' },
      { profile_id: 'pro-003', daysOffset: 5,   slot_id: 'slot-afternoon', status: 'pending',   notes: 'Mariage le mois prochain, je voudrais un essai' },
      { profile_id: 'pro-001', daysOffset: -7,  slot_id: 'slot-afternoon', status: 'completed', notes: 'Coloration blonde cendrée' },
      { profile_id: 'pro-006', daysOffset: -5,  slot_id: 'slot-morning',   status: 'completed', notes: 'Tresses pour un événement' }
    ];
    const realClientFixedApptIds = realClientFixedAppts.map((a) =>
      makeAppointment({ client_id: realClient.user_id, ...a })
    );

    await Appointment.insertMany(appointmentDocs, { ordered: true });
    console.log(`Rendez-vous créés : ${appointmentDocs.length}`);

    // ===== REVIEWS =====
    // 60-75% des completed appointments laissent un avis (note 4 ou 5, parfois 3)
    const completedAppts = appointmentDocs.filter((a) => a.status === 'completed');
    const reviewDocs = [];
    const ratingsByPro = {}; // profile_id -> [ratings]

    completedAppts.forEach((apt) => {
      if (Math.random() < 0.7) {
        const r = Math.random();
        let rating;
        if (r < 0.55) rating = 5;
        else if (r < 0.9) rating = 4;
        else rating = 3;

        const review = {
          review_id: uuidv4(),
          client_id: apt.client_id,
          profile_id: apt.profile_id,
          appointment_id: apt.appointment_id,
          rating,
          comment: pick(REVIEW_COMMENTS),
          is_visible: true
        };
        reviewDocs.push(review);
        (ratingsByPro[apt.profile_id] = ratingsByPro[apt.profile_id] || []).push(rating);
      }
    });

    await Review.insertMany(reviewDocs, { ordered: true });
    console.log(`Avis créés : ${reviewDocs.length}`);

    // Update average_rating + review_count from actual reviews
    const proStatsOps = Object.entries(ratingsByPro).map(([profileId, ratings]) => {
      const sum = ratings.reduce((a, b) => a + b, 0);
      const avg = Math.round((sum / ratings.length) * 10) / 10;
      return Professional.updateOne(
        { profile_id: profileId },
        { $set: { average_rating: avg, review_count: ratings.length } }
      );
    });
    await Promise.all(proStatsOps);
    console.log('Stats des pros recalculées (average_rating, review_count)');

    // ===== FAVORITES =====
    const favoriteDocs = [];
    const usedPairs = new Set();
    allClientUsers.forEach((c) => {
      const favCount = rand(1, 4);
      const favProfiles = pickN(profileIds, favCount);
      favProfiles.forEach((pid) => {
        const key = `${c.user_id}|${pid}`;
        if (usedPairs.has(key)) return;
        usedPairs.add(key);
        favoriteDocs.push({
          favorite_id: uuidv4(),
          user_id: c.user_id,
          profile_id: pid
        });
      });
    });
    await Favorite.insertMany(favoriteDocs, { ordered: true });
    console.log(`Favoris créés : ${favoriteDocs.length}`);

    // ===== CONVERSATIONS & MESSAGES =====
    // - 2 conversations attached to the real client's appointments
    // - 6 random conversations attached to other recent appointments
    const conversations = [];
    const messages = [];

    function addConversation({ client_id, pro_user_id, appointment_id, exchanges }) {
      const convId = `conv-${String(conversations.length + 1).padStart(3, '0')}`;
      conversations.push({
        conversation_id: convId,
        participants: [client_id, pro_user_id],
        appointment_id
      });
      exchanges.forEach((e) => {
        messages.push({
          message_id: uuidv4(),
          conversation_id: convId,
          sender_id: e.from,
          content: e.content,
          is_read: !!e.is_read
        });
      });
    }

    // Real client conversations
    addConversation({
      client_id: realClient.user_id,
      pro_user_id: realProUser.user_id,
      appointment_id: realClientFixedApptIds[0],
      exchanges: [
        { from: realClient.user_id,  content: "Bonjour Hatem, j'ai réservé pour mercredi matin. Vous pourriez apporter des échantillons de couleurs ?", is_read: true },
        { from: realProUser.user_id, content: "Bonjour Kyrian ! Bien sûr, je viendrai avec mon nuancier complet. Une idée de couleur ?", is_read: true },
        { from: realClient.user_id,  content: 'Je pensais à un blond cendré, mais je suis ouvert à vos suggestions !', is_read: false }
      ]
    });
    const emmaUser = proUserDocs.find((u) => u.first_name === 'Emma') || proUserDocs[1];
    addConversation({
      client_id: realClient.user_id,
      pro_user_id: emmaUser.user_id,
      appointment_id: realClientFixedApptIds[1],
      exchanges: [
        { from: realClient.user_id, content: "Bonjour Emma, j'ai hâte de notre essai coiffure !", is_read: true },
        { from: emmaUser.user_id,   content: "Bonjour Kyrian ! Pouvez-vous m'envoyer des photos d'inspiration ?", is_read: false }
      ]
    });

    // Random other conversations (linked to upcoming accepted appointments)
    const upcomingAccepted = appointmentDocs.filter((a) => a.status === 'accepted').slice(0, 6);
    upcomingAccepted.forEach((apt) => {
      const proProfile = proDocs.find((p) => p.profile_id === apt.profile_id);
      if (!proProfile) return;
      const proUser = allProUsers.find((u) => u.user_id === proProfile.user_id);
      if (!proUser || apt.client_id === proUser.user_id) return;
      addConversation({
        client_id: apt.client_id,
        pro_user_id: proUser.user_id,
        appointment_id: apt.appointment_id,
        exchanges: [
          { from: apt.client_id,   content: `Bonjour, je confirme notre rendez-vous le ${apt.date}.`, is_read: true },
          { from: proUser.user_id, content: 'Bonjour ! Bien noté, à bientôt.', is_read: Math.random() < 0.5 }
        ]
      });
    });

    await Conversation.insertMany(conversations, { ordered: true });
    await Message.insertMany(messages, { ordered: true });
    console.log(`Conversations créées : ${conversations.length}, messages : ${messages.length}`);

    // ===== SUBSCRIPTIONS =====
    const subscriptions = allProUsers.map((u, i) => {
      const isAnnual = i % 3 === 0;
      return {
        subscription_id: uuidv4(),
        user_id: u.user_id,
        plan: isAnnual ? 'annual' : 'monthly',
        status: 'active',
        current_period_end: addDays(today, isAnnual ? rand(180, 350) : rand(7, 28))
      };
    });
    await Subscription.insertMany(subscriptions, { ordered: true });
    console.log(`Abonnements créés : ${subscriptions.length}`);

    // ===== SUMMARY =====
    console.log('\n✅ Seed terminé avec succès !');
    console.log(`Base utilisée : ${mongoose.connection.name}`);
    console.log('\nRécap :');
    console.log(`  Utilisateurs    : ${allUsers.length} (1 admin, ${allProUsers.length} pros, ${allClientUsers.length} clients)`);
    console.log(`  Pros            : ${proDocs.length} sur ${Object.keys(CITIES).length} villes`);
    console.log(`  Services        : ${serviceDocs.length}`);
    console.log(`  Portfolio       : ${portfolioDocs.length} images`);
    console.log(`  Disponibilités  : ${availabilityDocs.length}`);
    console.log(`  Rendez-vous     : ${appointmentDocs.length}`);
    console.log(`  Avis            : ${reviewDocs.length}`);
    console.log(`  Favoris         : ${favoriteDocs.length}`);
    console.log(`  Conversations   : ${conversations.length} (${messages.length} messages)`);
    console.log(`  Abonnements     : ${subscriptions.length}`);
    console.log('\nComptes de test :');
    console.log('  Admin  : abdoulatuf.pro@gmail.com / H@irpro6437');
    console.log('  Pro    : abdoulatuf.hatem02@gmail.com / H@irpro6437');
    console.log('  Client : kyrsirius52@gmail.com / H@irpro6437');
    console.log('  Comptes fictifs (pros/clients) : ...@fakehairpro.test / FakeUser123!');
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
