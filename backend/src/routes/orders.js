const express = require('express');
const router = express.Router();
const { Order, OrderItem, FilmLab, User, Transaction } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { createCheckoutSession } = require('../services/paymentService');

const liveUpdates = new Map();

function broadcastOrderUpdate(orderId, payload) {
  const listeners = liveUpdates.get(orderId) || [];
  listeners.forEach((listener) => listener(payload));
}

function registerOrderListener(orderId, listener) {
  const listeners = liveUpdates.get(orderId) || [];
  listeners.push(listener);
  liveUpdates.set(orderId, listeners);
  return () => {
    const current = (liveUpdates.get(orderId) || []).filter((item) => item !== listener);
    if (current.length) liveUpdates.set(orderId, current);
    else liveUpdates.delete(orderId);
  };
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const orders = await Order.findAll({
      where,
      include: [
        { model: FilmLab, as: 'FilmLab' },
        { model: OrderItem, as: 'items' },
        { model: Transaction, as: 'transactions' },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: OrderItem, as: 'items' },
        { model: FilmLab, as: 'FilmLab' },
        { model: User, as: 'User' },
        { model: Transaction, as: 'transactions' },
      ],
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role !== 'admin' && order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { labId, items, dueDate, trackingCode, paymentMethod, createCheckout = false } = req.body;
    if (!labId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'labId and items are required' });
    }

    const totalPrice = items.reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 1), 0);
    const order = await Order.create({
      userId: req.user.id,
      labId,
      totalPrice,
      paymentMethod: paymentMethod || null,
      dueDate,
      trackingCode,
      status: paymentMethod ? 'processing' : 'pending',
    });

    if (paymentMethod) {
      await Transaction.create({
        orderId: order.id,
        amount: totalPrice,
        currency: 'USD',
        paymentMethod,
        status: 'succeeded',
        providerReference: `PAY-${Date.now()}`,
      });
    }

    const orderItems = items.map((item) => ({
      orderId: order.id,
      itemType: item.itemType,
      itemId: item.itemId,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
    }));

    await OrderItem.bulkCreate(orderItems);
    const createdOrder = await Order.findByPk(order.id, { include: [{ model: OrderItem, as: 'items' }] });

    let checkout = null;
    if (createCheckout) {
      if (paymentMethod === 'Bank QR' || process.env.BANK_QR_URL) {
        // Return static bank QR info from env for manual QR payments
        checkout = {
          provider: 'bank_qr',
          qrUrl: process.env.BANK_QR_URL || null,
          accountName: process.env.BANK_ACCOUNT_NAME || null,
          accountNumber: process.env.BANK_ACCOUNT_NUMBER || null,
          bankName: process.env.BANK_NAME || null,
        };
      } else {
        checkout = await createCheckoutSession({
          orderId: order.id,
          amount: totalPrice,
          currency: 'usd',
          successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders`,
          cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders`,
        });
      }
    }

    broadcastOrderUpdate(order.id, { orderId: order.id, status: order.status, createdAt: order.createdAt, totalPrice, checkout });
    res.status(201).json({ ...createdOrder.toJSON(), checkout });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { status } = req.body;
    if (!['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    order.status = status;
    await order.save();
    broadcastOrderUpdate(order.id, { orderId: order.id, status: order.status, updatedAt: new Date().toISOString() });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/confirm-payment', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { providerReference, uploadId } = req.body;

    // Create a pending transaction record for manual bank QR payment
    const tx = await Transaction.create({
      orderId: order.id,
      amount: order.totalPrice,
      currency: 'USD',
      paymentMethod: 'Bank QR',
      status: 'pending',
      providerReference: providerReference || null,
    });

    order.status = 'pending_verification';
    await order.save();

    // Optionally store proof reference on order (if uploadId provided)
    if (uploadId) {
      try {
        order.proofUploadId = uploadId;
        await order.save();
      } catch (e) {
        // ignore
      }
    }

    // Broadcast update to listeners
    broadcastOrderUpdate(order.id, { orderId: order.id, status: order.status, txId: tx.id });

    res.json({ message: 'Payment confirmation submitted', transaction: tx });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin approves a pending bank payment
router.post('/:id/verify-payment', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { action, transactionId } = req.body; // action: 'approve'|'reject'
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (action === 'approve') {
      order.status = 'completed';
      await order.save();
      // mark transaction as completed
      if (transactionId) {
        const tx = await Transaction.findByPk(transactionId);
        if (tx) {
          tx.status = 'completed';
          await tx.save();
        }
      }
      // create confirmed transaction if none
      const existing = await Transaction.findOne({ where: { orderId: order.id, status: 'completed' } });
      if (!existing) {
        await Transaction.create({ orderId: order.id, amount: order.totalPrice, currency: 'USD', paymentMethod: 'Bank QR', status: 'completed' });
      }
      broadcastOrderUpdate(order.id, { orderId: order.id, status: order.status });
      return res.json({ message: 'Order marked as paid' });
    } else if (action === 'reject') {
      order.status = 'payment_rejected';
      await order.save();
      broadcastOrderUpdate(order.id, { orderId: order.id, status: order.status });
      return res.json({ message: 'Order payment rejected' });
    }
    res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/live', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role !== 'admin' && order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const listener = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const unsubscribe = registerOrderListener(order.id, listener);
    res.write(`data: ${JSON.stringify({ orderId: order.id, status: order.status })}\n\n`);

    req.on('close', () => unsubscribe());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.__testHooks = { registerOrderListener, broadcastOrderUpdate };
