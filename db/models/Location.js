const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  org_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  project_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  lat: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  lng: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'locations',
  timestamps: true,
  underscored: true
});

module.exports = Location;
