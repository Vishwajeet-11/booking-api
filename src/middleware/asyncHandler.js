// Wraps an async controller so a rejected promise is forwarded to next(),
// instead of needing a try/catch in every controller function.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
