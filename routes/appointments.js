const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middleware/auth');
const { appointmentValidation } = require('../middleware/validate');
const Appointment = require('../models/Appointment');
const Availability = require('../models/Availability');
const Professional = require('../models/Professional');
const User = require('../models/User');
const Review = require('../models/Review');
const Service = require('../models/Service');
const TimeSlot = require('../models/TimeSlot');
const Conversation = require('../models/Conversation');
const { sendAppointmentNotification } = require('../services/emailService');
const { createNotification } = require('../services/notificationService');

const router = express.Router();

// POST /api/appointments - Créer demande
router.post('/', auth, appointmentValidation, async (req, res) => {
  try {
    const { profile_id, date, slot_id, notes, service_ids } = req.body;

    if (!profile_id || !date || !slot_id) {
      return res.status(400).json({ error: 'Professionnel, date et créneau requis' });
    }

    const pro = await Professional.findOne({ profile_id });
    if (!pro) return res.status(404).json({ error: 'Professionnel non trouvé' });

    // Check availability
    const avail = await Availability.findOne({ profile_id, date, slot_id, status: 'available' });
    if (!avail) {
      return res.status(400).json({ error: 'Ce créneau n\'est pas disponible' });
    }

    const appointment = await Appointment.create({
      appointment_id: uuidv4(),
      client_id: req.user.user_id,
      profile_id,
      date,
      slot_id,
      notes: notes || '',
      service_ids: service_ids || [],
      status: 'pending'
    });

    // Mark availability as pending
    avail.status = 'pending';
    await avail.save();

    // Create conversation
    await Conversation.create({
      conversation_id: uuidv4(),
      participants: [req.user.user_id, pro.user_id],
      appointment_id: appointment.appointment_id
    });

    // Notify pro
    const proUser = await User.findOne({ user_id: pro.user_id });
    const slot = await TimeSlot.findOne({ slot_id });
    if (proUser) {
      await sendAppointmentNotification(proUser.email, 'new', {
        date,
        slot: slot?.label || slot_id,
        notes
      });
      await createNotification({
        user_id: proUser.user_id,
        type: 'appointment_new',
        title: 'Nouvelle demande de RDV',
        message: `Nouveau RDV le ${date} (${slot?.label || slot_id}).`,
        link: '/dashboard/pro/appointments'
      });
    }

    res.status(201).json(appointment);
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/appointments/me - Mes RDV (client)
router.get('/me', auth, async (req, res) => {
  try {
    const appointments = await Appointment.find({ client_id: req.user.user_id })
      .sort({ created_at: -1 }).lean();

    const enriched = await Promise.all(appointments.map(async (apt) => {
      const pro = await Professional.findOne({ profile_id: apt.profile_id }).lean();
      const proUser = pro ? await User.findOne({ user_id: pro.user_id }).lean() : null;
      const slot = await TimeSlot.findOne({ slot_id: apt.slot_id }).lean();
      const services = await Service.find({ service_id: { $in: apt.service_ids } }).lean();
      const review = await Review.findOne({ appointment_id: apt.appointment_id }).lean();

      return {
        ...apt,
        professional: pro ? {
          ...pro,
          first_name: proUser?.first_name || '',
          last_name: proUser?.last_name || ''
        } : null,
        slot,
        services,
        has_review: !!review
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Get my appointments error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/appointments/:id/cancel
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ appointment_id: req.params.id });
    if (!appointment) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    if (appointment.client_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    if (['cancelled', 'completed', 'rejected'].includes(appointment.status)) {
      return res.status(400).json({ error: 'Ce rendez-vous ne peut pas être annulé' });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    // Free up availability
    await Availability.updateOne(
      { profile_id: appointment.profile_id, date: appointment.date, slot_id: appointment.slot_id },
      { status: 'available' }
    );

    // Notify pro
    const pro = await Professional.findOne({ profile_id: appointment.profile_id });
    if (pro) {
      await createNotification({
        user_id: pro.user_id,
        type: 'appointment_cancelled',
        title: 'RDV annule',
        message: `Le RDV du ${appointment.date} a ete annule par le client.`,
        link: '/dashboard/pro/appointments'
      });
    }

    res.json(appointment);
  } catch (err) {
    console.error('Cancel appointment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/appointments/reviews - Laisser un avis
router.post('/reviews', auth, async (req, res) => {
  try {
    const { appointment_id, rating, comment } = req.body;

    if (!appointment_id || !rating) {
      return res.status(400).json({ error: 'Rendez-vous et note requis' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'La note doit être entre 1 et 5' });
    }

    const appointment = await Appointment.findOne({ appointment_id });
    if (!appointment) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    if (appointment.client_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    if (appointment.status !== 'completed') {
      return res.status(400).json({ error: 'Vous ne pouvez noter qu\'un rendez-vous terminé' });
    }

    const existingReview = await Review.findOne({ appointment_id });
    if (existingReview) {
      return res.status(400).json({ error: 'Vous avez déjà laissé un avis pour ce rendez-vous' });
    }

    const review = await Review.create({
      review_id: uuidv4(),
      client_id: req.user.user_id,
      profile_id: appointment.profile_id,
      appointment_id,
      rating,
      comment: comment || ''
    });

    // Update pro average rating
    const allReviews = await Review.find({ profile_id: appointment.profile_id, is_visible: true });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await Professional.updateOne(
      { profile_id: appointment.profile_id },
      { average_rating: Math.round(avgRating * 10) / 10, review_count: allReviews.length }
    );

    // Notify pro about new review
    const pro = await Professional.findOne({ profile_id: appointment.profile_id });
    if (pro) {
      await createNotification({
        user_id: pro.user_id,
        type: 'new_review',
        title: 'Nouvel avis',
        message: `Un client vous a donne ${rating}/5 etoiles.`,
        link: '/dashboard/pro/reviews'
      });
    }

    res.status(201).json(review);
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
