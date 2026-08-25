const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Asset = sequelize.define('Asset', {
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
  location_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  asset_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'FENCE_BARRIER'
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'OPERATIONAL'
  },
  coordinates: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  specifications: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'assets',
  timestamps: true,
  underscored: true
});

module.exports = Asset;
