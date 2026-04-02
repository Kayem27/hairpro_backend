const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Professional = require('../models/Professional');
const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const Subscription = require('../models/Subscription');
const Favorite = require('../models/Favorite');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Service = require('../models/Service');
const Availability = require('../models/Availability');
const PortfolioImage = require('../models/PortfolioImage');

const router = express.Router();

router.use(auth, requireRole('admin'));

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalPros, totalAppointments, totalReviews, activeSubscriptions] = await Promise.all([
      User.countDocuments(),
      Professional.countDocuments(),
      Appointment.countDocuments(),
      Review.countDocuments(),
      Subscription.countDocuments({ status: 'active' })
    ]);

    const pendingAppointments = await Appointment.countDocuments({ status: 'pending' });
    const completedAppointments = await Appointment.countDocuments({ status: 'completed' });

    res.json({
      totalUsers,
      totalPros,
      totalAppointments,
      pendingAppointments,
      completedAppointments,
      totalReviews,
      activeSubscriptions
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, { password_hash: 0, reset_token: 0 })
      .sort({ created_at: -1 }).lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const user = await User.findOne({ user_id: req.params.id });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    user.status = status;
    await user.save();

    res.json({ user_id: user.user_id, status: user.status });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/professionals
router.get('/professionals', async (req, res) => {
  try {
    const pros = await Professional.find().sort({ created_at: -1 }).lean();

    const enriched = await Promise.all(pros.map(async (pro) => {
      const user = await User.findOne({ user_id: pro.user_id }).lean();
      return {
        ...pro,
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        email: user?.email || ''
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/professionals/:id/verify
router.put('/professionals/:id/verify', async (req, res) => {
  try {
    const { is_verified } = req.body;
    const pro = await Professional.findOne({ profile_id: req.params.id });
    if (!pro) return res.status(404).json({ error: 'Professionnel non trouvé' });

    pro.is_verified = is_verified !== undefined ? is_verified : !pro.is_verified;
    await pro.save();

    res.json({ profile_id: pro.profile_id, is_verified: pro.is_verified });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/professionals/:id/visibility - Afficher/masquer un pro sur le front
router.put('/professionals/:id/visibility', async (req, res) => {
  try {
    const { is_active } = req.body;
    const pro = await Professional.findOne({ profile_id: req.params.id });
    if (!pro) return res.status(404).json({ error: 'Professionnel non trouvé' });

    pro.is_active = is_active !== undefined ? is_active : !pro.is_active;
    await pro.save();

    res.json({ profile_id: pro.profile_id, is_active: pro.is_active });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/reviews
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ created_at: -1 }).lean();

    const enriched = await Promise.all(reviews.map(async (review) => {
      const client = await User.findOne({ user_id: review.client_id }).lean();
      const pro = await Professional.findOne({ profile_id: review.profile_id }).lean();
      const proUser = pro ? await User.findOne({ user_id: pro.user_id }).lean() : null;
      return {
        ...review,
        client_name: client ? `${client.first_name} ${client.last_name}` : 'Inconnu',
        pro_name: proUser ? `${proUser.first_name} ${proUser.last_name}` : 'Inconnu'
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/reviews/:id/visibility
router.put('/reviews/:id/visibility', async (req, res) => {
  try {
    const { is_visible } = req.body;
    const review = await Review.findOne({ review_id: req.params.id });
    if (!review) return res.status(404).json({ error: 'Avis non trouvé' });

    review.is_visible = is_visible !== undefined ? is_visible : !review.is_visible;
    await review.save();

    // Recalculate pro average
    const visibleReviews = await Review.find({ profile_id: review.profile_id, is_visible: true });
    const avgRating = visibleReviews.length > 0
      ? visibleReviews.reduce((sum, r) => sum + r.rating, 0) / visibleReviews.length
      : 0;
    await Professional.updateOne(
      { profile_id: review.profile_id },
      { average_rating: Math.round(avgRating * 10) / 10, review_count: visibleReviews.length }
    );

    res.json({ review_id: review.review_id, is_visible: review.is_visible });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/users/:id - Delete a user and all their data
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ user_id: req.params.id });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Impossible de supprimer un administrateur' });

    const userId = user.user_id;
    const professional = await Professional.findOne({ user_id: userId });
    const profileId = professional?.profile_id;

    await Notification.deleteMany({ user_id: userId });
    await Favorite.deleteMany({ user_id: userId });
    await Subscription.deleteMany({ user_id: userId });
    await Message.deleteMany({ sender_id: userId });
    await Review.deleteMany({ client_id: userId });

    if (profileId) {
      await Service.deleteMany({ profile_id: profileId });
      await Availability.deleteMany({ profile_id: profileId });
      await PortfolioImage.deleteMany({ profile_id: profileId });
      await Review.deleteMany({ profile_id: profileId });
      await Appointment.deleteMany({ profile_id: profileId });
      await Professional.deleteOne({ profile_id: profileId });
    }

    await Appointment.deleteMany({ client_id: userId });
    await Conversation.deleteMany({ participants: userId });
    await User.deleteOne({ user_id: userId });

    res.json({ message: 'Utilisateur et données supprimés' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
