const express = require('express');
const authRoutes = require('./authRoutes');
const bookingRoutes = require('./bookingRoutes');
const artistRoutes = require('./artistRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' }, error: null }));

router.use('/auth', authRoutes);
router.use('/bookings', bookingRoutes);
router.use('/artists', artistRoutes);

module.exports = router;
