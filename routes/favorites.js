const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middleware/auth');
const Favorite = require('../models/Favorite');
const Professional = require('../models/Professional');
const User = require('../models/User');
const Service = require('../models/Service');

const router = express.Router();

// GET /api/favorites
router.get('/', auth, async (req, res) => {
  try {
    const favorites = await Favorite.find({ user_id: req.user.user_id }).lean();

    const enriched = await Promise.all(favorites.map(async (fav) => {
      const pro = await Professional.findOne({ profile_id: fav.profile_id }).lean();
      if (!pro) return null;
      const user = await User.findOne({ user_id: pro.user_id }).lean();
      const services = await Service.find({ profile_id: pro.profile_id }).lean();
      return {
        ...fav,
        professional: {
          ...pro,
          first_name: user?.first_name || '',
          last_name: user?.last_name || '',
          services,
          min_price: services.length > 0 ? Math.min(...services.map(s => s.estimated_price)) : 0
        }
      };
    }));

    res.json(enriched.filter(Boolean));
  } catch (err) {
    console.error('Get favorites error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/favorites
router.post('/', auth, async (req, res) => {
  try {
    const { profile_id } = req.body;
    if (!profile_id) return res.status(400).json({ error: 'profile_id requis' });

    const existing = await Favorite.findOne({ user_id: req.user.user_id, profile_id });
    if (existing) return res.status(400).json({ error: 'Déjà en favoris' });

    const favorite = await Favorite.create({
      favorite_id: uuidv4(),
      user_id: req.user.user_id,
      profile_id
    });

    res.status(201).json(favorite);
  } catch (err) {
    console.error('Add favorite error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/favorites/:profileId
router.delete('/:profileId', auth, async (req, res) => {
  try {
    await Favorite.deleteOne({ user_id: req.user.user_id, profile_id: req.params.profileId });
    res.json({ message: 'Favori retiré' });
  } catch (err) {
    console.error('Remove favorite error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
