const { getPool } = require('../../config/mysql');

async function findById(id) {
  const [rows] = await getPool().query('SELECT * FROM artists WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// The artist's business profile row, looked up by their auth user id —
// needed to map "the logged-in artist" (from the JWT) to the artist_id
// that bookings/reviews are keyed on.
async function findByUserId(userId) {
  const [rows] = await getPool().query('SELECT * FROM artists WHERE user_id = ? LIMIT 1', [
    userId,
  ]);
  return rows[0] || null;
}

async function create({ userId, category, hourlyRate }) {
  const [result] = await getPool().query(
    'INSERT INTO artists (user_id, category, hourly_rate) VALUES (?, ?, ?)',
    [userId, category, hourlyRate]
  );
  return findById(result.insertId);
}

module.exports = { findById, findByUserId, create };
