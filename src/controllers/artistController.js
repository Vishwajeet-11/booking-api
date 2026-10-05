const reviewService = require('../services/reviewService');
const { ok } = require('../utils/response');
const asyncHandler = require('../middleware/asyncHandler');

const getReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit } = req.query;
  const result = await reviewService.getArtistReviews(id, { page, limit });
  return ok(res, result, 200);
});

// Bonus — implements the query written out in TASK3.md Task A.
const getLeaderboard = asyncHandler(async (req, res) => {
  const rows = await reviewService.getLeaderboard();
  return ok(res, { leaderboard: rows }, 200);
});

module.exports = { getReviews, getLeaderboard };
