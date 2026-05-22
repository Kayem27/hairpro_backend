# HairPro – Backend

API REST et serveur temps réel de **HairPro**, une plateforme de mise en relation entre coiffeurs à domicile et clients.

Construit avec **Node.js**, **Express**, **MongoDB** et **Socket.io**.

> Projet de fin d'année — Version 3.0

---

## Sommaire

- [Stack technique](#stack-technique)
- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts npm](#scripts-npm)
- [Structure du projet](#structure-du-projet)
- [Endpoints de l'API](#endpoints-de-lapi)
- [Authentification et sécurité](#authentification-et-sécurité)
- [Temps réel (Socket.io)](#temps-réel-socketio)
- [Tests](#tests)
- [Déploiement](#déploiement)
- [Frontend associé](#frontend-associé)

---

## Stack technique

| Technologie | Rôle |
|-------------|------|
| Node.js 18+ | Runtime JavaScript |
| Express 4 | Framework HTTP |
| MongoDB + Mongoose 8 | Base de données et ODM |
| Socket.io 4 | Notifications et messagerie temps réel |
| JSON Web Token | Authentification stateless |
| bcryptjs | Hachage des mots de passe |
| Helmet + express-rate-limit | Sécurité HTTP (CSP, HSTS, throttling) |
| express-validator | Validation des entrées |
| Stripe | Paiements et abonnements |
| Cloudinary | Stockage des images (portfolio, avatars) |
| Brevo | Envoi d'emails transactionnels |
| Winston + Morgan | Journalisation |
| Jest + Supertest + mongodb-memory-server | Tests unitaires et d'intégration |

---

## Fonctionnalités

- Inscription / connexion clients, professionnels et administrateurs (rôles distincts)
- Vérification d'email, mot de passe oublié, force du mot de passe
- Profils professionnels complets : services, portfolio, disponibilités, géolocalisation
- Recherche de professionnels avec filtres (localisation, prix, note, disponibilité)
- Système de rendez-vous (demande → acceptation → réalisation → avis)
- Messagerie temps réel client ↔ professionnel
- Notifications push in-app via WebSocket
- Favoris, avis et notation
- Abonnements professionnels via Stripe (avec webhook)
- Tableau de bord administrateur (modération, statistiques)
- Conformité RGPD (export et suppression des données utilisateur)

---

## Prérequis

- **Node.js 18+** et **npm**
- Un cluster **MongoDB** (Atlas recommandé) ou une instance locale
- Comptes (optionnels en dev) pour : **Stripe**, **Cloudinary**, **Brevo**

---

## Installation

```bash
git clone https://github.com/Kayem27/hairpro_backend.git
cd hairpro_backend
npm install
cp .env.example .env   # puis renseignez vos variables
npm run dev
```

L'API démarre par défaut sur `http://localhost:8001`.

Pour peupler la base avec des données de démo :

```bash
npm run seed
```

---

## Variables d'environnement

Créer un fichier `.env` à la racine. Variables principales :

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `MONGO_URL` | oui | URI de connexion MongoDB |
| `JWT_SECRET` | oui | Clé secrète JWT (≥ 32 caractères) |
| `PORT` | non | Port d'écoute (défaut : `8001`) |
| `APP_URL` | non | Origine autorisée CORS (défaut : `http://localhost:5173`) |
| `NODE_ENV` | non | `development` ou `production` |
| `STRIPE_SECRET_KEY` | si paiements | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | si paiements | Secret du webhook Stripe |
| `STRIPE_PRICE_ID` | si paiements | ID du prix d'abonnement |
| `CLOUDINARY_CLOUD_NAME` | si upload | Nom du cloud Cloudinary |
| `CLOUDINARY_API_KEY` | si upload | Clé API Cloudinary |
| `CLOUDINARY_API_SECRET` | si upload | Secret API Cloudinary |
| `BREVO_API_KEY` | si emails | Clé API Brevo |
| `BREVO_SENDER_EMAIL` | si emails | Adresse d'expéditeur |

Le serveur refuse de démarrer si `MONGO_URL` ou `JWT_SECRET` sont manquants, et émet un avertissement si `JWT_SECRET` est trop court ou par défaut.

---

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm start` | Démarre le serveur en mode production |
| `npm run dev` | Démarre le serveur avec rechargement à chaud (nodemon) |
| `npm run seed` | Peuple la base avec un jeu de données de démonstration |
| `npm test` | Lance toute la suite de tests Jest |
| `npm run test:unit` | Tests unitaires uniquement |
| `npm run test:integration` | Tests d'intégration uniquement |
| `npm run test:coverage` | Tests avec rapport de couverture |

---

## Structure du projet

```
backend/
├── server.js              # Point d'entrée (Express + Socket.io)
├── seed.js                # Script de seed de la base
├── routes/                # Routeurs Express (un fichier par domaine)
│   ├── auth.js
│   ├── professionals.js
│   ├── appointments.js
│   ├── timeSlots.js
│   ├── conversations.js
│   ├── favorites.js
│   ├── notifications.js
│   ├── billing.js
│   ├── pro.js
│   ├── admin.js
│   └── users.js
├── models/                # Schémas Mongoose
│   ├── User.js
│   ├── Professional.js
│   ├── Service.js
│   ├── Appointment.js
│   ├── TimeSlot.js
│   ├── Availability.js
│   ├── Conversation.js
│   ├── Message.js
│   ├── Notification.js
│   ├── Favorite.js
│   ├── Review.js
│   ├── PortfolioImage.js
│   └── Subscription.js
├── middleware/            # Auth, validation, rate-limit, abonnement
├── services/              # Logger, emails, Cloudinary, notifications
└── __tests__/             # Tests unitaires et d'intégration
```

---

## Endpoints de l'API

Toutes les routes sont préfixées par `/api`.

| Préfixe | Domaine |
|---------|---------|
| `/api/auth` | Inscription, connexion, vérification email, mot de passe oublié |
| `/api/users` | Profil utilisateur courant, export et suppression RGPD |
| `/api/professionals` | Recherche, fiche publique, avis |
| `/api/pro` | Espace professionnel (services, portfolio, profil) |
| `/api/time-slots` | Disponibilités et créneaux réservables |
| `/api/appointments` | Cycle de vie des rendez-vous |
| `/api/favorites` | Gestion des favoris |
| `/api/conversations` | Messagerie (liste, messages, lecture) |
| `/api/notifications` | Liste et marquage des notifications |
| `/api/billing` | Stripe Checkout, portail client, webhook |
| `/api/admin` | Modération, gestion des utilisateurs, statistiques |
| `/api/health` | Vérification de santé du service |

---

## Authentification et sécurité

- **JWT** émis à la connexion (`Authorization: Bearer <token>`), vérifié côté HTTP et Socket.io
- **bcryptjs** pour le hachage des mots de passe
- **Helmet** : Content Security Policy stricte en production, HSTS, anti-clickjacking
- **CORS** restreint à l'origine de l'application (`APP_URL`)
- **Rate limiting** global et spécifique aux routes sensibles (auth)
- **Validation** systématique des entrées via `express-validator`
- **Webhook Stripe** consommé en `raw body` avant le parser JSON

---

## Temps réel (Socket.io)

Le serveur expose un endpoint Socket.io authentifié par JWT.

À la connexion, le client est automatiquement joint à sa **room personnelle** `user:<userId>` pour les notifications.

Événements client → serveur :

| Événement | Payload | Effet |
|-----------|---------|-------|
| `join_conversation` | `conversationId` | Rejoint la room `conv:<id>` |
| `leave_conversation` | `conversationId` | Quitte la room |

Le serveur émet `message:new`, `notification:new`, etc. dans les rooms appropriées.

---

## Tests

Les tests utilisent **Jest**, **Supertest** et **mongodb-memory-server** (pas besoin d'une vraie base pour tester).

```bash
npm test                 # toute la suite
npm run test:unit        # unitaires
npm run test:integration # intégration HTTP
npm run test:coverage    # avec couverture
```

---

## Déploiement

Voir `GUIDE_DEPLOIEMENT.md` à la racine du projet pour une procédure pas à pas (variables, build, hébergement, webhook Stripe).

Points clés :

- Définir `NODE_ENV=production` (active CSP stricte, HSTS, logs `combined`).
- Configurer le webhook Stripe sur `https://<domaine>/api/billing/webhook`.
- Utiliser un `JWT_SECRET` aléatoire ≥ 32 caractères.
- Restreindre `APP_URL` au domaine du frontend en production.

---

## Frontend associé

Le frontend React + Vite est hébergé dans un dépôt séparé :
**https://github.com/Kayem27/hairpro_frontend**

---

## Licence

Projet académique — usage pédagogique.
