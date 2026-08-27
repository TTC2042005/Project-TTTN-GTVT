const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Favorite', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  }, {
    tableName: 'favorites',
    timestamps: true,
  });
};
