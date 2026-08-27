const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const router = express.Router();
const { FilmLab, LabService, LabPackage, Order, OrderItem, User } = require('../models');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const statusFlow = ['new', 'received', 'processing', 'scanning', 'completed', 'delivered'];

router.get('/dashboard', authenticateToken, authorizeRoles('lab_owner', 'admin'), async (req, res) => {
  try {
    const lab = await FilmLab.findOne({ where: { ownerId: req.user.id } });
    if (!lab && req.user.role !== 'admin') return res.status(404).json({ error: 'Lab not found' });

    const where = req.user.role === 'admin' ? {} : { labId: lab.id };

    const totalRevenue = await Order.sum('totalPrice', { where });
    const totalOrders = await Order.count({ where });
    const processingOrders = await Order.count({ where: { ...where, status: { [Op.in]: ['received', 'processing', 'scanning'] } } });
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newCustomers = await Order.count({
      where: { ...where, createdAt: { [Op.gte]: thirtyDaysAgo } },
      distinct: true,
      col: 'userId',
    });

    res.json({ totalRevenue: totalRevenue || 0, totalOrders, processingOrders, newCustomers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/services', authenticateToken, authorizeRoles('lab_owner', 'admin'), async (req, res) => {
  try {
    const lab = await FilmLab.findOne({ where: { ownerId: req.user.id } });
    if (!lab && req.user.role !== 'admin') return res.status(404).json({ error: 'Lab not found' });

    const services = await LabService.findAll({ where: { labId: lab.id } });
    const packages = await LabPackage.findAll({ where: { labId: lab.id } });
    res.json({ services, packages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/services', authenticateToken, authorizeRoles('lab_owner', 'admin'), async (req, res) => {
  try {
    const lab = await FilmLab.findOne({ where: { ownerId: req.user.id } });
    if (!lab && req.user.role !== 'admin') return res.status(404).json({ error: 'Lab not found' });

    const { name, serviceType, price, durationMinutes, description } = req.body;
    if (!name || !serviceType || typeof price !== 'number') {
      return res.status(400).json({ error: 'name, serviceType, and price are required' });
    }

    const service = await LabService.create({ labId: lab.id, name, serviceType, price, durationMinutes, description });
    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/packages', authenticateToken, authorizeRoles('lab_owner', 'admin'), async (req, res) => {
  try {
    const lab = await FilmLab.findOne({ where: { ownerId: req.user.id } });
    if (!lab && req.user.role !== 'admin') return res.status(404).json({ error: 'Lab not found' });

    const { title, description, price } = req.body;
    if (!title || typeof price !== 'number') {
      return res.status(400).json({ error: 'title and price are required' });
    }

    const pkg = await LabPackage.create({ labId: lab.id, title, description, price });
    res.status(201).json(pkg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders', authenticateToken, authorizeRoles('lab_owner', 'admin'), async (req, res) => {
  try {
    const lab = await FilmLab.findOne({ where: { ownerId: req.user.id } });
    if (!lab && req.user.role !== 'admin') return res.status(404).json({ error: 'Lab not found' });

    const orders = await Order.findAll({
      where: req.user.role === 'admin' ? {} : { labId: lab.id },
      order: [['createdAt', 'DESC']],
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/orders/:id/status', authenticateToken, authorizeRoles('lab_owner', 'admin'), async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const lab = await FilmLab.findOne({ where: { ownerId: req.user.id } });
    if (!lab && req.user.role !== 'admin') return res.status(404).json({ error: 'Lab not found' });
    if (req.user.role !== 'admin' && order.labId !== lab.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status } = req.body;
    if (!statusFlow.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid values: ${statusFlow.join(', ')}` });
    }

    order.status = status;
    await order.save();
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/customers', authenticateToken, authorizeRoles('lab_owner', 'admin'), async (req, res) => {
  try {
    const lab = await FilmLab.findOne({ where: { ownerId: req.user.id } });
    if (!lab && req.user.role !== 'admin') return res.status(404).json({ error: 'Lab not found' });

    const customerRows = await Order.findAll({
      where: req.user.role === 'admin' ? {} : { labId: lab.id },
      attributes: ['userId', [fn('COUNT', col('id')), 'orderCount'], [fn('SUM', col('totalPrice')), 'totalSpent']],
      group: ['userId'],
    });

    const customers = await Promise.all(customerRows.map(async (row) => {
      const user = await User.findByPk(row.userId, { attributes: ['id', 'name', 'email'] });
      return {
        user,
        orderCount: Number(row.get('orderCount')),
        totalSpent: Number(row.get('totalSpent')),
      };
    }));

    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/customers/:id', authenticateToken, authorizeRoles('lab_owner', 'admin'), async (req, res) => {
  try {
    const lab = await FilmLab.findOne({ where: { ownerId: req.user.id } });
    if (!lab && req.user.role !== 'admin') return res.status(404).json({ error: 'Lab not found' });

    const user = await User.findByPk(req.params.id, { attributes: ['id', 'name', 'email'] });
    if (!user) return res.status(404).json({ error: 'Customer not found' });

    const orders = await Order.findAll({
      where: req.user.role === 'admin' ? { userId: user.id } : { labId: lab.id, userId: user.id },
      order: [['createdAt', 'DESC']],
    });

    const totalSpent = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    res.json({ user, orders, totalSpent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports', authenticateToken, authorizeRoles('lab_owner', 'admin'), async (req, res) => {
  try {
    const lab = await FilmLab.findOne({ where: { ownerId: req.user.id } });
    if (!lab && req.user.role !== 'admin') return res.status(404).json({ error: 'Lab not found' });

    const period = req.query.period || 'daily';
    const where = req.user.role === 'admin' ? {} : { labId: lab.id };
    let rows;

    if (period === 'monthly') {
      rows = await Order.findAll({
        where,
        attributes: [
          [fn('TO_CHAR', col('createdAt'), 'YYYY-MM'), 'period'],
          [fn('SUM', col('totalPrice')), 'revenue'],
          [fn('COUNT', col('id')), 'orders'],
        ],
        group: [literal('period')],
        order: [literal('period DESC')],
      });
    } else {
      rows = await Order.findAll({
        where,
        attributes: [
          [fn('TO_CHAR', col('createdAt'), 'YYYY-MM-DD'), 'period'],
          [fn('SUM', col('totalPrice')), 'revenue'],
          [fn('COUNT', col('id')), 'orders'],
        ],
        group: [literal('period')],
        order: [literal('period DESC')],
      });
    }

    res.json(rows.map((row) => ({ period: row.get('period'), revenue: Number(row.get('revenue')), orders: Number(row.get('orders')) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
