const AppError = require('../utils/AppError');
const { fail } = require('../utils/response');

// Central error handler. Controllers throw AppError for expected business
// errors (validation, 404, 422, 403); anything else is logged and returned
// as a generic 500 so internals never leak to the client.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return fail(res, err.statusCode, err.message);
  }

  console.error(err);
  return fail(res, 500, 'Internal server error');
}

function notFoundHandler(req, res) {
  return fail(res, 404, `No route for ${req.method} ${req.originalUrl}`);
}

module.exports = { errorHandler, notFoundHandler };
