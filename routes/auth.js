const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const User = require('../models/User');
const Professional = require('../models/Professional');
const { auth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { registerValidation, loginValidation, forgotPasswordValidation, resetPasswordValidation } = require('../middleware/validate');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../services/emailService');

const router = express.Router();

function validatePassword(password) {
  const errors = [];
  if (password.length < 12) errors.push('au moins 12 caractères');
  if (!/[A-Z]/.test(password)) errors.push('une lettre majuscule');
  if (!/[a-z]/.test(password)) errors.push('une lettre minuscule');
  if (!/[0-9]/.test(password)) errors.push('un chiffre');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('un caractère spécial (!@#$%...)');
  return errors;
}

// POST /api/auth/register
router.post('/register', authLimiter, registerValidation, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: `Le mot de passe doit contenir : ${passwordErrors.join(', ')}.`
      });
    }

    if (role && !['client', 'pro'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      user_id: uuidv4(),
      email: email.toLowerCase(),
      password_hash,
      first_name: firstName,
      last_name: lastName,
      role: role || 'client'
    });

    // Si le rôle est pro, créer automatiquement le profil Professional
    if (user.role === 'pro') {
      await Professional.create({
        profile_id: uuidv4(),
        user_id: user.user_id
      });
    }

    // Send verification email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.email_verification_token = verificationToken;
    await user.save();
    await sendVerificationEmail(user.email, verificationToken);

    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Compte suspendu' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({
    user_id: req.user.user_id,
    email: req.user.email,
    first_name: req.user.first_name,
    last_name: req.user.last_name,
    role: req.user.role,
    status: req.user.status
  });
});

// GET /api/auth/verify-email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token requis' });

    const user = await User.findOne({ email_verification_token: token });
    if (!user) return res.status(400).json({ error: 'Token invalide ou déjà utilisé' });

    user.email_verified = true;
    user.email_verification_token = null;
    await user.save();

    res.json({ message: 'Email vérifié avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, forgotPasswordValidation, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.reset_token = token;
    user.reset_token_expires = new Date(Date.now() + 3600000); // 1h
    await user.save();

    await sendPasswordResetEmail(user.email, token);
    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, resetPasswordValidation, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token et mot de passe requis' });
    }
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: `Le mot de passe doit contenir : ${passwordErrors.join(', ')}.`
      });
    }

    const user = await User.findOne({
      reset_token: token,
      reset_token_expires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    user.password_hash = await bcrypt.hash(password, 10);
    user.reset_token = null;
    user.reset_token_expires = null;
    await user.save();

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
