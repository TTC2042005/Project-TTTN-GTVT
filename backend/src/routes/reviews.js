const express = require('express');
const router = express.Router();
const { Review, FilmLab, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

router.get('/film-lab/:labId', async (req, res) => {
  try {
    const reviews = await Review.findAll({
      where: { targetType: 'film_lab', targetId: req.params.labId },
      include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/film-lab/:labId', authenticateToken, async (req, res) => {
  try {
    const { rating, reviewText } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const review = await Review.create({
      authorId: req.user.id,
      targetType: 'film_lab',
      targetId: req.params.labId,
      rating,
      reviewText,
    });
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
