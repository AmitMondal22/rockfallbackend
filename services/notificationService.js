const nodemailer = require('nodemailer');
const { NotificationLog } = require('../db/models');

// Configure SMTP transporter if credentials exist in environment
let transporter = null;
const initTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD
        }
      });
      console.log(`[Notification Service] SMTP Transporter configured (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})`);
    } catch (err) {
      console.warn('[Notification Service] Failed to initialize SMTP transporter:', err.message);
      transporter = null;
    }
  }
};
initTransporter();

/**
 * Format HTML email template for Rockfall Alert
 */
const generateAlertHtml = (alert, device, ruleName) => {
  const isCritical = alert.severity === 'CRITICAL' || alert.severity === 'HIGH';
  const headerColor = isCritical ? '#dc2626' : '#d97706';
  const badgeBg = isCritical ? '#fee2e2' : '#fef3c7';
  const badgeColor = isCritical ? '#991b1b' : '#92400e';
  const trig = alert.trigger_data || {};
  const peakG = trig.peak_g ?? alert.peak_g ?? '--';
  const durMs = trig.duration_ms ?? alert.duration_ms ?? '--';
  const energy = trig.energy_g2 != null ? `${Number(trig.energy_g2).toFixed(2)} g²` : '--';
  const battery = trig.battery != null ? `${trig.battery}V` : '--';
  const timeStr = new Date(alert.created_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Rockfall Incident Alert</title>
  </head>
  <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937;">
    <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;">
      
      <!-- Alert Header -->
      <div style="background-color: ${headerColor}; padding: 28px 32px; color: #ffffff;">
        <div style="display: inline-block; padding: 4px 12px; background-color: rgba(255,255,255,0.2); border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px;">
          Operational Safety Alert
        </div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; line-height: 1.3;">
          🚨 ${alert.event_type || 'ROCKFALL'} ALERT DETECTED
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">
          ${alert.message}
        </p>
      </div>

      <!-- Content Body -->
      <div style="padding: 32px;">
        <!-- Status Badges -->
        <div style="display: flex; gap: 8px; margin-bottom: 24px;">
          <span style="display: inline-block; padding: 6px 14px; background-color: ${badgeBg}; color: ${badgeColor}; border-radius: 8px; font-size: 12px; font-weight: 700;">
            Severity: ${alert.severity}
          </span>
          <span style="display: inline-block; padding: 6px 14px; background-color: #e0e7ff; color: #3730a3; border-radius: 8px; font-size: 12px; font-weight: 700; margin-left: 8px;">
            Status: ${alert.status || 'ACTIVE'}
          </span>
        </div>

        <!-- Telemetry Details Table -->
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 0 0 12px 0;">
          Incident Telemetry Summary
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
          <tbody>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; color: #6b7280;">Sensor / Device ID</td>
              <td style="padding: 10px 0; font-weight: 700; text-align: right; color: #111827;">${device?.name ? `${device.name} (${device.id})` : alert.device_id}</td>
            </tr>
            ${ruleName ? `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; color: #6b7280;">Triggered Safety Rule</td>
              <td style="padding: 10px 0; font-weight: 700; text-align: right; color: #4f46e5;">${ruleName}</td>
            </tr>` : ''}
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; color: #6b7280;">Peak Force (G)</td>
              <td style="padding: 10px 0; font-weight: 700; text-align: right; color: ${headerColor}; font-size: 16px;">${peakG} G</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; color: #6b7280;">Impact Duration</td>
              <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #111827;">${durMs} ms</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; color: #6b7280;">Signal Energy</td>
              <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #111827;">${energy}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; color: #6b7280;">Battery Level</td>
              <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #111827;">${battery}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280;">Recorded Timestamp</td>
              <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #111827;">${timeStr}</td>
            </tr>
          </tbody>
        </table>

        <!-- Safety Notice Box -->
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-size: 13px; color: #991b1b; line-height: 1.5;">
          <strong>Action Required:</strong> Immediate geotechnical inspection of the Asset and catchment zone is recommended. Verify fence mesh tension and anchor integrity.
        </div>

        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 20px;">
          Automated safety notification generated by Rockfall IoT Impact Monitoring Platform.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;
};

/**
 * Dispatch notification to single or multiple recipients
 * @param {Object} alert Alert object
 * @param {string} channel 'EMAIL' | 'SMS' | 'WHATSAPP'
 * @param {string|string[]} recipients Email address, comma-separated string, or array of emails
 * @param {Object} extra Additional context { device, ruleName }
 */
const dispatchNotification = async (alert, channel = 'EMAIL', recipients = [], extra = {}) => {
  try {
    // Normalize recipients to a clean array of strings
    let emailList = [];
    if (Array.isArray(recipients)) {
      emailList = recipients.map(r => String(r || '').trim()).filter(Boolean);
    } else if (typeof recipients === 'string') {
      emailList = recipients.split(/[,;\s]+/).map(r => r.trim()).filter(Boolean);
    }

    if (!emailList.length) {
      const defaultEmail = process.env.INITIAL_ADMIN_EMAIL || process.env.ALERT_DEFAULT_EMAIL;
      if (defaultEmail) emailList.push(defaultEmail);
    }

    // If still no recipients, default to logging
    if (!emailList.length) {
      console.log(`[Notification Service] No recipients specified for alert ${alert.id}.`);
      return [];
    }

    const { device, ruleName } = extra;
    const subject = `🚨 [${alert.severity || 'CRITICAL'} ALERT] ${alert.event_type || 'Rockfall'} on Device ${device?.name || alert.device_id}`;
    const plainText = `[ROCKFALL ALERT] ${alert.severity}: ${alert.message}\nDevice: ${device?.name || alert.device_id}\nPeak Force: ${alert.trigger_data?.peak_g ?? '--'} G\nTimestamp: ${new Date().toISOString()}`;
    const htmlBody = generateAlertHtml(alert, device, ruleName);
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || '"Rockfall Safety System" <alerts@rockfall.com>';

    const logs = [];

    for (const recipient of emailList) {
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      let status = 'SENT';

      console.log(`[Notification Service] Dispatching ${channel} to ${recipient}: ${subject}`);

      if (channel === 'EMAIL' && transporter) {
        try {
          await transporter.sendMail({
            from: fromAddress,
            to: recipient,
            subject,
            text: plainText,
            html: htmlBody
          });
          status = 'SENT';
          console.log(`[Notification Service] Email successfully sent to ${recipient}`);
        } catch (mailErr) {
          console.error(`[Notification Service] Error sending email to ${recipient}:`, mailErr.message);
          status = 'FAILED';
        }
      } else {
        // Simulated or logged delivery (e.g. SMTP not configured in dev)
        status = 'SENT';
      }

      const log = await NotificationLog.create({
        id: notificationId,
        alert_id: alert.id,
        channel,
        recipient,
        status,
        message: `${subject} - ${alert.message}`
      });
      logs.push(log);
    }

    return logs;
  } catch (error) {
    console.error('[Notification Service Error]:', error.message);
    return [];
  }
};

module.exports = {
  dispatchNotification,
  generateAlertHtml
};
