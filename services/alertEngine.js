const { Alert, AlertRule, Device } = require('../db/models');
const { broadcast } = require('../websocket/wsServer');
const { dispatchNotification } = require('./notificationService');

/**
 * Check if an alert rule applies to a specific device
 */
const ruleAppliesToDevice = (rule, device) => {
  // If rule has an organization filter and it doesn't match device org
  if (rule.org_id && device.org_id && rule.org_id !== device.org_id) {
    return false;
  }

  // Check device_ids array (multiple devices)
  const deviceIds = Array.isArray(rule.device_ids) ? rule.device_ids.filter(Boolean) : [];
  if (deviceIds.length > 0) {
    return deviceIds.includes(device.id);
  }

  // Check single device_id
  if (rule.device_id) {
    return rule.device_id === device.id;
  }

  // If no device specified, applies to all devices
  return true;
};

/**
 * Evaluate structured conditions against telemetry payload
 * Supports conditionLogic: 'ALL' (AND - every condition must match) or 'ANY' (OR - at least one condition matches)
 */
const evaluateConditions = (conditions, telemetry, conditionLogic = 'ALL') => {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;

  const validConditions = conditions.filter(c => c && c.field && c.operator && c.value !== undefined && c.value !== null && c.value !== '');
  if (validConditions.length === 0) return true;

  const checkSingle = cond => {
    const field = cond.field;
    const op = cond.operator;
    const targetVal = parseFloat(cond.value);
    if (isNaN(targetVal)) return true;

    let actualVal = null;
    if (field === 'peak_g') actualVal = parseFloat(telemetry.peak_g ?? telemetry.peakG);
    else if (field === 'duration_ms') actualVal = parseFloat(telemetry.duration_ms ?? telemetry.durationMs);
    else if (field === 'peaks') actualVal = parseFloat(telemetry.peaks);
    else if (field === 'energy_g2') actualVal = parseFloat(telemetry.energy_g2 ?? telemetry.energyG2);
    else if (field === 'battery') actualVal = parseFloat(telemetry.battery ?? telemetry.voltage);
    else if (field === 'csq') actualVal = parseFloat(telemetry.csq ?? telemetry.signal);
    else if (field === 'mean_g') actualVal = parseFloat(telemetry.mean_g ?? telemetry.meanG);
    else if (field === 'load_kn') actualVal = parseFloat(telemetry.load_kn ?? telemetry.loadKn ?? telemetry.raw_payload?.load_kn);
    else if (field === 'loadCapacityPct') actualVal = parseFloat(telemetry.loadCapacityPct ?? telemetry.raw_payload?.loadCapacityPct);
    else actualVal = parseFloat(telemetry[field]);

    if (actualVal === null || isNaN(actualVal)) return false;

    switch (op) {
      case '>': return actualVal > targetVal;
      case '>=': return actualVal >= targetVal;
      case '<': return actualVal < targetVal;
      case '<=': return actualVal <= targetVal;
      case '==': return actualVal === targetVal;
      case '!=': return actualVal !== targetVal;
      default: return actualVal >= targetVal;
    }
  };

  const logic = String(conditionLogic || 'ALL').toUpperCase();
  if (logic === 'ANY' || logic === 'OR') {
    return validConditions.some(checkSingle);
  }
  return validConditions.every(checkSingle);
};

/**
 * Evaluate telemetry packet against device thresholds and safety rules
 */
const evaluateTelemetryAlerts = async (telemetry, device) => {
  try {
    if (!device) {
      device = await Device.findByPk(telemetry.device_id);
    }
    if (!device) return [];

    const generatedAlerts = [];
    const eventTypeStr = String(telemetry.event_type || '').toUpperCase();

    // Check device threshold bounds
    const isRockfall = telemetry.peak_g >= (device.rock_peak_g || 1.50) || eventTypeStr.includes('ROCK');
    const isHumanActivity = telemetry.peak_g >= (device.human_peak_max_g || 1.60) || eventTypeStr.includes('HUMAN');

    // Retrieve all active safety rules in database
    const activeRules = await AlertRule.findAll({
      where: { enabled: true }
    });

    // Collect matching rules for this device
    const matchingDeviceRules = activeRules.filter(rule => ruleAppliesToDevice(rule, device));

    // Aggregate all recipient emails configured for rules targeting this device
    const ruleEmailsSet = new Set();
    matchingDeviceRules.forEach(rule => {
      const emails = Array.isArray(rule.recipient_emails) ? rule.recipient_emails : [];
      emails.forEach(e => {
        const clean = String(e || '').trim();
        if (clean) ruleEmailsSet.add(clean);
      });
    });
    const deviceAlertEmails = Array.from(ruleEmailsSet);

    // 1. Device Threshold Rockfall / Human Impact Alert
    if (isRockfall || isHumanActivity) {
      const severity = isRockfall ? 'CRITICAL' : 'WARNING';
      const alertId = `alt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const message = `Impact event detected on device ${device.name || device.id}. Peak force: ${telemetry.peak_g} G, Duration: ${telemetry.duration_ms} ms.`;

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
          csq: telemetry.csq,
          source: telemetry.source
        },
        status: 'ACTIVE'
      });

      // Update Device status to ALERT
      await device.update({ status: 'ALERT' });

      // Dispatch notifications to all emails configured for this device/rules
      if (deviceAlertEmails.length > 0) {
        await dispatchNotification(alert, 'EMAIL', deviceAlertEmails, {
          device,
          ruleName: 'Automatic Rockfall Impact Threshold'
        });
      } else {
        // Fallback to admin/system notifications
        await dispatchNotification(alert, 'EMAIL', [], {
          device,
          ruleName: 'Automatic Rockfall Impact Threshold'
        });
      }

      // WebSocket broadcast alert
      broadcast({
        type: 'alert_generated',
        event: 'ALERT_TRIGGERED',
        data: alert,
        timestamp: new Date().toISOString()
      });

      generatedAlerts.push(alert);
    }

    // 2. Evaluate Specific Safety Rules
    for (const rule of matchingDeviceRules) {
      // Check event type match if rule restricts event type
      const ruleEvent = String(rule.event_type || '').toUpperCase();
      if (ruleEvent && ruleEvent !== 'ANY' && ruleEvent !== 'ALL') {
        if (!eventTypeStr.includes(ruleEvent) && !ruleEvent.includes(eventTypeStr)) {
          // If not event type match and telemetry is not an impact
          if (ruleEvent === 'ROCKFALL' && !isRockfall) continue;
        }
      }

      // Check rule conditions or min/max peak_g
      let matches = false;
      const conditionLogic = String(rule.condition_logic || rule.conditionLogic || 'ALL').toUpperCase() === 'ANY' ? 'ANY' : 'ALL';

      if (Array.isArray(rule.conditions) && rule.conditions.length > 0) {
        matches = evaluateConditions(rule.conditions, telemetry, conditionLogic);
      } else {
        const peakG = parseFloat(telemetry.peak_g || 0);
        matches = peakG >= (rule.min_peak_g || 1.50) && (!rule.max_peak_g || peakG <= rule.max_peak_g);
      }

      if (matches) {
        const condSummary = Array.isArray(rule.conditions) && rule.conditions.length > 0
          ? rule.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(conditionLogic === 'ANY' ? ' OR ' : ' AND ')
          : `Peak >= ${rule.min_peak_g || 1.50} G`;

        const ruleAlertId = `alt_rule_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const ruleAlert = await Alert.create({
          id: ruleAlertId,
          rule_id: rule.id,
          device_id: device.id,
          org_id: device.org_id,
          severity: rule.severity || 'HIGH',
          event_type: rule.event_type || telemetry.event_type || 'ROCKFALL',
          message: `Safety rule '${rule.name}' triggered on ${device.name || device.id}: [${condSummary}] (Peak: ${telemetry.peak_g || 0} G, Dur: ${telemetry.duration_ms || 0} ms).`,
          trigger_data: {
            peak_g: telemetry.peak_g,
            duration_ms: telemetry.duration_ms,
            energy_g2: telemetry.energy_g2,
            battery: telemetry.battery,
            rule_id: rule.id,
            rule_name: rule.name,
            condition_logic: conditionLogic,
            conditions: rule.conditions,
            matched_conditions: condSummary
          },
          status: 'ACTIVE'
        });

        // Dispatch notifications to the rule's specific recipient emails
        const ruleEmails = Array.isArray(rule.recipient_emails) ? rule.recipient_emails.filter(Boolean) : [];
        const actions = Array.isArray(rule.actions) ? rule.actions : ['EMAIL'];

        if (actions.includes('EMAIL')) {
          await dispatchNotification(ruleAlert, 'EMAIL', ruleEmails.length ? ruleEmails : deviceAlertEmails, {
            device,
            ruleName: rule.name
          });
        }

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

module.exports = {
  evaluateTelemetryAlerts,
  ruleAppliesToDevice,
  evaluateConditions
};
