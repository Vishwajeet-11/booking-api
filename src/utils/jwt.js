const jwt = require('jsonwebtoken');

function signToken({ userId, role }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');

  // Payload intentionally includes user ID, role, and issued-at time, as
  // required by the assignment. `iat` is added by jsonwebtoken automatically,
  // but we also set it explicitly so it's guaranteed present and named `iat`.
  return jwt.sign(
    { userId, role, iat: Math.floor(Date.now() / 1000) },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
