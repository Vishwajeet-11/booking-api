const { verifyToken } = require('../utils/jwt');
const { fail } = require('../utils/response');

// Verifies the Bearer JWT and attaches { userId, role } to req.user.
// No sessions/cookies anywhere — auth is stateless, per the assignment.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return fail(res, 401, 'Missing or malformed Authorization header');
  }

  try {
    const payload = verifyToken(token);
    req.user = { userId: payload.userId, role: payload.role };
    return next();
  } catch (err) {
    return fail(res, 401, 'Invalid or expired token');
  }
}

// Factory for a role gate, e.g. requireRole('client').
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, `This action requires role: ${roles.join(' or ')}`);
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };
