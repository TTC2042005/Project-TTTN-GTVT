const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('RagDocument', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'unknown',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    embedding: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    tableName: 'rag_documents',
    timestamps: true,
  });
};
