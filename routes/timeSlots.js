const express = require('express');
const TimeSlot = require('../models/TimeSlot');

const router = express.Router();

// GET /api/time-slots
router.get('/', async (req, res) => {
  try {
    const slots = await TimeSlot.find().sort({ start_time: 1 }).lean();
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
