const { body, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Données invalides',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

const registerValidation = [
  body('email').isEmail().withMessage('Email invalide').normalizeEmail({ gmail_remove_dots: false }),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe trop court'),
  body('firstName').trim().notEmpty().withMessage('Prénom requis').escape(),
  body('lastName').trim().notEmpty().withMessage('Nom requis').escape(),
  body('role').optional().isIn(['client', 'pro']).withMessage('Rôle invalide'),
  handleValidation
];

const loginValidation = [
  body('email').isEmail().withMessage('Email invalide').normalizeEmail({ gmail_remove_dots: false }),
  body('password').notEmpty().withMessage('Mot de passe requis'),
  handleValidation
];

const appointmentValidation = [
  body('profile_id').trim().notEmpty().withMessage('Profil requis'),
  body('date').trim().notEmpty().withMessage('Date requise')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Format de date invalide (YYYY-MM-DD)'),
  body('slot_id').trim().notEmpty().withMessage('Créneau requis'),
  body('notes').optional().trim().escape(),
  handleValidation
];

const reviewValidation = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Note entre 1 et 5'),
  body('comment').optional().trim().escape(),
  handleValidation
];

const billingValidation = [
  body('plan').isIn(['monthly', 'annual']).withMessage('Plan invalide'),
  handleValidation
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Email invalide').normalizeEmail({ gmail_remove_dots: false }),
  handleValidation
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Token requis'),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe trop court'),
  handleValidation
];

module.exports = {
  handleValidation,
  registerValidation,
  loginValidation,
  appointmentValidation,
  reviewValidation,
  billingValidation,
  forgotPasswordValidation,
  resetPasswordValidation
};
