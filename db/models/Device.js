const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  dev_eui: {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true
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
  location: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  description: {
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
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'ONLINE',
    validate: { isIn: [['ONLINE', 'OFFLINE', 'ALERT']] }
  },
  battery: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  csq: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  rated_load_kn: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  motion_g: {
    type: DataTypes.FLOAT,
    defaultValue: 0.05
  },
  peak_g: {
    type: DataTypes.FLOAT,
    defaultValue: 0.20
  },
  rock_peak_g: {
    type: DataTypes.FLOAT,
    defaultValue: 1.50
  },
  rock_dur_ms: {
    type: DataTypes.INTEGER,
    defaultValue: 200
  },
  human_peak_max_g: {
    type: DataTypes.FLOAT,
    defaultValue: 1.60
  },
  human_dur_ms: {
    type: DataTypes.INTEGER,
    defaultValue: 500
  },
  human_peaks: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  threshold_version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  communication_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'HYBRID',
    validate: { isIn: [['HTTP', 'LORAWAN', 'MQTT', 'HYBRID']] }
  },
  asset_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  asset_position_pct: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_seen: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_event: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  last_restart_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'devices',
  timestamps: true,
  underscored: true
});

module.exports = Device;
