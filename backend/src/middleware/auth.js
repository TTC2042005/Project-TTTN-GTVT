const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { User } = require('../models');

dotenv.config();

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    try {
      const currentUser = await User.findByPk(user.id, { attributes: ['id', 'role'] });
      if (!currentUser) return res.status(401).json({ error: 'Account no longer exists' });
      req.user = { ...user, role: currentUser.role };
      next();
    } catch (error) {
      console.error('Unable to verify authenticated user:', error);
      res.status(500).json({ error: 'Unable to verify authentication' });
    }
  });
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}

async function attachUser(req, res, next) {
  if (!req.user) return next();
  req.user = await User.findByPk(req.user.id);
  next();
}

module.exports = { authenticateToken, authorizeRoles, attachUser };
