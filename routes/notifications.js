const express = require('express');
const { auth } = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();

// GET /api/notifications - Get user's notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user_id: req.user.user_id })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();
    const unread_count = await Notification.countDocuments({ user_id: req.user.user_id, is_read: false });
    res.json({ notifications, unread_count });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user_id: req.user.user_id, is_read: false },
      { is_read: true }
    );
    res.json({ message: 'Notifications marquees comme lues' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/notifications/:id/read - Mark one as read
router.post('/:id/read', auth, async (req, res) => {
  try {
    await Notification.updateOne(
      { notification_id: req.params.id, user_id: req.user.user_id },
      { is_read: true }
    );
    res.json({ message: 'Notification lue' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
