const bcrypt = require('bcrypt');
const userModel = require('../models/mysql/userModel');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

async function login(email, password) {
  if (!email || !password) {
    throw new AppError(400, 'email and password are required');
  }

  const user = await userModel.findByEmail(email);

  // Same 401 message whether the email doesn't exist or the password is
  // wrong, so we never reveal which field was incorrect.
  if (!user) {
    throw new AppError(401, 'Invalid email or password');
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    throw new AppError(401, 'Invalid email or password');
  }

  const token = signToken({ userId: user.id, role: user.role });
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

module.exports = { login };
