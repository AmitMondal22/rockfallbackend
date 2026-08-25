const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const NotificationLog = sequelize.define('NotificationLog', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true
  },
  alert_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  channel: {
    type: DataTypes.STRING(50),
    defaultValue: 'EMAIL',
    validate: { isIn: [['EMAIL', 'SMS', 'WHATSAPP']] }
  },
  recipient: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'SENT'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'notification_logs',
  timestamps: true,
  underscored: true
});

module.exports = NotificationLog;
