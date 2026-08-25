const { Telemetry, Device } = require('../db/models');
const { evaluateTelemetryAlerts } = require('../services/alertEngine');
const { broadcast } = require('../websocket/wsServer');

const handleLoRaWANWebhook = async (req, res, next) => {
  try {
    const body = req.body || {};

    // Extract DevEUI / device_id from various LoRaWAN formats (ChirpStack v3/v4, TTN v3, Milesight, etc.)
    const devEUI = body.devEUI || body.dev_eui || body.deviceId || body.device_id || 
                   (body.deviceInfo && body.deviceInfo.devEui) || 
                   (body.end_device_ids && body.end_device_ids.dev_eui);

    if (!devEUI) {
      return res.status(400).json({ success: false, message: 'Missing devEUI or deviceId in LoRaWAN webhook payload' });
    }

    // Extract payload object or decoded parameters
    const decodedPayload = body.object || body.payload || body.objectJSON || body.uplink_message?.decoded_payload || {};
    
    // Parse sensor metrics
    const peak_g = parseFloat(decodedPayload.peak_g || decodedPayload.peakG || decodedPayload.peak || 0);
    const duration_ms = parseInt(decodedPayload.dur_ms || decodedPayload.durationMs || decodedPayload.duration || 0);
    const battery = parseFloat(decodedPayload.battery || decodedPayload.bv || (body.batteryLevel ? body.batteryLevel : 100));
    const csq = parseInt(decodedPayload.csq || (body.rxInfo && body.rxInfo[0] ? body.rxInfo[0].rssi : 20));
    const peaks = parseInt(decodedPayload.peaks || 0);
    const energy_g2 = parseFloat(decodedPayload.energy_g2 || decodedPayload.energy || 0);
    const mean_g = parseFloat(decodedPayload.mean_g || 0);
    const event_type = decodedPayload.event_type || decodedPayload.type || (peak_g >= 1.5 ? 'ROCKFALL' : 'MOTION');

    // Find or create device record in PostgreSQL
    let device = await Device.findOne({
      where: { dev_eui: devEUI }
    });

    if (!device) {
      device = await Device.findByPk(devEUI);
    }

    if (!device) {
      device = await Device.create({
        id: devEUI,
        name: `LoRaWAN Device ${devEUI}`,
        dev_eui: devEUI,
        communication_type: 'LORAWAN',
        status: 'ONLINE'
      });
    } else {
      device.status = 'ONLINE';
      await device.save();
    }

    // Save Telemetry into PostgreSQL
    const telemetry = await Telemetry.create({
      device_id: device.id,
      uid: device.id,
      battery,
      csq,
      event_type,
      peak_g,
      duration_ms,
      peaks,
      energy_g2,
      mean_g,
      raw_payload: body,
      source: 'LORAWAN',
      timestamp: new Date()
    });

    // Real-time WebSocket Broadcast
    broadcast({
      type: 'device_update',
      event: 'TELEMETRY_RECEIVED',
      source: 'LORAWAN',
      deviceId: device.id,
      data: telemetry,
      timestamp: new Date().toISOString()
    });

    // Evaluate Alert Engine
    await evaluateTelemetryAlerts(telemetry, device);

    // 2-Way Downlink Webhook Response (Returning Downlink Command Payload for LNS Network Server)
    return res.status(200).json({
      status: 'OK',
      message: 'LoRaWAN Telemetry processed successfully',
      devEUI: device.dev_eui || device.id,
      downlinkPayload: {
        confirmed: false,
        fPort: 2,
        data: Buffer.from(JSON.stringify({
          th_v: device.threshold_version || 1,
          peak_g: device.rock_peak_g,
          dur_ms: device.rock_dur_ms
        })).toString('base64'),
        thresholdConfig: {
          MOTION_G: device.motion_g,
          PEAK_G: device.peak_g,
          ROCK_PEAK_G: device.rock_peak_g,
          ROCK_DUR_MS: device.rock_dur_ms,
          HUMAN_PEAK_MAX_G: device.human_peak_max_g,
          HUMAN_DUR_MS: device.human_dur_ms,
          HUMAN_PEAKS: device.human_peaks
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { handleLoRaWANWebhook };
