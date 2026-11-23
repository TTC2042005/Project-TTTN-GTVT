const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ContentReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  reporterId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  targetType: {
    type: DataTypes.ENUM('post', 'comment', 'product', 'workshop', 'photowalk'),
    allowNull: false,
  },
  targetId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('open', 'reviewing', 'resolved', 'dismissed'),
    allowNull: false,
    defaultValue: 'open',
  },
  resolutionNote: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'content_reports',
  timestamps: true,
  indexes: [
    { fields: ['status', 'createdAt'] },
    { fields: ['targetType', 'targetId'] },
  ],
});
