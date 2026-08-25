const { NotificationLog } = require('../db/models');

const dispatchNotification = async (alert, channel = 'EMAIL', recipient = 'admin@rockfall.com') => {
  try {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const message = `ALERT [${alert.severity}]: Device ${alert.device_id} triggered ${alert.event_type} - ${alert.message}`;

    console.log(`[Notification Service] Dispatching ${channel} to ${recipient}: ${message}`);

    const log = await NotificationLog.create({
      id: notificationId,
      alert_id: alert.id,
      channel,
      recipient,
      status: 'SENT',
      message
    });

    return log;
  } catch (error) {
    console.error('[Notification Service Error]:', error.message);
  }
};

module.exports = { dispatchNotification };
