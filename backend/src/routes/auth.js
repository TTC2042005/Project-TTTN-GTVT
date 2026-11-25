const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { User } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { buildAuthorizationUrl, getProviderProfile } = require('../services/oauthService');

dotenv.config();
const router = express.Router();

function getSafeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const target = new URL(value, frontendUrl);
    return target.origin === new URL(frontendUrl).origin ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch {
    return null;
  }
}

function getFrontendUrl() {
  return new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
}

function setOAuthStateCookie(res, provider, value) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `oauth_${provider}_state=${encodeURIComponent(value)}; Max-Age=600; Path=/api/auth; HttpOnly; SameSite=Lax${secure}`);
}

function clearOAuthStateCookie(res, provider) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `oauth_${provider}_state=; Max-Age=0; Path=/api/auth; HttpOnly; SameSite=Lax${secure}`);
}

function readCookie(req, name) {
  const cookies = req.headers.cookie || '';
  const entry = cookies.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function redirectToLogin(res, error) {
  const target = new URL('/login', getFrontendUrl());
  if (error) target.searchParams.set('oauthError', error);
  return res.redirect(target.toString());
}

function redirectWithLoginToken(res, token, returnTo) {
  const target = new URL('/login', getFrontendUrl());
  target.hash = new URLSearchParams({ oauth_token: token, returnTo: returnTo || '' }).toString();
  return res.redirect(target.toString());
}

function startOAuth(provider) {
  return (req, res) => {
    try {
      if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
      const nonce = crypto.randomBytes(32).toString('hex');
      const returnTo = getSafeReturnTo(req.query.returnTo);
      const signedState = jwt.sign({ nonce, returnTo }, process.env.JWT_SECRET, { expiresIn: '10m' });
      setOAuthStateCookie(res, provider, signedState);
      return res.redirect(buildAuthorizationUrl(provider, nonce));
    } catch (error) {
      return redirectToLogin(res, error.message.includes('not configured') ? `${provider}_not_configured` : 'oauth_failed');
    }
  };
}

function finishOAuth(provider) {
  return async (req, res) => {
    clearOAuthStateCookie(res, provider);
    try {
      if (req.query.error) return redirectToLogin(res, 'oauth_cancelled');
      const stateCookie = readCookie(req, `oauth_${provider}_state`);
      const state = req.query.state;
      const code = req.query.code;
      if (!stateCookie || typeof state !== 'string' || typeof code !== 'string') {
        return redirectToLogin(res, 'oauth_state_invalid');
      }

      const statePayload = jwt.verify(stateCookie, process.env.JWT_SECRET);
      if (statePayload.nonce !== state) return redirectToLogin(res, 'oauth_state_invalid');
      const profile = await getProviderProfile(provider, code);
      const providerIdField = provider === 'google' ? 'googleId' : 'facebookId';
      let user = await User.findOne({ where: { [providerIdField]: profile.id } });
      if (!user) {
        const existingEmail = await User.findOne({ where: { email: profile.email } });
        if (existingEmail) return redirectToLogin(res, 'oauth_account_exists');
        const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
        user = await User.create({
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          passwordHash,
          [providerIdField]: profile.id,
        });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
      const requestedPath = statePayload.returnTo || (user.role === 'admin' ? '/admin' : '/');
      return redirectWithLoginToken(res, token, requestedPath);
    } catch {
      return redirectToLogin(res, 'oauth_failed');
    }
  };
}

router.get('/google', startOAuth('google'));
router.get('/google/callback', finishOAuth('google'));
router.get('/facebook', startOAuth('facebook'));
router.get('/facebook/callback', finishOAuth('facebook'));

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
