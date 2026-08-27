const express = require('express');
const router = express.Router();
const { Message, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: {
        [require('sequelize').Op.or]: [
          { senderId: req.user.id },
          { recipientId: req.user.id },
        ],
      },
      order: [['sentAt', 'DESC']],
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    if (!recipientId || !content) {
      return res.status(400).json({ error: 'recipientId and content are required' });
    }
    const message = await Message.create({
      senderId: req.user.id,
      recipientId,
      content,
    });
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
