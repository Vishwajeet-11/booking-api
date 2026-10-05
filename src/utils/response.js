// Enforces the consistent response envelope the assignment asks for:
// { success: true/false, data: {}, error: 'message' }

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data: data === undefined ? {} : data, error: null });
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, data: {}, error: message });
}

module.exports = { ok, fail };
