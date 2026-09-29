const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('EventRegistration', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    eventType: {
      type: DataTypes.ENUM('workshop', 'photowalk'),
      allowNull: false,
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('registered', 'checked_in', 'cancelled'),
      allowNull: false,
      defaultValue: 'registered',
    },
  }, {
    tableName: 'event_registrations',
    timestamps: true,
    indexes: [{ unique: true, fields: ['userId', 'eventType', 'eventId'] }],
  });
};
