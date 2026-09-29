const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Product, User, Favorite, MarketplaceOrder, Review, Upload } = require('../models');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { cameraPrices, getStaticCameraCatalog } = require('../services/marketplaceCatalogService');

const lensPrices = {
  'FE 100 mm F2.8 Macro GM OSS': 999,
  'FE 400–800 mm F6.3–8 G OSS': 2399,
  'FE 50-150 mm F2 GM': 1599,
  'Ống kính FE 100-400 mm F4.5 GM OSS': 2499,
  'Ống kính FE 100-400 mm F5.6-8 OSS': 1299,
};

const normalizeCameraProduct = (product) => {
  const data = product.toJSON ? product.toJSON() : product;
  if (data.category !== 'Cameras' || !cameraPrices[data.title]) return data;

  return {
    ...data,
    price: cameraPrices[data.title],
    imageUrl: `/Cameras/${encodeURIComponent(`${data.title}.jpg`)}`,
  };
};

router.get('/listings', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, condition } = req.query;
    const where = {};

    if (q) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (category) where.category = { [Op.iLike]: `%${category}%` };
    if (condition) where.condition = { [Op.iLike]: `%${condition}%` };
    if (minPrice) where.price = { ...(where.price || {}), [Op.gte]: Number(minPrice) };
    if (maxPrice) where.price = { ...(where.price || {}), [Op.lte]: Number(maxPrice) };

    const products = await Product.findAll({
      where,
      include: [{ model: User, as: 'seller', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(products.map(normalizeCameraProduct));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/listings/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: User, as: 'seller', attributes: ['id', 'name', 'email'] }],
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const reviews = await Review.findAll({ where: { targetType: 'marketplace_product', targetId: product.id } });
    res.json({ ...normalizeCameraProduct(product), reviews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static camera images from frontend/public/Cameras for listing/search
router.get('/static-cameras', async (req, res) => {
  try {
    res.json(await getStaticCameraCatalog());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/static-lenses', async (req, res) => {
  try {
    const lensesDir = path.resolve(__dirname, '..', '..', 'frontend', 'public', 'Lenses');
    if (!fs.existsSync(lensesDir)) return res.json([]);
    const files = fs.readdirSync(lensesDir).filter((f) => /\.(avif|jpg|jpeg|png|webp|gif)$/i.test(f));
    const items = files.map((file) => {
      const title = path.parse(file).name;
      return {
        id: `static-lens-${file}`,
        seller: null,
        title,
        category: 'Lenses',
        condition: 'New',
        price: lensPrices[title] || 0,
        description: 'Sony lens for creative photography and video work.',
        imageUrl: `/Lenses/${encodeURIComponent(file)}`,
        stock: 1,
      };
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/listings', authenticateToken, authorizeRoles('seller', 'admin'), async (req, res) => {
  try {
    const { title, category, condition, price, description, stock } = req.body;
    if (!title || !category || typeof price !== 'number') {
      return res.status(400).json({ error: 'title, category and price are required' });
    }

    const product = await Product.create({
      sellerId: req.user.id,
      title,
      category,
      condition,
      price,
      description,
      stock: stock || 1,
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/listings/:id', authenticateToken, authorizeRoles('seller', 'admin'), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.sellerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const updates = req.body;
    await product.update(updates);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/listings/:id', authenticateToken, authorizeRoles('seller', 'admin'), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.sellerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    await product.destroy();
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/favorites/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const existing = await Favorite.findOne({ where: { productId, userId: req.user.id } });
    if (existing) {
      await existing.destroy();
      return res.json({ message: 'Removed from favorites' });
    }
    const favorite = await Favorite.create({ productId, userId: req.user.id });
    res.status(201).json(favorite);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const favorites = await Favorite.findAll({
      where: { userId: req.user.id },
      include: [{ model: Product, as: 'product', include: [{ model: User, as: 'seller', attributes: ['id', 'name'] }] }],
    });
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity, paymentMethod } = req.body;
    const amount = Number(quantity);
    if (!productId || !Number.isInteger(amount) || amount < 1 || amount > 100) {
      return res.status(400).json({ error: 'productId and a positive integer quantity are required' });
    }

    const dbTransaction = await MarketplaceOrder.sequelize.transaction();
    try {
      const product = await Product.findByPk(productId, { transaction: dbTransaction, lock: dbTransaction.LOCK.UPDATE });
      if (!product) {
        await dbTransaction.rollback();
        return res.status(404).json({ error: 'Product not found' });
      }
      if (Number(product.stock) < amount) {
        await dbTransaction.rollback();
        return res.status(409).json({ error: 'Not enough stock' });
      }
      const order = await MarketplaceOrder.create({
        buyerId: req.user.id,
        sellerId: product.sellerId,
        productId: product.id,
        quantity: amount,
        totalPrice: Number(product.price) * amount,
        paymentMethod: paymentMethod || 'unpaid',
        status: 'pending',
      }, { transaction: dbTransaction });
      await product.update({ stock: Number(product.stock) - amount }, { transaction: dbTransaction });
      await dbTransaction.commit();
      res.status(201).json({ ...order.toJSON(), itemTitle: product.title, itemCategory: product.category });
    } catch (error) {
      await dbTransaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Unable to create marketplace order:', error);
    res.status(500).json({ error: 'Unable to create marketplace order' });
  }
});

router.post('/orders/:id/confirm-payment', authenticateToken, async (req, res) => {
  try {
    const order = await MarketplaceOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Marketplace order not found' });
    if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const { uploadId } = req.body;
    if (!uploadId) return res.status(400).json({ error: 'uploadId is required' });
    const upload = await Upload.findOne({ where: { id: uploadId, userId: req.user.id } });
    if (!upload) return res.status(404).json({ error: 'Payment proof not found' });

    order.proofUploadId = upload.id;
    order.paymentMethod = 'Bank QR';
    await order.save();
    res.json({ message: 'Payment proof submitted and is awaiting verification', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const buyerOrders = await MarketplaceOrder.findAll({ where: { buyerId: req.user.id }, include: [{ model: Product, as: 'product' }] });
    const sellerOrders = await MarketplaceOrder.findAll({ where: { sellerId: req.user.id }, include: [{ model: Product, as: 'product' }] });
    res.json({ buyerOrders, sellerOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const transitions = {
      pending: ['paid', 'cancelled'],
      paid: ['confirmed', 'cancelled'],
      confirmed: ['shipped', 'cancelled'],
      shipped: ['completed'],
      completed: [],
      cancelled: [],
    };
    if (!Object.prototype.hasOwnProperty.call(transitions, status)) return res.status(400).json({ error: `Invalid status: ${status}` });
    const dbTransaction = await MarketplaceOrder.sequelize.transaction();
    try {
      const order = await MarketplaceOrder.findByPk(req.params.id, { transaction: dbTransaction, lock: dbTransaction.LOCK.UPDATE });
      if (!order) {
        await dbTransaction.rollback();
        return res.status(404).json({ error: 'Marketplace order not found' });
      }
      const isBuyer = req.user.id === order.buyerId;
      const isSeller = req.user.id === order.sellerId;
      if (!isBuyer && !isSeller && req.user.role !== 'admin') {
        await dbTransaction.rollback();
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!transitions[order.status]?.includes(status)) {
        await dbTransaction.rollback();
        return res.status(409).json({ error: 'Invalid marketplace order status transition' });
      }
      if (status === 'completed' && !isBuyer && req.user.role !== 'admin') {
        await dbTransaction.rollback();
        return res.status(403).json({ error: 'Only the buyer can confirm delivery' });
      }
      if (status === 'paid' && req.user.role !== 'admin') {
        await dbTransaction.rollback();
        return res.status(403).json({ error: 'Only an administrator can verify payment' });
      }
      if (['confirmed', 'shipped'].includes(status) && !isSeller && req.user.role !== 'admin') {
        await dbTransaction.rollback();
        return res.status(403).json({ error: 'Only the seller can process this status' });
      }
      if (status === 'cancelled' && order.status !== 'pending' && req.user.role !== 'admin') {
        await dbTransaction.rollback();
        return res.status(403).json({ error: 'Only an administrator can cancel after payment' });
      }
      if (status === 'cancelled' && order.productId) {
        const product = await Product.findByPk(order.productId, { transaction: dbTransaction, lock: dbTransaction.LOCK.UPDATE });
        if (product) await product.update({ stock: Number(product.stock) + Number(order.quantity) }, { transaction: dbTransaction });
      }
      order.status = status;
      await order.save({ transaction: dbTransaction });
      await dbTransaction.commit();
      res.json(order);
    } catch (error) {
      await dbTransaction.rollback();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/listings/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const { rating, reviewText } = req.body;
    const { id } = req.params;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const review = await Review.create({
      authorId: req.user.id,
      targetType: 'marketplace_product',
      targetId: product.id,
      rating,
      reviewText,
    });
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
