// requireAuth: request must carry a valid login token (FR-01).
// requireAdmin: and the user must be an admin (FR-02, BR-08).
// Use on routes:  router.post('/', requireAdmin, handler)
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, name, role }
    next();
  } catch {
    res.status(401).json({ error: 'Please log in' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
