const express = require('express');
const router = express.Router();
const { Order, User, FilmLab, Transaction, Review, Product } = require('../models');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/overview', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const totalOrders = await Order.count();
    const totalRevenue = await Order.sum('totalPrice');
    const totalUsers = await User.count();
    const pendingOrders = await Order.count({ where: { status: 'pending' } });
    const processingOrders = await Order.count({ where: { status: 'processing' } });
    const completedOrders = await Order.count({ where: { status: 'completed' } });
    const labs = await FilmLab.count();
    const products = await Product.count();
    const reviews = await Review.count();
    const transactions = await Transaction.count();

    res.json({
      totalOrders,
      totalRevenue: totalRevenue || 0,
      totalUsers,
      pendingOrders,
      processingOrders,
      completedOrders,
      labs,
      products,
      reviews,
      transactions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [{ model: User, as: 'User' }, { model: FilmLab, as: 'FilmLab' }, { model: Transaction, as: 'transactions' }],
      order: [['createdAt', 'DESC']],
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;