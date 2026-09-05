const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sanitize(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

async function register(req, res) {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  if (role && !['employee', 'adjuster'].includes(role)) {
    return res.status(400).json({ error: 'role must be either employee or adjuster' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const user = await User.create({ name, email, password, role });
  res.status(201).json({ user: sanitize(user), token: signToken(user) });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.status(200).json({ user: sanitize(user), token: signToken(user) });
}

async function me(req, res) {
  res.status(200).json({ user: sanitize(req.user) });
}

module.exports = { register, login, me };
