const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Alert = sequelize.define('Alert', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true
  },
  rule_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  device_id: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  org_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  severity: {
    type: DataTypes.STRING(50),
    defaultValue: 'CRITICAL'
  },
  event_type: {
    type: DataTypes.STRING(50)
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  trigger_data: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'ACTIVE',
    validate: { isIn: [['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']] }
  },
  created_at: {
    type: DataTypes.DATE
  },
  updated_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'alerts',
  timestamps: false
});

module.exports = Alert;
