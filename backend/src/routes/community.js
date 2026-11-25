const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Post, Comment, User, Upload, Product, Workshop, Photowalk, ContentReport, sequelize } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const reportTargets = { post: Post, comment: Comment, product: Product, workshop: Workshop, photowalk: Photowalk };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const { title, body, tags, visibility, imageIds = [] } = req.body || {};
    if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    if (!Array.isArray(imageIds) || imageIds.length > 5 || imageIds.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'A post can include up to 5 uploaded images' });
    }
    if (tags != null && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string'))) {
      return res.status(400).json({ error: 'Tags must be a list of strings' });
    }
    if (visibility != null && !['public', 'private', 'draft'].includes(visibility)) {
      return res.status(400).json({ error: 'Unsupported post visibility' });
    }
    if (imageIds.length && visibility && visibility !== 'public') {
      return res.status(400).json({ error: 'Images can only be shared in public posts' });
    }

    const uploads = imageIds.length
      ? await Upload.findAll({ where: { id: [...new Set(imageIds)], userId: req.user.id } })
      : [];
    if (uploads.length !== new Set(imageIds).size) {
      return res.status(400).json({ error: 'One or more selected images are unavailable' });
    }

    const postVisibility = visibility || 'public';
    const post = await sequelize.transaction(async (transaction) => {
      const createdPost = await Post.create({
        authorId: req.user.id,
        title: title.trim(),
        body: body.trim(),
        tags: tags?.map((tag) => tag.trim()).filter(Boolean) || [],
        imageUrls: uploads.map((upload) => `/api/uploads/public/${upload.id}/file`),
        visibility: postVisibility,
        publishedAt: postVisibility === 'public' ? new Date() : null,
      }, { transaction });
      if (uploads.length) {
        await Upload.update(
          { shared: true },
          { where: { id: uploads.map((upload) => upload.id), userId: req.user.id }, transaction },
        );
      }
      return createdPost;
    });
    const response = await Post.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
    });
    res.status(201).json(response);
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

router.post('/reports', authenticateToken, async (req, res) => {
  try {
    const { targetType, targetId, reason } = req.body || {};
    const TargetModel = Object.prototype.hasOwnProperty.call(reportTargets, targetType)
      ? reportTargets[targetType]
      : null;
    if (!TargetModel || typeof targetId !== 'string' || !uuidPattern.test(targetId)
      || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'targetType, targetId, and a reason are required' });
    }
    if (reason.trim().length > 2000) return res.status(400).json({ error: 'Reason must be 2000 characters or fewer' });
    const target = await TargetModel.findByPk(targetId);
    if (!target) return res.status(404).json({ error: 'Reported content not found' });
    const existing = await ContentReport.findOne({
      where: { reporterId: req.user.id, targetType, targetId, status: { [Op.in]: ['open', 'reviewing'] } },
    });
    if (existing) return res.status(409).json({ error: 'You already have an open report for this content' });
    const report = await ContentReport.create({
      reporterId: req.user.id,
      targetType,
      targetId,
      reason: reason.trim(),
    });
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
