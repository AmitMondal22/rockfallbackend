const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const AlertRule = sequelize.define('AlertRule', {
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
  device_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  event_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'ROCKFALL'
  },
  min_peak_g: {
    type: DataTypes.FLOAT,
    defaultValue: 1.50
  },
  max_peak_g: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  min_dur_ms: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  severity: {
    type: DataTypes.STRING(50),
    defaultValue: 'CRITICAL',
    validate: { isIn: [['INFO', 'WARNING', 'CRITICAL', 'LOW', 'MEDIUM', 'HIGH']] }
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_at: {
    type: DataTypes.DATE
  },
  updated_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'alert_rules',
  timestamps: false
});

module.exports = AlertRule;
