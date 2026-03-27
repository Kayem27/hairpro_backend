const multer = require('multer');
let cloudinary = null;

try {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'placeholder') {
    const cloudinaryLib = require('cloudinary').v2;
    cloudinaryLib.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    cloudinary = cloudinaryLib;
  }
} catch (e) {
  console.log('Cloudinary non configuré, fallback base64');
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

const uploadImage = async (fileBuffer, folder = 'hairpro') => {
  if (cloudinary) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, transformation: [{ width: 800, height: 800, crop: 'limit' }] },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
      stream.end(fileBuffer);
    });
  }

  // Fallback base64
  const base64 = fileBuffer.toString('base64');
  const mimeType = 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
};

const deleteImage = async (url) => {
  if (cloudinary && url && !url.startsWith('data:')) {
    try {
      const publicId = url.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    } catch (e) {
      console.error('Erreur suppression image:', e);
    }
  }
};

module.exports = { upload, uploadImage, deleteImage };
