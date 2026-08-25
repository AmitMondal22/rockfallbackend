const { Alert, AlertRule, Device } = require('../db/models');
const { broadcast } = require('../websocket/wsServer');
const { dispatchNotification } = require('./notificationService');

const evaluateTelemetryAlerts = async (telemetry, device) => {
  try {
    if (!device) {
      device = await Device.findByPk(telemetry.device_id);
    }

    if (!device) return null;

    const generatedAlerts = [];

    // Check device threshold bounds
    const isRockfall = telemetry.peak_g >= (device.rock_peak_g || 1.50) || telemetry.event_type === 'ROCKFALL';
    const isHumanActivity = telemetry.peak_g >= (device.human_peak_max_g || 1.60) || telemetry.event_type === 'HUMAN';
    const isMotion = telemetry.peak_g >= (device.motion_g || 0.05);

    if (isRockfall || isHumanActivity) {
      const severity = isRockfall ? 'CRITICAL' : 'WARNING';
      const alertId = `alt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const message = `Impact event detected on device ${device.name || device.id}. Peak: ${telemetry.peak_g}g, Duration: ${telemetry.duration_ms}ms`;

      const alert = await Alert.create({
        id: alertId,
        device_id: device.id,
        org_id: device.org_id,
        severity,
        event_type: telemetry.event_type || (isRockfall ? 'ROCKFALL' : 'HUMAN'),
        message,
        trigger_data: {
          peak_g: telemetry.peak_g,
          duration_ms: telemetry.duration_ms,
          energy_g2: telemetry.energy_g2,
          battery: telemetry.battery,
          source: telemetry.source
        },
        status: 'ACTIVE'
      });

      // Update Device status to ALERT
      await device.update({ status: 'ALERT' });

      // Dispatch notification
      dispatchNotification(alert, 'EMAIL', 'alerts@rockfall.com');

      // WebSocket broadcast alert
      broadcast({
        type: 'alert_generated',
        event: 'ALERT_TRIGGERED',
        data: alert,
        timestamp: new Date().toISOString()
      });

      generatedAlerts.push(alert);
    }

    // Check user-configured Alert Rules in DB
    const activeRules = await AlertRule.findAll({
      where: {
        enabled: true,
        device_id: device.id
      }
    });

    for (const rule of activeRules) {
      if (telemetry.peak_g >= rule.min_peak_g && (!rule.max_peak_g || telemetry.peak_g <= rule.max_peak_g)) {
        const ruleAlertId = `alt_rule_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const ruleAlert = await Alert.create({
          id: ruleAlertId,
          rule_id: rule.id,
          device_id: device.id,
          org_id: device.org_id,
          severity: rule.severity,
          event_type: rule.event_type,
          message: `Rule '${rule.name}' triggered: Peak ${telemetry.peak_g}g >= ${rule.min_peak_g}g`,
          trigger_data: {
            peak_g: telemetry.peak_g,
            duration_ms: telemetry.duration_ms,
            rule_name: rule.name
          },
          status: 'ACTIVE'
        });

        broadcast({
          type: 'alert_generated',
          event: 'ALERT_RULE_TRIGGERED',
          data: ruleAlert,
          timestamp: new Date().toISOString()
        });

        generatedAlerts.push(ruleAlert);
      }
    }

    return generatedAlerts;
  } catch (error) {
    console.error('[Alert Engine Error]:', error.message);
    return [];
  }
};

module.exports = { evaluateTelemetryAlerts };
