const bookingService = require('../services/bookingService');
const reviewService = require('../services/reviewService');
const { ok } = require('../utils/response');
const asyncHandler = require('../middleware/asyncHandler');

const createBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking(req.user.userId, req.body);
  return ok(res, booking, 201);
});

const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const booking = await bookingService.updateBookingStatus(id, req.user, status);
  return ok(res, booking, 200);
});

// Bonus, not one of the 4 required endpoints — lets a client leave a review
// once their booking is completed, so GET /artists/:id/reviews has
// something real to return. See README "Beyond the spec".
const createReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const review = await reviewService.createReview(req.user.userId, id, req.body);
  return ok(res, review, 201);
});

module.exports = { createBooking, updateStatus, createReview };
