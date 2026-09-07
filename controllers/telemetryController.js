const { Telemetry, Device } = require('../db/models');
const { evaluateTelemetryAlerts } = require('../services/alertEngine');
const { broadcast } = require('../websocket/wsServer');
const { Op } = require('sequelize');

const handleHttpGetTelemetry = async (req, res, next) => {
  try {
    const { uid, bv, csq, peak_g, dur_ms, peaks, energy_g2, mean_g, type } = req.query;

    if (!uid) {
      return res.status(400).json({ status: 'ERROR', message: 'Missing device uid parameter' });
    }

    // Find or auto-register device
    let device = await Device.findByPk(uid);
    if (!device) {
      device = await Device.create({
        id: uid,
        name: `HTTP Device ${uid}`,
        communication_type: 'HTTP',
        status: 'ONLINE'
      });
    } else {
      device.status = 'ONLINE';
      await device.save();
    }

    const parsedBattery = parseFloat(bv || 100);
    const parsedCsq = parseInt(csq || 20);
    const parsedPeakG = parseFloat(peak_g || 0);
    const parsedDurMs = parseInt(dur_ms || 0);
    const parsedPeaks = parseInt(peaks || 0);
    const parsedEnergyG2 = parseFloat(energy_g2 || 0);
    const parsedMeanG = parseFloat(mean_g || 0);
    const eventType = type || (parsedPeakG >= 1.5 ? 'ROCKFALL' : 'MOTION');

    // Save telemetry to PostgreSQL database
    const telemetry = await Telemetry.create({
      device_id: device.id,
      uid: device.id,
      battery: parsedBattery,
      csq: parsedCsq,
      event_type: eventType,
      peak_g: parsedPeakG,
      duration_ms: parsedDurMs,
      peaks: parsedPeaks,
      energy_g2: parsedEnergyG2,
      mean_g: parsedMeanG,
      raw_payload: req.query,
      source: 'HTTP',
      timestamp: new Date()
    });

    // Update Device record in database
    device.last_seen = telemetry.timestamp;
    if (!isNaN(parsedBattery)) device.battery = parsedBattery;
    if (!isNaN(parsedCsq)) device.csq = parsedCsq;
    device.last_event = {
      type: eventType,
      peak_g: parsedPeakG,
      duration_ms: parsedDurMs,
      timestamp: telemetry.timestamp
    };
    device.status = 'ONLINE';
    await device.save();

    // Real-time WebSocket Push
    broadcast({
      type: 'device_update',
      event: 'TELEMETRY_RECEIVED',
      source: 'HTTP',
      deviceId: device.id,
      data: telemetry,
      timestamp: new Date().toISOString()
    });

    // Evaluate Alert Engine
    await evaluateTelemetryAlerts(telemetry, device);

    // 2-Way Hardware Response: Send threshold configuration JSON back to device
    return res.json({
      status: 'OK',
      uid: device.id,
      thresholdVersion: device.threshold_version || 1,
      MOTION_G: device.motion_g,
      PEAK_G: device.peak_g,
      ROCK_PEAK_G: device.rock_peak_g,
      ROCK_DUR_MS: device.rock_dur_ms,
      HUMAN_PEAK_MAX_G: device.human_peak_max_g,
      HUMAN_DUR_MS: device.human_dur_ms,
      HUMAN_PEAKS: device.human_peaks
    });
  } catch (error) {
    next(error);
  }
};

const getTelemetryHistory = async (req, res, next) => {
  try {
    const { device_id, source, event_type, startDate, endDate, page = 1, limit = 50 } = req.query;

    const whereClause = {};
    if (device_id) whereClause.device_id = device_id;
    if (source) whereClause.source = source;
    if (event_type) whereClause.event_type = event_type;

    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) whereClause.timestamp[Op.gte] = new Date(startDate);
      if (endDate) whereClause.timestamp[Op.lte] = new Date(endDate);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: telemetries } = await Telemetry.findAndCountAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset,
      include: [{ model: Device, as: 'device', attributes: ['id', 'name', 'location'] }]
    });

    return res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
      telemetries
    });
  } catch (error) {
    next(error);
  }
};

const getLatestDeviceTelemetry = async (req, res, next) => {
  try {
    const { deviceId } = req.params;

    const telemetry = await Telemetry.findOne({
      where: { device_id: deviceId },
      order: [['timestamp', 'DESC']]
    });

    if (!telemetry) {
      return res.status(404).json({ success: false, message: 'No telemetry found for this device.' });
    }

    return res.json({ success: true, telemetry });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleHttpGetTelemetry,
  getTelemetryHistory,
  getLatestDeviceTelemetry
};
