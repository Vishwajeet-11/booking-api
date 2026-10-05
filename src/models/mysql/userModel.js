const { getPool } = require('../../config/mysql');

async function findByEmail(email) {
  const [rows] = await getPool().query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await getPool().query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function create({ name, email, passwordHash, role }) {
  const [result] = await getPool().query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, passwordHash, role]
  );
  return findById(result.insertId);
}

module.exports = { findByEmail, findById, create };
