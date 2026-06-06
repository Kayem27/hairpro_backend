// Upload des avatars de pros vers Cloudinary.
// Lit le dossier "Photos hairpro/" (racine du projet), envoie chaque image
// dans le dossier Cloudinary "hairpro/avatars" et affiche les URLs obtenues,
// séparées par genre, prêtes à coller dans seed.js.
//
// Usage : node scripts/uploadAvatars.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const PHOTOS_DIR = path.join(__dirname, '..', '..', 'Photos hairpro');
const FOLDER = 'hairpro/avatars';

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'placeholder') {
    console.error('Cloudinary non configuré (CLOUDINARY_CLOUD_NAME manquant).');
    process.exit(1);
  }

  const files = fs.readdirSync(PHOTOS_DIR)
    .filter(f => /\.(jpe?g|png|webp)$/i.test(f));

  // Tri stable : par genre puis par numéro dans le nom de fichier
  const numOf = f => parseInt((f.match(/(\d+)/) || [])[1] || '0', 10);
  const isHomme = f => /^homme/i.test(f);
  files.sort((a, b) => {
    if (isHomme(a) !== isHomme(b)) return isHomme(a) ? -1 : 1;
    return numOf(a) - numOf(b);
  });

  const hommes = [];
  const femmes = [];

  for (const file of files) {
    const gender = isHomme(file) ? 'homme' : 'femme';
    const n = numOf(file);
    const publicId = `${gender}-${n}`; // ex: homme-1 → idempotent en cas de re-run
    const filePath = path.join(PHOTOS_DIR, file);

    process.stdout.write(`Upload ${file} → ${FOLDER}/${publicId} ... `);
    const res = await cloudinary.uploader.upload(filePath, {
      folder: FOLDER,
      public_id: publicId,
      overwrite: true,
      transformation: [{ width: 600, height: 600, crop: 'fill', gravity: 'face' }]
    });
    console.log('ok');
    (gender === 'homme' ? hommes : femmes).push(res.secure_url);
  }

  const fmt = arr => arr.map(u => `  '${u}'`).join(',\n');

  console.log('\n\n===== À coller dans backend/seed.js =====\n');
  console.log(`const AVATAR_POOL_HOMME = [\n${fmt(hommes)}\n];\n`);
  console.log(`const AVATAR_POOL_FEMME = [\n${fmt(femmes)}\n];\n`);
  console.log(`(${hommes.length} hommes, ${femmes.length} femmes)`);
}

main().catch(err => {
  console.error('\nÉchec upload :', err.message || err);
  process.exit(1);
});
