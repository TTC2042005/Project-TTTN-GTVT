const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('FilmScreening', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  filmTitle: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  eventDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  venueName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  venueAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1 },
  },
  ticketPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: 0 },
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'film_screenings',
  timestamps: true,
  indexes: [{ fields: ['filmTitle', 'eventDate'] }],
});
