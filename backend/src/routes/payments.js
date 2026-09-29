const express = require('express');
const router = express.Router();
const { Transaction, Order } = require('../models');
const { broadcastRealtime } = require('../services/realtimeService');
const { broadcastOrderUpdate } = require('../services/orderEventService');
const stripe = require('stripe');

const stripeClient = process.env.STRIPE_SECRET_KEY ? stripe(process.env.STRIPE_SECRET_KEY) : null;

router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripeClient || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).json({ error: 'Stripe webhook is not configured' });
    }
    const signature = req.headers['stripe-signature'];
    if (!signature || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'Invalid webhook payload' });
    const event = stripeClient.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const orderId = session?.metadata?.orderId;
      if (orderId) {
        const order = await Order.findByPk(orderId);
        if (order && order.status === 'pending') {
          const existing = await Transaction.findOne({ where: { providerReference: session.id } });
          if (existing) return res.json({ received: true });
          order.status = 'processing';
          await order.save();
          await Transaction.create({
            orderId: order.id,
            amount: Number(session.amount_total || order.totalPrice),
            currency: String(session.currency || order.currency || 'vnd').toUpperCase(),
            paymentMethod: 'Stripe',
            status: 'succeeded',
            providerReference: session.id,
          });
          broadcastRealtime({ type: 'order-updated', orderId: order.id, status: order.status });
          broadcastOrderUpdate(order.id, { orderId: order.id, status: order.status, updatedAt: order.updatedAt });
        }
      }
    }
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: 'Invalid Stripe webhook signature or payload' });
  }
});

module.exports = router;