const { NotificationLog, Alert } = require('../db/models');
const { dispatchNotification } = require('../services/notificationService');

const getNotificationLogs = async (req, res, next) => {
  try {
    const { channel, status, page = 1, limit = 50 } = req.query;
    const whereClause = {};

    if (channel) whereClause.channel = channel;
    if (status) whereClause.status = status;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: logs } = await NotificationLog.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      include: [{ model: Alert, as: 'alert' }]
    });

    return res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      logs
    });
  } catch (error) {
    next(error);
  }
};

const resendNotification = async (req, res, next) => {
  try {
    const { alert_id, channel, recipient } = req.body;

    const alert = await Alert.findByPk(alert_id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    const log = await dispatchNotification(alert, channel || 'EMAIL', recipient || 'admin@rockfall.com');

    return res.json({
      success: true,
      message: 'Notification resent successfully',
      log
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotificationLogs,
  resendNotification
};
