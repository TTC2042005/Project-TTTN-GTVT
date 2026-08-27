const express = require('express');
const router = express.Router();
const { Transaction, Order } = require('../models');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { '$Order.userId$': req.user.id };
    const transactions = await Transaction.findAll({
      where,
      include: [{ model: Order, as: 'Order' }],
      order: [['createdAt', 'DESC']],
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { orderId, amount, currency, paymentMethod } = req.body;
    if (!orderId || !amount || !paymentMethod) {
      return res.status(400).json({ error: 'orderId, amount, and paymentMethod are required' });
    }
    const order = await Order.findByPk(orderId);
    if (!order || order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Order not found or access denied' });
    }

    const transaction = await Transaction.create({
      orderId,
      amount,
      currency: currency || 'USD',
      paymentMethod,
      status: 'succeeded',
      providerReference: `PAY-${Date.now()}`,
    });
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
