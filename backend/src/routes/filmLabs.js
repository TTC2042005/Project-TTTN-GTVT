const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { FilmLab, LabService, LabPackage, Review } = require('../models');

router.get('/', async (req, res) => {
  try {
    const { city, country, minPrice, maxPrice, rating, serviceType, q } = req.query;
    const filters = {};

    if (city) filters.city = { [Op.iLike]: `%${city}%` };
    if (country) filters.country = { [Op.iLike]: `%${country}%` };
    if (rating) filters.rating = { [Op.gte]: Number(rating) };
    if (q) filters[Op.or] = [
      { name: { [Op.iLike]: `%${q}%` } },
      { description: { [Op.iLike]: `%${q}%` } },
      { address: { [Op.iLike]: `%${q}%` } },
    ];

    const include = [
      { model: LabService, as: 'services' },
      { model: LabPackage, as: 'packages' },
    ];

    if (serviceType) {
      include[0].where = { serviceType: { [Op.iLike]: `%${serviceType}%` } };
      include[0].required = true;
    }

    if (minPrice || maxPrice) {
      include[1].where = {};
      if (minPrice) include[1].where.price = { ...include[1].where.price, [Op.gte]: Number(minPrice) };
      if (maxPrice) include[1].where.price = { ...include[1].where.price, [Op.lte]: Number(maxPrice) };
      include[1].required = true;
    }

    const labs = await FilmLab.findAll({
      where: filters,
      include,
      order: [['rating', 'DESC'], ['createdAt', 'DESC']],
    });

    res.json(labs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const lab = await FilmLab.findByPk(req.params.id, {
      include: [
        { model: LabService, as: 'services' },
        { model: LabPackage, as: 'packages' },
      ],
    });

    if (!lab) return res.status(404).json({ error: 'Film lab not found' });
    const reviews = await Review.findAll({ where: { targetType: 'film_lab', targetId: lab.id } });
    res.json({ ...lab.toJSON(), reviews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
