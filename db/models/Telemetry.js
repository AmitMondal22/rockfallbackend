const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Telemetry = sequelize.define('Telemetry', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  device_id: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  uid: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  battery: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  csq: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  event_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'ROCKFALL'
  },
  peak_g: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  peaks: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  energy_g2: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  mean_g: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  raw_payload: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING(50),
    defaultValue: 'HTTP',
    validate: { isIn: [['HTTP', 'LORAWAN', 'MQTT']] }
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'telemetry',
  timestamps: true,
  underscored: true
});

module.exports = Telemetry;
