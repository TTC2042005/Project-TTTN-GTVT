const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Product, User, Favorite, MarketplaceOrder, Review } = require('../models');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const cameraPrices = {
  'Canon EOS Rebel T5 (EOS 1200D)': 280,
  'Canon EOS Rebel T6 (1300D)': 350,
  'Canon PowerShot SX620 HS': 180,
  'Nikon Coolpix B500': 220,
  'Nikon COOLPIX P610': 260,
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
    const camerasDir = path.resolve(__dirname, '..', '..', 'frontend', 'public', 'Cameras');
    if (!fs.existsSync(camerasDir)) return res.json([]);
    const files = fs.readdirSync(camerasDir).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
    const items = files.map((file) => {
      const title = path.parse(file).name;
      return {
        id: `static-${file}`,
        seller: null,
        title,
        category: 'Cameras',
        condition: 'Used',
        price: cameraPrices[title] || 0,
        description: '',
        imageUrl: `/Cameras/${encodeURIComponent(file)}`,
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
    if (!productId || !quantity) return res.status(400).json({ error: 'productId and quantity are required' });

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock < quantity) return res.status(400).json({ error: 'Not enough stock' });

    const unitPrice = cameraPrices[product.title] || product.price;
    const totalPrice = unitPrice * quantity;
    const order = await MarketplaceOrder.create({
      buyerId: req.user.id,
      sellerId: product.sellerId,
      productId,
      quantity,
      totalPrice,
      paymentMethod: paymentMethod || 'unpaid',
      status: 'pending',
    });

    await product.update({ stock: product.stock - quantity });
    res.status(201).json(order);
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
    const order = await MarketplaceOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Marketplace order not found' });
    if (req.user.id !== order.sellerId && req.user.id !== order.buyerId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { status } = req.body;
    const valid = ['pending', 'paid', 'confirmed', 'shipped', 'completed', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: `Invalid status: ${status}` });
    order.status = status;
    await order.save();
    res.json(order);
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
