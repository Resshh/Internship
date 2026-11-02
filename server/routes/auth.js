// POST /api/auth/login  { email, password }  ->  { token, user }
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = email && await User.findOne({ email: String(email).toLowerCase() });
  // Same message for wrong email and wrong password, so nobody can guess which accounts exist.
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const payload = { id: user._id, name: user.name, role: user.role };
  res.json({ token: jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' }), user: payload });
});

module.exports = router;
