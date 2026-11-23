const express = require('express');
const { Op } = require('sequelize');
const { FilmScreening, TicketReservation } = require('../models');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { recordAdminAction } = require('../services/adminAuditService');

const router = express.Router();

function serializeScreening(screening) {
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
}

function parseFutureDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date <= new Date() ? null : date;
}

function parseNonNegativeNumber(value) {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

router.get('/', async (req, res) => {
  try {
    const where = {
      isPublished: true,
      eventDate: { [Op.gte]: new Date() },
    };
    if (typeof req.query.filmTitle === 'string' && req.query.filmTitle.trim()) {
      where.filmTitle = req.query.filmTitle.trim();
    }

    const screenings = await FilmScreening.findAll({
      where,
      include: [{
        model: TicketReservation,
        as: 'reservations',
        attributes: ['quantity', 'status'],
        where: { status: 'reserved' },
        required: false,
      }],
      order: [['eventDate', 'ASC']],
    });
    res.json(screenings.map(serializeScreening));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const body = req.body || {};
    const filmTitle = typeof body.filmTitle === 'string' ? body.filmTitle.trim() : '';
    const venueName = typeof body.venueName === 'string' ? body.venueName.trim() : '';
    const venueAddress = typeof body.venueAddress === 'string' ? body.venueAddress.trim() : '';
    const eventDate = parseFutureDate(body.eventDate);
    const capacity = Number(body.capacity);
    const ticketPrice = parseNonNegativeNumber(body.ticketPrice);

    if (!filmTitle || !venueName || !venueAddress || !eventDate
      || !Number.isSafeInteger(capacity) || capacity < 1
      || ticketPrice == null) {
      return res.status(400).json({
        error: 'filmTitle, a future eventDate, venueName, venueAddress, positive capacity, and non-negative ticketPrice are required',
      });
    }

    const screening = await FilmScreening.create({
      filmTitle,
      eventDate,
      venueName,
      venueAddress,
      capacity,
      ticketPrice,
    });
    await recordAdminAction(req, 'screening.created', 'film_screening', screening.id, {
      filmTitle,
      venueName,
      eventDate,
    });
    res.status(201).json(serializeScreening(screening));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const body = req.body || {};
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(body, 'filmTitle')) {
    if (typeof body.filmTitle !== 'string' || !body.filmTitle.trim()) {
      return res.status(400).json({ error: 'filmTitle must be a non-empty string' });
    }
    updates.filmTitle = body.filmTitle.trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'eventDate')) {
    updates.eventDate = parseFutureDate(body.eventDate);
    if (!updates.eventDate) return res.status(400).json({ error: 'eventDate must be a future date' });
  }
  for (const field of ['venueName', 'venueAddress']) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      if (typeof body[field] !== 'string' || !body[field].trim()) {
        return res.status(400).json({ error: `${field} must be a non-empty string` });
      }
      updates[field] = body[field].trim();
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'capacity')) {
    const capacity = Number(body.capacity);
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      return res.status(400).json({ error: 'capacity must be a positive integer' });
    }
    updates.capacity = capacity;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'ticketPrice')) {
    const ticketPrice = parseNonNegativeNumber(body.ticketPrice);
    if (ticketPrice == null) {
      return res.status(400).json({ error: 'ticketPrice must be a non-negative number' });
    }
    updates.ticketPrice = ticketPrice;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'isPublished')) {
    if (typeof body.isPublished !== 'boolean') return res.status(400).json({ error: 'isPublished must be a boolean' });
    updates.isPublished = body.isPublished;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'At least one screening field is required' });

  const transaction = await FilmScreening.sequelize.transaction();
  try {
    const screening = await FilmScreening.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!screening) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Screening not found' });
    }

    if (updates.capacity != null) {
      const reservedTickets = Number(await TicketReservation.sum('quantity', {
        where: { screeningId: screening.id, status: 'reserved' },
        transaction,
      })) || 0;
      if (updates.capacity < reservedTickets) {
        await transaction.rollback();
        return res.status(409).json({ error: 'Capacity cannot be lower than the number of reserved tickets' });
      }
    }

    await screening.update(updates, { transaction });
    await recordAdminAction(req, 'screening.updated', 'film_screening', screening.id, updates, transaction);
    await transaction.commit();
    res.json(serializeScreening(screening));
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reservations', authenticateToken, async (req, res) => {
  const quantity = Number(req.body?.quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    return res.status(400).json({ error: 'quantity must be an integer between 1 and 10' });
  }

  const transaction = await FilmScreening.sequelize.transaction();
  try {
    const screening = await FilmScreening.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!screening || !screening.isPublished || screening.eventDate <= new Date()) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Upcoming screening not found' });
    }

    const existing = await TicketReservation.findOne({
      where: { screeningId: screening.id, userId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existing?.status === 'reserved') {
      await transaction.rollback();
      return res.status(409).json({ error: 'You already have a reservation for this screening' });
    }

    const reservedTickets = Number(await TicketReservation.sum('quantity', {
      where: { screeningId: screening.id, status: 'reserved' },
      transaction,
    })) || 0;
    if (reservedTickets + quantity > screening.capacity) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Not enough tickets remain' });
    }

    const reservation = existing
      ? await existing.update({ quantity, status: 'reserved' }, { transaction })
      : await TicketReservation.create({
          screeningId: screening.id,
          userId: req.user.id,
          quantity,
          status: 'reserved',
        }, { transaction });
    await transaction.commit();
    res.status(existing ? 200 : 201).json({
      ...reservation.toJSON(),
      screening: screening.toJSON(),
      availableTickets: screening.capacity - reservedTickets - quantity,
    });
  } catch (error) {
    await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'You already have a reservation for this screening' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/my-reservations', authenticateToken, async (req, res) => {
  try {
    const reservations = await TicketReservation.findAll({
      where: { userId: req.user.id },
      include: [{ model: FilmScreening, as: 'screening' }],
      order: [['createdAt', 'DESC']],
    });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/reservations/:id', authenticateToken, async (req, res) => {
  const transaction = await TicketReservation.sequelize.transaction();
  try {
    const reservationReference = await TicketReservation.findByPk(req.params.id, { transaction });
    if (!reservationReference) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Reservation not found' });
    }

    await FilmScreening.findByPk(reservationReference.screeningId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const reservation = await TicketReservation.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!reservation || (reservation.userId !== req.user.id && req.user.role !== 'admin')) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Reservation not found' });
    }
    if (reservation.status !== 'reserved') {
      await transaction.rollback();
      return res.status(409).json({ error: 'Reservation is already cancelled' });
    }

    await reservation.update({ status: 'cancelled' }, { transaction });
    await transaction.commit();
    res.json({ message: 'Reservation cancelled', reservation });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
