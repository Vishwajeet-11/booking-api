const { getPool } = require('../../config/mysql');

async function findByBookingId(bookingId) {
  const [rows] = await getPool().query('SELECT * FROM reviews WHERE booking_id = ? LIMIT 1', [
    bookingId,
  ]);
  return rows[0] || null;
}

async function create({ bookingId, artistId, clientId, score, comment }) {
  const [result] = await getPool().query(
    'INSERT INTO reviews (booking_id, artist_id, client_id, score, comment) VALUES (?, ?, ?, ?, ?)',
    [bookingId, artistId, clientId, score, comment || null]
  );
  const [rows] = await getPool().query('SELECT * FROM reviews WHERE id = ? LIMIT 1', [
    result.insertId,
  ]);
  return rows[0];
}

// Reviews for an artist, most recent first, paginated. Joins back to
// bookings so that if a booking's status were ever changed after a review
// was left, only reviews still tied to a completed booking show up.
async function findPageByArtist(artistId, { limit, offset }) {
  const [rows] = await getPool().query(
    `SELECT r.id, r.score, r.comment, r.created_at, r.client_id
       FROM reviews r
       JOIN bookings b ON b.id = r.booking_id
      WHERE r.artist_id = ?
        AND b.status = 'completed'
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
    [artistId, limit, offset]
  );
  return rows;
}

async function summaryByArtist(artistId) {
  const [[{ total, average }]] = await getPool().query(
    `SELECT COUNT(*) AS total, AVG(r.score) AS average
       FROM reviews r
       JOIN bookings b ON b.id = r.booking_id
      WHERE r.artist_id = ?
        AND b.status = 'completed'`,
    [artistId]
  );

  const [distributionRows] = await getPool().query(
    `SELECT r.score, COUNT(*) AS cnt
       FROM reviews r
       JOIN bookings b ON b.id = r.booking_id
      WHERE r.artist_id = ?
        AND b.status = 'completed'
      GROUP BY r.score`,
    [artistId]
  );

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distributionRows) {
    distribution[row.score] = row.cnt;
  }

  return {
    totalCount: total,
    averageScore: total > 0 ? Number(Number(average).toFixed(2)) : 0,
    distribution,
  };
}

// Task A — leaderboard: top 10 artists by average review score over the
// last 90 days, minimum 5 reviews in the window, tiebreak on completed
// booking count. See TASK3.md for index reasoning and the scale discussion.
async function leaderboard() {
  const [rows] = await getPool().query(
    `SELECT
        a.id AS artist_id,
        u.name AS artist_name,
        a.category,
        ROUND(AVG(r.score), 2) AS average_score,
        COUNT(DISTINCT r.id) AS review_count,
        (
          SELECT COUNT(*)
            FROM bookings b2
           WHERE b2.artist_id = a.id
             AND b2.status = 'completed'
        ) AS completed_booking_count
     FROM artists a
     JOIN users u ON u.id = a.user_id
     JOIN reviews r ON r.artist_id = a.id
     JOIN bookings b ON b.id = r.booking_id
     WHERE r.created_at >= (CURRENT_DATE - INTERVAL 90 DAY)
       AND b.status = 'completed'
     GROUP BY a.id, u.name, a.category
     HAVING COUNT(DISTINCT r.id) >= 5
     ORDER BY average_score DESC, completed_booking_count DESC
     LIMIT 10`
  );
  return rows;
}

module.exports = {
  findByBookingId,
  create,
  findPageByArtist,
  summaryByArtist,
  leaderboard,
};
