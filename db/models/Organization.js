const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'organizations',
  timestamps: true,
  underscored: true
});

module.exports = Organization;
