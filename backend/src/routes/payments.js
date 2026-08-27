const express = require('express');
const router = express.Router();
const { Transaction, Order } = require('../models');
const { broadcastRealtime } = require('../services/realtimeService');

router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const payload = req.body.toString('utf8');
    const event = JSON.parse(payload);
    if (event.type === 'checkout.session.completed') {
      const orderId = event.data?.object?.metadata?.orderId;
      if (orderId) {
        const order = await Order.findByPk(orderId);
        if (order) {
          order.status = 'processing';
          await order.save();
          await Transaction.create({
            orderId: order.id,
            amount: order.totalPrice,
            currency: 'USD',
            paymentMethod: 'Stripe',
            status: 'succeeded',
            providerReference: event.data.object.id,
          });
          broadcastRealtime({ type: 'order-updated', orderId: order.id, status: order.status });
        }
      }
    }
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;