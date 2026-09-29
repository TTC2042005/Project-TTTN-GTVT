const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('MarketplaceOrder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    buyerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    sellerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    totalPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'confirmed', 'shipped', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shippingTracking: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    proofUploadId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'marketplace_orders',
    timestamps: true,
  });
};
