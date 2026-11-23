const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('TicketReservation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  screeningId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1 },
  },
  status: {
    type: DataTypes.ENUM('reserved', 'cancelled'),
    allowNull: false,
    defaultValue: 'reserved',
  },
}, {
  tableName: 'ticket_reservations',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['screeningId', 'userId'] },
    { fields: ['screeningId', 'status'] },
  ],
});
