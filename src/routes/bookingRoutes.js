const express = require('express');
const bookingController = require('../controllers/bookingController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /bookings — only clients can create a booking request.
router.post('/', authenticate, requireRole('client'), bookingController.createBooking);

// PATCH /bookings/:id/status — role + ownership + transition rules are
// enforced inside bookingService.updateBookingStatus.
router.patch('/:id/status', authenticate, bookingController.updateStatus);

// POST /bookings/:id/reviews — bonus endpoint, see README "Beyond the spec".
router.post('/:id/reviews', authenticate, requireRole('client'), bookingController.createReview);

module.exports = router;
