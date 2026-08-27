const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Post, Comment, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

router.get('/posts', async (req, res) => {
  try {
    const { type, q } = req.query;
    const where = { visibility: 'public' };

    if (type) {
      where.tags = { [Op.contains]: [type] };
    }
    if (q) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q}%` } },
        { body: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const posts = await Post.findAll({
      where,
      include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
      order: [['publishedAt', 'DESC']],
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'name'] },
        { model: Comment, as: 'comments', include: [{ model: User, as: 'author', attributes: ['id', 'name'] }] },
      ],
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.visibility !== 'public') {
      return res.status(403).json({ error: 'Private post' });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/posts', authenticateToken, async (req, res) => {
  try {
    const { title, body, tags, visibility } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    const post = await Post.create({
      authorId: req.user.id,
      title,
      body,
      tags,
      visibility: visibility || 'public',
      publishedAt: visibility === 'public' ? new Date() : null,
    });
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/posts/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Comment content is required' });
    const comment = await Comment.create({
      postId: req.params.id,
      authorId: req.user.id,
      content,
    });
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
