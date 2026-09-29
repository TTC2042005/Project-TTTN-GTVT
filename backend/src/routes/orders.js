const express = require('express');
const router = express.Router();
const { Order, OrderItem, FilmLab, LabService, LabPackage, User, Upload, Transaction } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { createCheckoutSession } = require('../services/paymentService');
const { broadcastOrderUpdate, registerOrderListener } = require('../services/orderEventService');
const orderTransitions = {
  pending: ['pending_verification', 'received', 'processing', 'cancelled'],
  pending_verification: ['payment_rejected', 'processing'],
  payment_rejected: ['pending_verification', 'cancelled'],
  received: ['processing', 'cancelled'],
  processing: ['received', 'scanning', 'cancelled'],
  scanning: ['completed', 'cancelled'],
  completed: ['delivered'],
  delivered: [],
  cancelled: [],
};

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
    const { labId, items, dueDate, paymentMethod, createCheckout = false } = req.body;
    if (!labId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'labId and items are required' });
    }
    if (items.length > 50 || items.some((item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || !['service', 'package'].includes(item.itemType) || !item.itemId)) {
      return res.status(400).json({ error: 'Each item must reference a service/package and have a positive integer quantity' });
    }
    const lab = await FilmLab.findByPk(labId);
    if (!lab) return res.status(404).json({ error: 'Film lab not found' });

    const pricedItems = [];
    for (const item of items) {
      const Model = item.itemType === 'service' ? LabService : LabPackage;
      const record = await Model.findOne({ where: { id: item.itemId, labId } });
      if (!record) return res.status(400).json({ error: 'An order item does not belong to this film lab' });
      pricedItems.push({ itemType: item.itemType, itemId: record.id, quantity: Number(item.quantity), unitPrice: Number(record.price) });
    }
    const totalPrice = pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) return res.status(400).json({ error: 'Order total must be greater than zero' });

    const dbTransaction = await Order.sequelize.transaction();
    let order;
    try {
      order = await Order.create({
        userId: req.user.id,
        labId,
        totalPrice,
        paymentMethod: paymentMethod || null,
        dueDate: dueDate || null,
        status: 'pending',
      }, { transaction: dbTransaction });
      await OrderItem.bulkCreate(pricedItems.map((item) => ({ ...item, orderId: order.id })), { transaction: dbTransaction });
      if (paymentMethod) {
        await Transaction.create({
          orderId: order.id,
          amount: totalPrice,
          currency: 'VND',
          paymentMethod,
          status: 'pending',
        }, { transaction: dbTransaction });
      }
      await dbTransaction.commit();
    } catch (error) {
      await dbTransaction.rollback();
      throw error;
    }
    const createdOrder = await Order.findByPk(order.id, { include: [{ model: OrderItem, as: 'items' }] });

    let checkout = null;
    if (createCheckout) {
      if (paymentMethod === 'Bank QR') {
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
          currency: 'vnd',
          successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders`,
          cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders`,
        });
      }
    }

    broadcastOrderUpdate(order.id, { orderId: order.id, status: order.status, createdAt: order.createdAt, totalPrice, checkout });
    res.status(201).json({ ...createdOrder.toJSON(), checkout });
  } catch (error) {
    console.error('Unable to create lab order:', error);
    res.status(500).json({ error: 'Unable to create order' });
  }
});

router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { status } = req.body;
    if (!Object.prototype.hasOwnProperty.call(orderTransitions, status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const lab = await FilmLab.findByPk(order.labId);
    const isAdmin = req.user.role === 'admin';
    const isLabOwner = req.user.role === 'lab_owner' && lab?.ownerId === req.user.id;
    const isCustomerCancellation = order.userId === req.user.id && status === 'cancelled' && order.status === 'pending';
    if (!isAdmin && !isLabOwner && !isCustomerCancellation) return res.status(403).json({ error: 'Access denied' });
    if (!orderTransitions[order.status]?.includes(status)) return res.status(409).json({ error: 'Invalid order status transition' });
    if (isLabOwner && ['pending_verification', 'payment_rejected'].includes(status)) return res.status(403).json({ error: 'Payment status is managed by the payment workflow' });

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
    if (!uploadId) return res.status(400).json({ error: 'Payment proof is required' });
    const upload = await Upload.findOne({ where: { id: uploadId, userId: req.user.id } });
    if (!upload) return res.status(404).json({ error: 'Payment proof not found' });
    if (!['pending', 'payment_rejected'].includes(order.status)) return res.status(409).json({ error: 'Order is not awaiting manual payment' });

    const existingPending = await Transaction.findOne({ where: { orderId: order.id, paymentMethod: 'Bank QR', status: 'pending' } });
    if (existingPending) return res.status(409).json({ error: 'Payment proof has already been submitted' });

    // Create a pending transaction record for manual bank QR payment
    const tx = await Transaction.create({
      orderId: order.id,
      amount: order.totalPrice,
      currency: 'VND',
      paymentMethod: 'Bank QR',
      status: 'pending',
      providerReference: providerReference || null,
    });

    order.status = 'pending_verification';
    await order.save();

    order.proofUploadId = uploadId;
    await order.save();

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

    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    const tx = transactionId
      ? await Transaction.findOne({ where: { id: transactionId, orderId: order.id, status: 'pending' } })
      : await Transaction.findOne({ where: { orderId: order.id, paymentMethod: 'Bank QR', status: 'pending' } });
    if (!tx || order.status !== 'pending_verification') return res.status(409).json({ error: 'No pending payment verification exists' });

    if (action === 'approve') {
      order.status = 'processing';
      await order.save();
      tx.status = 'succeeded';
      await tx.save();
      broadcastOrderUpdate(order.id, { orderId: order.id, status: order.status });
      return res.json({ message: 'Order marked as paid' });
    } else if (action === 'reject') {
      order.status = 'payment_rejected';
      await order.save();
      tx.status = 'failed';
      await tx.save();
      broadcastOrderUpdate(order.id, { orderId: order.id, status: order.status });
      return res.json({ message: 'Order payment rejected' });
    }
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
