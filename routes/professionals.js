const express = require('express');
const Professional = require('../models/Professional');
const Service = require('../models/Service');
const Review = require('../models/Review');
const User = require('../models/User');
const PortfolioImage = require('../models/PortfolioImage');
const Availability = require('../models/Availability');
const Subscription = require('../models/Subscription');

const router = express.Router();

// GET /api/professionals - Liste avec filtres
router.get('/', async (req, res) => {
  try {
    const { city, name, min_rating, min_price, max_price, verified, service, sort, lat, lng, radius, available_from, available_to, page = 1, limit = 20 } = req.query;

    let query = { is_active: true };

    if (city) {
      query.city = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (min_rating) {
      query.average_rating = { $gte: parseFloat(min_rating) };
    }
    if (verified === 'true') {
      query.is_verified = true;
    }

    // If filtering by availability, get eligible profile_ids first
    let availableProfileIds = null;
    if (available_from) {
      const availQuery = { status: 'available' };
      if (available_from && available_to) {
        availQuery.date = { $gte: available_from, $lte: available_to };
      } else {
        availQuery.date = available_from;
      }
      const availSlots = await Availability.find(availQuery).distinct('profile_id');
      availableProfileIds = new Set(availSlots);
      // Restrict query to only these profiles
      query.profile_id = { $in: availSlots };
    }

    // Ne garder que les pros ayant un abonnement actif
    const activeSubscriptions = await Subscription.find({
      status: 'active',
      current_period_end: { $gt: new Date() }
    }).distinct('user_id');
    query.user_id = { $in: activeSubscriptions };

    let professionals = await Professional.find(query).lean();

    // Enrich with user info and services
    const enriched = await Promise.all(professionals.map(async (pro) => {
      const user = await User.findOne({ user_id: pro.user_id }).lean();
      const services = await Service.find({ profile_id: pro.profile_id }).lean();

      return {
        ...pro,
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        email: user?.email || '',
        services,
        min_price: services.length > 0 ? Math.min(...services.map(s => s.estimated_price)) : 0
      };
    }));

    let results = enriched;

    // Filter by name (first_name or last_name)
    if (name) {
      const nameRegex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      results = results.filter(p =>
        nameRegex.test(p.first_name) || nameRegex.test(p.last_name) || nameRegex.test(`${p.first_name} ${p.last_name}`)
      );
    }

    // Filter by price range
    if (min_price) {
      results = results.filter(p => p.services.some(s => s.estimated_price >= parseFloat(min_price)));
    }
    if (max_price) {
      results = results.filter(p => p.services.some(s => s.estimated_price <= parseFloat(max_price)));
    }

    // Filter by service name
    if (service) {
      const serviceRegex = new RegExp(service.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      results = results.filter(p => p.services.some(s => serviceRegex.test(s.name)));
    }

    // Geo filter
    if (lat && lng && radius) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const maxRadius = parseFloat(radius);

      results = results.filter(p => {
        if (!p.lat || !p.lng) return false;
        const distance = getDistanceKm(userLat, userLng, p.lat, p.lng);
        p.distance = distance;
        return distance <= maxRadius;
      });
    }

    // Sort
    if (sort === 'rating') {
      results.sort((a, b) => b.average_rating - a.average_rating);
    } else if (sort === 'price') {
      results.sort((a, b) => a.min_price - b.min_price);
    } else if (sort === 'price_desc') {
      results.sort((a, b) => b.min_price - a.min_price);
    } else if (sort === 'distance' && lat && lng) {
      results.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else {
      // Default: verified first, then by rating
      results.sort((a, b) => {
        if (a.is_verified !== b.is_verified) return b.is_verified ? 1 : -1;
        return b.average_rating - a.average_rating;
      });
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = results.length;
    results = results.slice(skip, skip + parseInt(limit));

    res.json({ professionals: results, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Get professionals error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/professionals/:id - Détail d'un pro
router.get('/:id', async (req, res) => {
  try {
    const pro = await Professional.findOne({ profile_id: req.params.id }).lean();
    if (!pro) return res.status(404).json({ error: 'Professionnel non trouvé' });

    // Vérifier que le pro a un abonnement actif
    const activeSub = await Subscription.findOne({
      user_id: pro.user_id,
      status: 'active',
      current_period_end: { $gt: new Date() }
    });
    if (!activeSub) return res.status(404).json({ error: 'Professionnel non trouvé' });

    const user = await User.findOne({ user_id: pro.user_id }).lean();
    const services = await Service.find({ profile_id: pro.profile_id }).lean();
    const reviews = await Review.find({ profile_id: pro.profile_id, is_visible: true })
      .sort({ created_at: -1 }).lean();
    const portfolio = await PortfolioImage.find({ profile_id: pro.profile_id }).lean();

    // Enrich reviews with client names
    const enrichedReviews = await Promise.all(reviews.map(async (review) => {
      const client = await User.findOne({ user_id: review.client_id }).lean();
      return {
        ...review,
        client_name: client ? `${client.first_name} ${client.last_name.charAt(0)}.` : 'Anonyme'
      };
    }));

    res.json({
      ...pro,
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      services,
      reviews: enrichedReviews,
      portfolio
    });
  } catch (err) {
    console.error('Get professional detail error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/professionals/:id/availability
router.get('/:id/availability', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = { profile_id: req.params.id };

    if (start_date && end_date) {
      query.date = { $gte: start_date, $lte: end_date };
    } else if (start_date) {
      query.date = { $gte: start_date };
    }

    const availability = await Availability.find(query).sort({ date: 1 }).lean();
    res.json(availability);
  } catch (err) {
    console.error('Get availability error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Haversine formula
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
