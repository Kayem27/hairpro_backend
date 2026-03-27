const express = require('express');
const bcrypt = require('bcryptjs');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Professional = require('../models/Professional');
const Appointment = require('../models/Appointment');
const Favorite = require('../models/Favorite');
const Review = require('../models/Review');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Subscription = require('../models/Subscription');
const PortfolioImage = require('../models/PortfolioImage');
const Service = require('../models/Service');
const Availability = require('../models/Availability');

const router = express.Router();

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('au moins 8 caracteres');
  if (!/[A-Z]/.test(password)) errors.push('une lettre majuscule');
  if (!/[a-z]/.test(password)) errors.push('une lettre minuscule');
  if (!/[0-9]/.test(password)) errors.push('un chiffre');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('un caractere special (!@#$%...)');
  return errors;
}

// PUT /api/users/profile - Update own profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouve' });

    if (first_name) user.first_name = first_name.trim();
    if (last_name) user.last_name = last_name.trim();

    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(400).json({ error: 'Cet email est deja utilise' });
      user.email = email.toLowerCase();
    }

    await user.save();

    res.json({
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      status: user.status
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/users/password - Change password
router.put('/password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
    }

    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouve' });

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });

    const passwordErrors = validatePassword(new_password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: `Le mot de passe doit contenir : ${passwordErrors.join(', ')}.`
      });
    }

    user.password_hash = await bcrypt.hash(new_password, 10);
    await user.save();

    res.json({ message: 'Mot de passe modifie avec succes' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/users/export - Export all user data (RGPD Article 20)
router.get('/export', auth, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const user = await User.findOne({ user_id: userId }).select('-password_hash -reset_token -reset_token_expires -email_verification_token').lean();

    const professional = await Professional.findOne({ user_id: userId }).lean();
    const appointments = await Appointment.find({ $or: [{ client_id: userId }, { profile_id: professional?.profile_id }] }).lean();
    const favorites = await Favorite.find({ user_id: userId }).lean();
    const reviews = await Review.find({ client_id: userId }).lean();
    const conversations = await Conversation.find({ participants: userId }).lean();
    const messages = await Message.find({ sender_id: userId }).lean();
    const notifications = await Notification.find({ user_id: userId }).lean();
    const subscriptions = await Subscription.find({ user_id: userId }).lean();

    let portfolio = [];
    let services = [];
    if (professional) {
      portfolio = await PortfolioImage.find({ profile_id: professional.profile_id }).lean();
      services = await Service.find({ profile_id: professional.profile_id }).lean();
    }

    res.json({
      exported_at: new Date().toISOString(),
      user,
      professional,
      appointments,
      favorites,
      reviews,
      conversations,
      messages,
      notifications,
      subscriptions,
      portfolio,
      services
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'export des données' });
  }
});

// DELETE /api/users/me - Delete account and all data (RGPD Article 17)
router.delete('/me', auth, async (req, res) => {
  try {
    const userId = req.user.user_id;
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

    res.json({ message: 'Compte et données supprimés avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression du compte' });
  }
});

module.exports = router;
