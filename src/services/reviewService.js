const reviewModel = require('../models/mysql/reviewModel');
const bookingModel = require('../models/mysql/bookingModel');
const artistModel = require('../models/mysql/artistModel');
const AppError = require('../utils/AppError');

async function getArtistReviews(artistId, { page = 1, limit = 10 }) {
  const artist = await artistModel.findById(artistId);
  if (!artist) {
    throw new AppError(404, `No artist found with id ${artistId}`);
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (safePage - 1) * safeLimit;

  const [reviews, summary] = await Promise.all([
    reviewModel.findPageByArtist(artistId, { limit: safeLimit, offset }),
    reviewModel.summaryByArtist(artistId),
  ]);

  return {
    artistId,
    page: safePage,
    limit: safeLimit,
    reviews,
    summary,
  };
}

// Not one of the 4 required endpoints, but included so the review flow is
// actually exercisable end-to-end (see README "Beyond the spec").
async function createReview(clientId, bookingId, { score, comment }) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new AppError(400, 'score must be an integer between 1 and 5');
  }

  const booking = await bookingModel.findById(bookingId);
  if (!booking) {
    throw new AppError(404, `No booking found with id ${bookingId}`);
  }
  if (booking.client_id !== clientId) {
    throw new AppError(403, 'You can only review your own bookings');
  }
  if (booking.status !== 'completed') {
    throw new AppError(422, 'Only completed bookings can be reviewed');
  }

  const existing = await reviewModel.findByBookingId(bookingId);
  if (existing) {
    throw new AppError(422, 'This booking has already been reviewed');
  }

  return reviewModel.create({
    bookingId,
    artistId: booking.artist_id,
    clientId,
    score,
    comment,
  });
}

async function getLeaderboard() {
  return reviewModel.leaderboard();
}

module.exports = { getArtistReviews, createReview, getLeaderboard };
