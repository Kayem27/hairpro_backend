const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentification requise' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ user_id: decoded.user_id });
    if (!user) return res.status(401).json({ error: 'Utilisateur non trouvé' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Compte suspendu' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    next();
  };
};

module.exports = { auth, requireRole };
