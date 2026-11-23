const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const {
  Order,
  User,
  FilmLab,
  Transaction,
  Review,
  Product,
  MarketplaceOrder,
  FilmScreening,
  TicketReservation,
  Workshop,
  Photowalk,
  EventRegistration,
  Post,
  Comment,
  ContentReport,
  AdminAuditLog,
} = require('../models');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { recordAdminAction } = require('../services/adminAuditService');

const adminOnly = [authenticateToken, authorizeRoles('admin')];
const validRoles = ['photographer', 'lab_owner', 'seller', 'admin'];
const eventModels = { workshop: Workshop, photowalk: Photowalk };

router.get('/overview', ...adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const [
      totalOrders,
      totalUsers,
      pendingOrders,
      processingOrders,
      completedOrders,
      labs,
      products,
      reviews,
      transactions,
      marketplaceOrders,
      pendingMarketplaceOrders,
      upcomingFilmScreenings,
      activeTicketReservations,
      pendingListings,
      pendingTransactionVerifications,
      openReports,
    ] = await Promise.all([
      Order.count(),
      User.count(),
      Order.count({ where: { status: { [Op.in]: ['pending', 'pending_verification'] } } }),
      Order.count({ where: { status: 'processing' } }),
      Order.count({ where: { status: 'completed' } }),
      FilmLab.count(),
      Product.count({ where: { moderationStatus: 'approved', stock: { [Op.gt]: 0 } } }),
      Review.count(),
      Transaction.count(),
      MarketplaceOrder.count(),
      MarketplaceOrder.count({ where: { status: 'pending' } }),
      FilmScreening.count({ where: { isPublished: true, eventDate: { [Op.gte]: now } } }),
      TicketReservation.count({ where: { status: 'reserved' } }),
      Product.count({ where: { moderationStatus: 'pending' } }),
      Transaction.count({ where: { status: 'pending', verificationStatus: 'pending' } }),
      ContentReport.count({ where: { status: { [Op.in]: ['open', 'reviewing'] } } }),
    ]);

    res.json({
      totalOrders,
      totalUsers,
      pendingOrders,
      processingOrders,
      completedOrders,
      labs,
      products,
      reviews,
      transactions,
      marketplaceOrders,
      pendingMarketplaceOrders,
      upcomingFilmScreenings,
      activeTicketReservations,
      pendingListings,
      pendingTransactionVerifications,
      openReports,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users', ...adminOnly, async (req, res) => {
  try {
    const where = {};
    if (typeof req.query.role === 'string' && validRoles.includes(req.query.role)) {
      where.role = req.query.role;
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const query = `%${req.query.q.trim()}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: query } },
        { email: { [Op.iLike]: query } },
      ];
    }
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'location', 'createdAt'],
      where,
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/users/:id/role', ...adminOnly, async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid user role' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.id === req.user.id && role !== 'admin') {
      return res.status(409).json({ error: 'You cannot remove your own admin role' });
    }
    if (user.role === 'admin' && role !== 'admin' && await User.count({ where: { role: 'admin' } }) < 2) {
      return res.status(409).json({ error: 'At least one administrator must remain' });
    }
    const previousRole = user.role;
    const transaction = await User.sequelize.transaction();
    try {
      await user.update({ role }, { transaction });
      await recordAdminAction(req, 'user.role_changed', 'user', user.id, { previousRole, role }, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/labs', ...adminOnly, async (req, res) => {
  try {
    const labs = await FilmLab.findAll({
      include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(labs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/marketplace/listings', ...adminOnly, async (req, res) => {
  try {
    const listings = await Product.findAll({
      include: [{ model: User, as: 'seller', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/marketplace/listings/:id', ...adminOnly, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Listing not found' });
    const { moderationStatus, title, price, stock } = req.body || {};
    const updates = {};
    if (moderationStatus !== undefined) {
      if (!['pending', 'approved', 'rejected'].includes(moderationStatus)) {
        return res.status(400).json({ error: 'Invalid moderation status' });
      }
      updates.moderationStatus = moderationStatus;
    }
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Title is required' });
      updates.title = title.trim();
    }
    if (price !== undefined) {
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: 'Price must be a non-negative number' });
      }
      updates.price = price;
    }
    if (stock !== undefined) {
      if (!Number.isSafeInteger(stock) || stock < 0) return res.status(400).json({ error: 'Stock must be a non-negative integer' });
      updates.stock = stock;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'At least one listing field is required' });

    const previousStatus = product.moderationStatus;
    const transaction = await Product.sequelize.transaction();
    try {
      await product.update(updates, { transaction });
      await recordAdminAction(req, 'marketplace.listing_updated', 'product', product.id, {
        changes: updates,
        previousStatus,
      }, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/marketplace/orders', ...adminOnly, async (req, res) => {
  try {
    const orders = await MarketplaceOrder.findAll({
      include: [
        { model: User, as: 'buyer', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'seller', attributes: ['id', 'name', 'email'] },
        { model: Product, as: 'product' },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/film-screenings', ...adminOnly, async (req, res) => {
  try {
    const screenings = await FilmScreening.findAll({
      include: [{
        model: TicketReservation,
        as: 'reservations',
        attributes: ['quantity', 'status'],
        required: false,
      }],
      order: [['eventDate', 'ASC']],
    });
    res.json(screenings.map((screening) => {
      const data = screening.toJSON();
      const reservedTickets = (data.reservations || [])
        .filter((reservation) => reservation.status === 'reserved')
        .reduce((total, reservation) => total + Number(reservation.quantity), 0);
      delete data.reservations;
      return {
        ...data,
        reservedTickets,
        availableTickets: Math.max(0, data.capacity - reservedTickets),
      };
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders', ...adminOnly, async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [{ model: User, as: 'User' }, { model: FilmLab, as: 'FilmLab' }, { model: Transaction, as: 'transactions' }],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/transactions', ...adminOnly, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      include: [
        { model: Order, as: 'Order', include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }] },
        { model: User, as: 'verifier', attributes: ['id', 'name', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/events', ...adminOnly, async (req, res) => {
  try {
    const [workshops, photowalks] = await Promise.all([
      Workshop.findAll({ include: [{ model: User, as: 'organizer', attributes: ['id', 'name', 'email'] }], order: [['eventDate', 'ASC']] }),
      Photowalk.findAll({ include: [{ model: User, as: 'organizer', attributes: ['id', 'name', 'email'] }], order: [['eventDate', 'ASC']] }),
    ]);
    const registrations = await EventRegistration.findAll({
      attributes: ['eventType', 'eventId', 'status'],
      where: { status: { [Op.in]: ['registered', 'checked_in'] } },
    });
    const counts = registrations.reduce((result, registration) => {
      const key = `${registration.eventType}:${registration.eventId}`;
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    const withCounts = (type, events) => events.map((event) => ({
      ...event.toJSON(),
      eventType: type,
      registeredCount: counts[`${type}:${event.id}`] || 0,
    }));
    res.json([...withCounts('workshop', workshops), ...withCounts('photowalk', photowalks)]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/events', ...adminOnly, async (req, res) => {
  try {
    const body = req.body || {};
    const Model = Object.prototype.hasOwnProperty.call(eventModels, body.eventType)
      ? eventModels[body.eventType]
      : null;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    const eventDate = new Date(body.eventDate);
    const capacity = Number(body.capacity);
    if (!Model || !title || !location || Number.isNaN(eventDate.getTime()) || eventDate <= new Date()
      || !Number.isSafeInteger(capacity) || capacity < 1) {
      return res.status(400).json({ error: 'A type, title, future date, location, and positive capacity are required' });
    }
    const event = await Model.create({
      organizerId: req.user.id,
      title,
      description: typeof body.description === 'string' ? body.description.trim() : null,
      location,
      eventDate,
      capacity,
      publishedAt: body.isPublished === true ? new Date() : null,
    });
    await recordAdminAction(req, 'event.created', body.eventType, event.id, { title, isPublished: Boolean(event.publishedAt) });
    res.status(201).json({ ...event.toJSON(), eventType: body.eventType, registeredCount: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/events/:eventType/:id', ...adminOnly, async (req, res) => {
  try {
    const Model = Object.prototype.hasOwnProperty.call(eventModels, req.params.eventType)
      ? eventModels[req.params.eventType]
      : null;
    if (!Model) return res.status(400).json({ error: 'Invalid event type' });
    const event = await Model.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const body = req.body || {};
    const updates = {};
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) return res.status(400).json({ error: 'Title is required' });
      updates.title = body.title.trim();
    }
    if (body.description !== undefined) {
      if (typeof body.description !== 'string') return res.status(400).json({ error: 'Description must be a string' });
      updates.description = body.description.trim();
    }
    if (body.location !== undefined) {
      if (typeof body.location !== 'string' || !body.location.trim()) return res.status(400).json({ error: 'Location is required' });
      updates.location = body.location.trim();
    }
    if (body.eventDate !== undefined) {
      const eventDate = new Date(body.eventDate);
      if (Number.isNaN(eventDate.getTime()) || eventDate <= new Date()) return res.status(400).json({ error: 'Event date must be in the future' });
      updates.eventDate = eventDate;
    }
    if (body.capacity !== undefined) {
      const capacity = Number(body.capacity);
      if (!Number.isSafeInteger(capacity) || capacity < 1) return res.status(400).json({ error: 'Capacity must be a positive integer' });
      const activeRegistrations = await EventRegistration.count({
        where: { eventType: req.params.eventType, eventId: event.id, status: { [Op.in]: ['registered', 'checked_in'] } },
      });
      if (capacity < activeRegistrations) return res.status(409).json({ error: 'Capacity cannot be lower than active registrations' });
      updates.capacity = capacity;
    }
    if (body.isPublished !== undefined) {
      if (typeof body.isPublished !== 'boolean') return res.status(400).json({ error: 'isPublished must be a boolean' });
      updates.publishedAt = body.isPublished ? (event.publishedAt || new Date()) : null;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'At least one event field is required' });

    const transaction = await Model.sequelize.transaction();
    try {
      await event.update(updates, { transaction });
      await recordAdminAction(req, 'event.updated', req.params.eventType, event.id, updates, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    res.json({ ...event.toJSON(), eventType: req.params.eventType });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/content/posts', ...adminOnly, async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
        { model: Comment, as: 'comments', attributes: ['id'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(posts.map((post) => {
      const data = post.toJSON();
      data.commentCount = data.comments.length;
      delete data.comments;
      return data;
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/content/posts/:id', ...adminOnly, async (req, res) => {
  try {
    const { visibility } = req.body || {};
    if (!['public', 'private', 'draft'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid post visibility' });
    }
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const previousVisibility = post.visibility;
    const transaction = await Post.sequelize.transaction();
    try {
      await post.update({ visibility, publishedAt: visibility === 'public' ? (post.publishedAt || new Date()) : null }, { transaction });
      await recordAdminAction(req, 'content.visibility_changed', 'post', post.id, { previousVisibility, visibility }, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports', ...adminOnly, async (req, res) => {
  try {
    const reports = await ContentReport.findAll({
      include: [{ model: User, as: 'reporter', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/reports/:id', ...adminOnly, async (req, res) => {
  try {
    const { status, resolutionNote } = req.body || {};
    if (!['reviewing', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid report status' });
    }
    if (resolutionNote != null && typeof resolutionNote !== 'string') {
      return res.status(400).json({ error: 'resolutionNote must be a string' });
    }
    const report = await ContentReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (['resolved', 'dismissed'].includes(report.status)) return res.status(409).json({ error: 'Report is already closed' });
    const note = resolutionNote?.trim() || null;
    if (status === 'dismissed' && !note) return res.status(400).json({ error: 'A resolution note is required when dismissing a report' });
    const transaction = await ContentReport.sequelize.transaction();
    try {
      await report.update({ status, resolutionNote: note }, { transaction });
      await recordAdminAction(req, 'content_report.reviewed', 'content_report', report.id, { status, note }, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit-logs', ...adminOnly, async (req, res) => {
  try {
    const logs = await AdminAuditLog.findAll({
      include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
