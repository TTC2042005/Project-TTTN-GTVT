const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Workshop, Photowalk, EventRegistration, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

router.get('/workshops', async (req, res) => {
  try {
    const workshops = await Workshop.findAll({ where: { publishedAt: { [Op.ne]: null } }, order: [['eventDate', 'ASC']] });
    res.json(workshops);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workshops', authenticateToken, async (req, res) => {
  try {
    const { title, description, location, eventDate, capacity, visibility } = req.body;
    if (!title || !eventDate) return res.status(400).json({ error: 'Title and eventDate are required' });

    const workshop = await Workshop.create({
      organizerId: req.user.id,
      title,
      description,
      location,
      eventDate,
      capacity: capacity || 20,
      publishedAt: visibility === 'public' ? new Date() : null,
    });
    res.status(201).json(workshop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/photowalks', async (req, res) => {
  try {
    const photowalks = await Photowalk.findAll({ where: { publishedAt: { [Op.ne]: null } }, order: [['eventDate', 'ASC']] });
    res.json(photowalks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/photowalks', authenticateToken, async (req, res) => {
  try {
    const { title, description, location, eventDate, capacity, visibility } = req.body;
    if (!title || !eventDate) return res.status(400).json({ error: 'Title and eventDate are required' });

    const photowalk = await Photowalk.create({
      organizerId: req.user.id,
      title,
      description,
      location,
      eventDate,
      capacity: capacity || 30,
      publishedAt: visibility === 'public' ? new Date() : null,
    });
    res.status(201).json(photowalk);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { eventType, eventId } = req.body;
    if (!['workshop', 'photowalk'].includes(eventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    const target = eventType === 'workshop' ? await Workshop.findByPk(eventId) : await Photowalk.findByPk(eventId);
    if (!target) return res.status(404).json({ error: 'Event not found' });

    const existing = await EventRegistration.findOne({ where: { eventType, eventId, userId: req.user.id } });
    if (existing) return res.status(400).json({ error: 'Already registered' });

    const registration = await EventRegistration.create({ eventType, eventId, userId: req.user.id, status: 'registered' });
    res.status(201).json(registration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/checkin', authenticateToken, async (req, res) => {
  try {
    const { registrationId } = req.body;
    const registration = await EventRegistration.findByPk(registrationId);
    if (!registration || registration.userId !== req.user.id) return res.status(404).json({ error: 'Registration not found' });
    registration.status = 'checked_in';
    await registration.save();
    res.json(registration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/my-registrations', authenticateToken, async (req, res) => {
  try {
    const registrations = await EventRegistration.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
