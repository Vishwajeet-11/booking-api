const authService = require('../services/authService');
const { ok } = require('../utils/response');
const asyncHandler = require('../middleware/asyncHandler');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  return ok(res, result, 200);
});

module.exports = { login };
