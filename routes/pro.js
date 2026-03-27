const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { auth, requireRole } = require('../middleware/auth');
const { upload, uploadImage, deleteImage } = require('../services/cloudinaryService');
const Professional = require('../models/Professional');
const Service = require('../models/Service');
const Availability = require('../models/Availability');
const Appointment = require('../models/Appointment');
const PortfolioImage = require('../models/PortfolioImage');
const Review = require('../models/Review');
const User = require('../models/User');
const TimeSlot = require('../models/TimeSlot');

const { createNotification } = require('../services/notificationService');
const { requireSubscription } = require('../middleware/requireSubscription');

const router = express.Router();

// All routes require pro role
router.use(auth, requireRole('pro'));

// GET /api/pro/profile
router.get('/profile', async (req, res) => {
  try {
    const profile = await Professional.findOne({ user_id: req.user.user_id }).lean();
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/pro/profile
router.put('/profile', requireSubscription, async (req, res) => {
  try {
    const { description, city, lat, lng, radius_km } = req.body;

    let profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) {
      profile = await Professional.create({
        profile_id: uuidv4(),
        user_id: req.user.user_id,
        description: description || '',
        city: city || '',
        lat: lat || 0,
        lng: lng || 0,
        radius_km: radius_km || 10
      });
    } else {
      if (description !== undefined) profile.description = description;
      if (city !== undefined) profile.city = city;
      if (lat !== undefined) profile.lat = lat;
      if (lng !== undefined) profile.lng = lng;
      if (radius_km !== undefined) profile.radius_km = radius_km;
      await profile.save();
    }

    res.json(profile);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pro/photo
router.post('/photo', requireSubscription, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo requise' });

    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.status(404).json({ error: 'Profil non trouvé' });

    if (profile.photo_url) {
      await deleteImage(profile.photo_url);
    }

    const url = await uploadImage(req.file.buffer, 'hairpro/profiles');
    profile.photo_url = url;
    await profile.save();

    res.json({ photo_url: url });
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/pro/services
router.get('/services', async (req, res) => {
  try {
    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.json([]);
    const services = await Service.find({ profile_id: profile.profile_id }).lean();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pro/services
router.post('/services', requireSubscription, async (req, res) => {
  try {
    const { name, estimated_price, duration } = req.body;
    if (!name || !estimated_price) {
      return res.status(400).json({ error: 'Nom et prix requis' });
    }

    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.status(404).json({ error: 'Profil non trouvé, créez d\'abord votre profil' });

    const service = await Service.create({
      service_id: uuidv4(),
      profile_id: profile.profile_id,
      name,
      estimated_price,
      duration: duration || 60
    });

    res.status(201).json(service);
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/pro/services/:id
router.put('/services/:id', requireSubscription, async (req, res) => {
  try {
    const { name, estimated_price, duration } = req.body;
    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.status(404).json({ error: 'Profil non trouve' });

    const service = await Service.findOne({ service_id: req.params.id, profile_id: profile.profile_id });
    if (!service) return res.status(404).json({ error: 'Prestation non trouvee' });

    if (name !== undefined) service.name = name;
    if (estimated_price !== undefined) service.estimated_price = estimated_price;
    if (duration !== undefined) service.duration = duration;
    await service.save();

    res.json(service);
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/pro/services/:id
router.delete('/services/:id', requireSubscription, async (req, res) => {
  try {
    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.status(404).json({ error: 'Profil non trouvé' });

    await Service.deleteOne({ service_id: req.params.id, profile_id: profile.profile_id });
    res.json({ message: 'Prestation supprimée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/pro/availability
router.get('/availability', async (req, res) => {
  try {
    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.json([]);

    const availability = await Availability.find({ profile_id: profile.profile_id })
      .sort({ date: 1 }).lean();
    res.json(availability);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pro/availability
router.post('/availability', requireSubscription, async (req, res) => {
  try {
    const { date, slot_id, status } = req.body;
    if (!date || !slot_id) {
      return res.status(400).json({ error: 'Date et créneau requis' });
    }

    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.status(404).json({ error: 'Profil non trouvé' });

    let avail = await Availability.findOne({ profile_id: profile.profile_id, date, slot_id });
    if (avail) {
      avail.status = status || 'available';
      await avail.save();
    } else {
      avail = await Availability.create({
        availability_id: uuidv4(),
        profile_id: profile.profile_id,
        date,
        slot_id,
        status: status || 'available'
      });
    }

    res.json(avail);
  } catch (err) {
    console.error('Set availability error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/pro/appointments
router.get('/appointments', async (req, res) => {
  try {
    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.json([]);

    const appointments = await Appointment.find({ profile_id: profile.profile_id })
      .sort({ created_at: -1 }).lean();

    const enriched = await Promise.all(appointments.map(async (apt) => {
      const client = await User.findOne({ user_id: apt.client_id }).lean();
      const slot = await TimeSlot.findOne({ slot_id: apt.slot_id }).lean();
      const services = await Service.find({ service_id: { $in: apt.service_ids } }).lean();
      return {
        ...apt,
        client_name: client ? `${client.first_name} ${client.last_name}` : 'Inconnu',
        client_email: client?.email || '',
        slot,
        services
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Get pro appointments error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pro/appointments/:id/accept
router.post('/appointments/:id/accept', requireSubscription, async (req, res) => {
  try {
    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.status(404).json({ error: 'Profil non trouvé' });

    const appointment = await Appointment.findOne({
      appointment_id: req.params.id,
      profile_id: profile.profile_id
    });
    if (!appointment) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    if (appointment.status !== 'pending') {
      return res.status(400).json({ error: 'Ce rendez-vous ne peut pas être accepté' });
    }

    appointment.status = 'accepted';
    await appointment.save();

    // Mark slot as booked
    await Availability.updateOne(
      { profile_id: profile.profile_id, date: appointment.date, slot_id: appointment.slot_id },
      { status: 'booked' }
    );

    // Notify client
    const client = await User.findOne({ user_id: appointment.client_id });
    const slot = await TimeSlot.findOne({ slot_id: appointment.slot_id });
    if (client) {
      await require('../services/emailService').sendAppointmentNotification(client.email, 'accepted', {
        date: appointment.date,
        slot: slot?.label || ''
      });
      await createNotification({
        user_id: client.user_id,
        type: 'appointment_accepted',
        title: 'Rendez-vous confirme',
        message: `Votre RDV du ${appointment.date} (${slot?.label || ''}) a ete accepte.`,
        link: '/dashboard/client/appointments'
      });
    }

    res.json(appointment);
  } catch (err) {
    console.error('Accept appointment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pro/appointments/:id/reject
router.post('/appointments/:id/reject', requireSubscription, async (req, res) => {
  try {
    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.status(404).json({ error: 'Profil non trouvé' });

    const appointment = await Appointment.findOne({
      appointment_id: req.params.id,
      profile_id: profile.profile_id
    });
    if (!appointment) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    if (appointment.status !== 'pending') {
      return res.status(400).json({ error: 'Ce rendez-vous ne peut pas être refusé' });
    }

    appointment.status = 'rejected';
    await appointment.save();

    // Free up slot
    await Availability.updateOne(
      { profile_id: profile.profile_id, date: appointment.date, slot_id: appointment.slot_id },
      { status: 'available' }
    );

    // Notify client
    const client = await User.findOne({ user_id: appointment.client_id });
    const slot = await TimeSlot.findOne({ slot_id: appointment.slot_id });
    if (client) {
      await require('../services/emailService').sendAppointmentNotification(client.email, 'rejected', {
        date: appointment.date,
        slot: slot?.label || ''
      });
      await createNotification({
        user_id: client.user_id,
        type: 'appointment_rejected',
        title: 'Rendez-vous refuse',
        message: `Votre RDV du ${appointment.date} (${slot?.label || ''}) a ete refuse.`,
        link: '/dashboard/client/appointments'
      });
    }

    res.json(appointment);
  } catch (err) {
    console.error('Reject appointment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/pro/portfolio
router.get('/portfolio', async (req, res) => {
  try {
    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.json([]);
    const images = await PortfolioImage.find({ profile_id: profile.profile_id })
      .sort({ created_at: -1 }).lean();
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pro/portfolio
router.post('/portfolio', requireSubscription, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image requise' });

    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.status(404).json({ error: 'Profil non trouvé' });

    const url = await uploadImage(req.file.buffer, 'hairpro/portfolio');
    const image = await PortfolioImage.create({
      image_id: uuidv4(),
      profile_id: profile.profile_id,
      url
    });

    res.status(201).json(image);
  } catch (err) {
    console.error('Upload portfolio error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/pro/portfolio/:id
router.delete('/portfolio/:id', requireSubscription, async (req, res) => {
  try {
    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.status(404).json({ error: 'Profil non trouvé' });

    const image = await PortfolioImage.findOne({
      image_id: req.params.id,
      profile_id: profile.profile_id
    });
    if (image) {
      await deleteImage(image.url);
      await PortfolioImage.deleteOne({ image_id: req.params.id });
    }

    res.json({ message: 'Image supprimée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/pro/reviews
router.get('/reviews', async (req, res) => {
  try {
    const profile = await Professional.findOne({ user_id: req.user.user_id });
    if (!profile) return res.json([]);

    const reviews = await Review.find({ profile_id: profile.profile_id })
      .sort({ created_at: -1 }).lean();

    const enriched = await Promise.all(reviews.map(async (review) => {
      const client = await User.findOne({ user_id: review.client_id }).lean();
      return {
        ...review,
        client_name: client ? `${client.first_name} ${client.last_name.charAt(0)}.` : 'Anonyme'
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
