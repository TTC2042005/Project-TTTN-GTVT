const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

dotenv.config();
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role = 'photographer', phone, avatarUrl, location } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string' || !email.trim() || !password || !name.trim()) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (!['photographer', 'seller', 'lab_owner'].includes(role)) {
      return res.status(400).json({ error: 'Invalid account role' });
    }
    if ([phone, avatarUrl, location].some((value) => value != null && typeof value !== 'string')) {
      return res.status(400).json({ error: 'Profile fields must be strings' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
      role,
      phone: phone?.trim() || null,
      avatarUrl: avatarUrl?.trim() || null,
      location: location?.trim() || null,
    });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        location: user.location,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'email', 'role', 'phone', 'avatarUrl', 'location', 'bio', 'createdAt'] });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const { name } = body;
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const profileFields = ['phone', 'avatarUrl', 'location', 'bio'];
    if (profileFields.some((field) => Object.prototype.hasOwnProperty.call(body, field)
      && body[field] != null && typeof body[field] !== 'string')) {
      return res.status(400).json({ error: 'Profile fields must be strings' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = { name: name.trim() };
    for (const field of profileFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updates[field] = typeof body[field] === 'string' ? body[field].trim() || null : null;
      }
    }

    await user.update(updates);
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      location: user.location,
      bio: user.bio,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Password reset flow placeholder. Integrate email service to send reset links.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
