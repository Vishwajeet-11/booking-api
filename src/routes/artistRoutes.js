const express = require('express');
const artistController = require('../controllers/artistController');

const router = express.Router();

// GET /artists/leaderboard — registered before /:id/reviews so "leaderboard"
// is never captured as an :id param.
router.get('/leaderboard', artistController.getLeaderboard);

// GET /artists/:id/reviews
router.get('/:id/reviews', artistController.getReviews);

module.exports = router;
