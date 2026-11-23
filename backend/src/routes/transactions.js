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
    const { orderId, amount, paymentMethod } = req.body || {};
    const requestedAmount = Number(amount);
    if (!orderId || !Number.isFinite(requestedAmount) || requestedAmount <= 0
      || typeof paymentMethod !== 'string' || !paymentMethod.trim()) {
      return res.status(400).json({ error: 'orderId, amount, and paymentMethod are required' });
    }
    const order = await Order.findByPk(orderId);
    if (!order || order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Order not found or access denied' });
    }
    if (!['pending', 'payment_rejected'].includes(order.status)) {
      return res.status(409).json({ error: 'Order is not awaiting payment' });
    }
    if (Math.abs(requestedAmount - Number(order.totalPrice)) > 0.01) {
      return res.status(400).json({ error: 'Payment amount must match the order total' });
    }

    const dbTransaction = await Order.sequelize.transaction();
    let transaction;
    try {
      const currentOrder = await Order.findByPk(orderId, {
        transaction: dbTransaction,
        lock: dbTransaction.LOCK.UPDATE,
      });
      if (!currentOrder || currentOrder.userId !== req.user.id
        || !['pending', 'payment_rejected'].includes(currentOrder.status)) {
        await dbTransaction.rollback();
        return res.status(409).json({ error: 'Order is no longer awaiting payment' });
      }
      const existing = await Transaction.findOne({
        where: { orderId, status: 'pending', verificationStatus: 'pending' },
        transaction: dbTransaction,
      });
      if (existing) {
        await dbTransaction.rollback();
        return res.status(409).json({ error: 'A payment verification is already pending' });
      }
      transaction = await Transaction.create({
        orderId,
        amount: Number(currentOrder.totalPrice),
        currency: currentOrder.currency || 'VND',
        paymentMethod: paymentMethod.trim(),
        status: 'pending',
      }, { transaction: dbTransaction });
      await currentOrder.update({
        status: 'pending_verification',
        paymentMethod: paymentMethod.trim(),
      }, { transaction: dbTransaction });
      await dbTransaction.commit();
    } catch (error) {
      if (!dbTransaction.finished) await dbTransaction.rollback();
      throw error;
    }
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
