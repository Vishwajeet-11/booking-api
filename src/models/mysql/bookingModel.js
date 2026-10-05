const { getPool } = require('../../config/mysql');

async function findById(id) {
  const [rows] = await getPool().query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// True if the artist already has a CONFIRMED booking whose time range
// overlaps [eventStart, eventEnd). Two ranges overlap when
// existing.start < new.end AND existing.end > new.start.
async function hasConfirmedOverlap(artistId, eventStart, eventEnd) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt
       FROM bookings
      WHERE artist_id = ?
        AND status = 'confirmed'
        AND event_start < ?
        AND event_end > ?`,
    [artistId, eventEnd, eventStart]
  );
  return rows[0].cnt > 0;
}

async function create({ clientId, artistId, eventStart, eventEnd, notes }) {
  const [result] = await getPool().query(
    `INSERT INTO bookings (client_id, artist_id, event_start, event_end, notes, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [clientId, artistId, eventStart, eventEnd, notes || null]
  );
  return findById(result.insertId);
}

async function updateStatus(id, status) {
  await getPool().query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

module.exports = { findById, hasConfirmedOverlap, create, updateStatus };
