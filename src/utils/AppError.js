// A thin error type carrying the HTTP status it should map to, so
// controllers can `throw new AppError(422, 'message')` and let the central
// error handler translate it into the standard response envelope.
class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

module.exports = AppError;
