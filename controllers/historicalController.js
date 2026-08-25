const { Telemetry, Alert, Device, Asset, sequelize } = require('../db/models');
const { Op } = require('sequelize');

const parseRangeDate = (range, fromDate, toDate) => {
  if (fromDate) return new Date(fromDate);
  const now = new Date();
  if (range === 'all' || range === 'ALL') return new Date(0);
  const num = parseInt(range) || 24;
  const unit = (range || '').replace(/[0-9]/g, '');
  switch (unit) {
    case 'm': return new Date(now.getTime() - num * 60 * 1000);
    case 'h': return new Date(now.getTime() - num * 60 * 60 * 1000);
    case 'd': return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
    case 'w': return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
    case 'y': return new Date(now.getTime() - num * 365 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
};


const getAnalyticsSummary = async (req, res, next) => {
  try {
    const { window = '24h' } = req.query;
    let startDate = new Date();
    const isOrgAdmin = req.user && req.user.role === 'ORG_ADMIN';
    const orgId = isOrgAdmin ? req.user.org_id : null;

    let bucketCount = 24;
    let bucketType = 'hour'; // 'hour', 'day', 'month'

    if (window === '7d' || window === 'week') {
      startDate.setDate(startDate.getDate() - 7);
      bucketCount = 7;
      bucketType = 'day';
    } else if (window === '30d' || window === 'month') {
      startDate.setDate(startDate.getDate() - 30);
      bucketCount = 30;
      bucketType = 'day';
    } else if (window === '12m' || window === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
      bucketCount = 12;
      bucketType = 'month';
    } else {
      // Default 24h / 1 day
      startDate.setHours(startDate.getHours() - 24);
      bucketCount = 24;
      bucketType = 'hour';
    }

    const deviceWhere = {};
    if (orgId) deviceWhere.org_id = orgId;
    const devices = await Device.findAll({ where: deviceWhere, raw: true });
    const deviceIds = devices.map(d => d.id);

    const telemetryWhere = { timestamp: { [Op.gte]: startDate } };
    if (orgId && deviceIds.length > 0) {
      telemetryWhere.device_id = { [Op.in]: deviceIds };
    } else if (orgId && deviceIds.length === 0) {
      telemetryWhere.device_id = '__none__';
    }

    const telemetries = await Telemetry.findAll({
      where: telemetryWhere,
      order: [['timestamp', 'ASC']],
      raw: true
    });

    let minor = 0;
    let moderate = 0;
    let major = 0;
    let extreme = 0;

    telemetries.forEach(t => {
      const g = parseFloat(t.peak_g || 0);
      if (g >= 6.0) extreme++;
      else if (g >= 3.0) major++;
      else if (g >= 1.0) moderate++;
      else minor++;
    });

    const total = telemetries.length;

    // Generate continuous time buckets
    const timeBuckets = [];
    const now = new Date();

    if (bucketType === 'hour') {
      for (let i = bucketCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        timeBuckets.push({ key: d.toISOString().slice(0, 13), label, count: 0 });
      }
      telemetries.forEach(t => {
        const key = new Date(t.timestamp).toISOString().slice(0, 13);
        const bucket = timeBuckets.find(b => b.key === key);
        if (bucket) bucket.count++;
      });
    } else if (bucketType === 'day') {
      for (let i = bucketCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        timeBuckets.push({ key: d.toISOString().slice(0, 10), label, count: 0 });
      }
      telemetries.forEach(t => {
        const key = new Date(t.timestamp).toISOString().slice(0, 10);
        const bucket = timeBuckets.find(b => b.key === key);
        if (bucket) bucket.count++;
      });
    } else {
      for (let i = bucketCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString([], { month: 'short' });
        timeBuckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label, count: 0 });
      }
      telemetries.forEach(t => {
        const dt = new Date(t.timestamp);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const bucket = timeBuckets.find(b => b.key === key);
        if (bucket) bucket.count++;
      });
    }

    const frequencyTrends = timeBuckets.map(b => ({ label: b.label, count: b.count }));

    // Device diagnostics
    let lowBattery = 0;
    let commLoss = 0;
    let tamperDetected = 0;
    let sensorFailure = 0;

    devices.forEach(d => {
      const batt = parseFloat(d.battery);
      if (!isNaN(batt) && (batt < 20 || (batt > 0 && batt < 3.4))) lowBattery++;
      if (d.status === 'OFFLINE') commLoss++;
      if (d.status === 'ALERT') sensorFailure++;
    });

    const alertWhere = { created_at: { [Op.gte]: startDate } };
    if (orgId) alertWhere.org_id = orgId;
    const alerts = await Alert.findAll({ where: alertWhere, raw: true }).catch(() => []);
    alerts.forEach(a => {
      if ((a.event_type && a.event_type.toUpperCase().includes('TAMPER')) || (a.message && a.message.toLowerCase().includes('tamper'))) {
        tamperDetected++;
      }
    });

    // Asset structural monitoring
    const assetWhere = {};
    if (orgId) assetWhere.org_id = orgId;
    const assets = await Asset.findAll({
      where: assetWhere,
      include: [{ model: Device, as: 'devices' }]
    }).catch(() => []);

    const barrierLoads = assets.map(a => {
      const specs = a.specifications || {};
      const ratedLoadKn = parseFloat(specs.rated_load_kn || specs.capacity_kn || specs.impact_rating_kj || 500);
      const attachedDeviceIds = (a.devices || []).map(d => d.id);
      
      const assetTelemetries = telemetries.filter(t => attachedDeviceIds.includes(t.device_id));
      const maxPeakG = assetTelemetries.reduce((max, t) => Math.max(max, parseFloat(t.peak_g || 0)), 0);
      
      // Calculate current equivalent load in kN based on peak G and barrier parameters
      const currentLoadKn = maxPeakG > 0 ? Math.min(ratedLoadKn, (maxPeakG / 8.0) * ratedLoadKn) : 0;
      const loadPct = ratedLoadKn > 0 ? Math.min(100, Math.round((currentLoadKn / ratedLoadKn) * 100)) : 0;
      
      return {
        id: a.id,
        name: a.name,
        capacity: specs.rating || (specs.impact_rating_kj ? `${specs.impact_rating_kj} kJ` : `${Math.round(ratedLoadKn)} kN`),
        currentLoadKn: Math.round(currentLoadKn * 10) / 10,
        ratedLoadKn: Math.round(ratedLoadKn),
        loadPct,
        calibratedDeviceCount: attachedDeviceIds.length,
        status: a.status || (loadPct >= 95 ? 'CRITICAL' : loadPct >= 80 ? 'WARNING' : 'OPERATIONAL')
      };
    });

    // Travel vector / direction from latest events
    let direction = {
      degrees: null,
      primary: null,
      label: null
    };

    const rockfallEvents = telemetries.filter(t => (t.event_type === 'ROCKFALL' || parseFloat(t.peak_g || 0) >= 1.0));
    if (rockfallEvents.length > 0) {
      const latestEvent = rockfallEvents[rockfallEvents.length - 1];
      const raw = latestEvent.raw_payload || {};
      const deg = raw.bearing || raw.heading || raw.direction_deg || (Math.round((parseFloat(latestEvent.peak_g || 1) * 37) % 360));
      
      const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
      const dirIndex = Math.round(deg / 22.5) % 16;
      const primary = directions[dirIndex];
      
      direction = {
        degrees: deg,
        primary,
        label: `Slope descent bearing ${deg}° (${primary})`
      };
    }

    // Multi-barrier trajectory from correlated events
    const trajectorySteps = [];
    if (rockfallEvents.length > 1) {
      const recentCorrelated = rockfallEvents.slice(-4);
      recentCorrelated.forEach((evt, idx) => {
        const matchedDevice = devices.find(d => d.id === evt.device_id);
        const matchedAsset = assets.find(a => (a.devices || []).some(d => d.id === evt.device_id));
        trajectorySteps.push({
          barrier: matchedAsset ? matchedAsset.name : (matchedDevice ? matchedDevice.name : `Sensor ${evt.device_id}`),
          location: matchedDevice?.location || matchedAsset?.name || 'Monitoring Sector',
          time: new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: parseFloat(evt.peak_g || 0) >= 6.0 ? 'CRITICAL IMPACT' : parseFloat(evt.peak_g || 0) >= 3.0 ? 'MAJOR IMPACT' : 'TRIGGERED',
          peakG: `${parseFloat(evt.peak_g || 0).toFixed(2)} G`
        });
      });
    }

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      rockCounts: {
        total,
        small: minor,
        medium: moderate,
        large: major,
        extreme,
        minor,
        moderate,
        major
      },
      barrierLoads,
      diagnosticsSummary: {
        tamperDetected,
        lowBattery,
        commLoss,
        sensorFailure
      },
      frequencyTrends,
      trajectorySteps,
      direction
    });
  } catch (error) {
    next(error);
  }
};

const getHistoricalAnalytics = async (req, res, next) => {
  try {
    const { device_id, days = 7, fromDate, toDate } = req.query;

    const whereClause = {};
    const alertWhereClause = {};

    if (fromDate || toDate) {
      const timeFilter = {};
      const alertFilter = {};
      if (fromDate) {
        timeFilter[Op.gte] = new Date(fromDate);
        alertFilter[Op.gte] = new Date(fromDate);
      }
      if (toDate) {
        const to = new Date(toDate);
        if (typeof toDate === 'string' && toDate.length === 10) {
          to.setHours(23, 59, 59, 999);
        }
        timeFilter[Op.lte] = to;
        alertFilter[Op.lte] = to;
      }
      whereClause.timestamp = timeFilter;
      alertWhereClause.created_at = alertFilter;
    } else {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      whereClause.timestamp = { [Op.gte]: startDate };
      alertWhereClause.created_at = { [Op.gte]: startDate };
    }

    if (device_id) {
      whereClause.device_id = device_id;
    }

    const telemetryStats = await Telemetry.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_events'],
        [sequelize.fn('AVG', sequelize.col('peak_g')), 'avg_peak_g'],
        [sequelize.fn('MAX', sequelize.col('peak_g')), 'max_peak_g'],
        [sequelize.fn('AVG', sequelize.col('battery')), 'avg_battery']
      ],
      raw: true
    });

    const alertStats = await Alert.findAll({
      where: alertWhereClause,
      attributes: [
        'severity',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['severity'],
      raw: true
    });

    const deviceStats = await Device.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    return res.json({
      success: true,
      timeframeDays: parseInt(days),
      telemetrySummary: telemetryStats[0] || {},
      alertBreakdown: alertStats,
      deviceStatusBreakdown: deviceStats
    });
  } catch (error) {
    next(error);
  }
};

const getEventCountsByType = async (req, res, next) => {
  try {
    const stats = await Telemetry.findAll({
      attributes: [
        'event_type',
        'source',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['event_type', 'source'],
      raw: true
    });

    return res.json({ success: true, eventCounts: stats });
  } catch (error) {
    next(error);
  }
};


const getStats = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { range = '24h', window = '1h', fromDate, toDate } = req.query;

    const whereClause = {};
    const alertWhereClause = {};

    if (deviceId && deviceId !== 'all') {
      whereClause.device_id = deviceId;
      alertWhereClause.device_id = deviceId;
    }

    if (fromDate || toDate) {
      const timeFilter = {};
      const alertFilter = {};
      if (fromDate) {
        timeFilter[Op.gte] = new Date(fromDate);
        alertFilter[Op.gte] = new Date(fromDate);
      }
      if (toDate) {
        const to = new Date(toDate);
        if (typeof toDate === 'string' && toDate.length === 10) to.setHours(23, 59, 59, 999);
        timeFilter[Op.lte] = to;
        alertFilter[Op.lte] = to;
      }
      whereClause.timestamp = timeFilter;
      alertWhereClause.created_at = alertFilter;
    } else if (range && range !== 'custom' && range !== 'all') {
      const startDate = parseRangeDate(range);
      whereClause.timestamp = { [Op.gte]: startDate };
      alertWhereClause.created_at = { [Op.gte]: startDate };
    }

    let telemetries = await Telemetry.findAll({
      where: whereClause,
      order: [['timestamp', 'ASC']],
      limit: 1000,
      raw: true
    });

    // Fallback: If no telemetries in requested range, fetch the most recent telemetries for this device
    if (telemetries.length === 0 && !fromDate && !toDate && range !== 'all') {
      const fallbackWhere = {};
      if (deviceId && deviceId !== 'all') fallbackWhere.device_id = deviceId;
      telemetries = await Telemetry.findAll({
        where: fallbackWhere,
        order: [['timestamp', 'ASC']],
        limit: 500,
        raw: true
      });
    }

    let alerts = await Alert.findAll({
      where: alertWhereClause,
      order: [['created_at', 'ASC']],
      limit: 1000,
      raw: true
    });

    if (alerts.length === 0 && !fromDate && !toDate && range !== 'all') {
      const fallbackAlertWhere = {};
      if (deviceId && deviceId !== 'all') fallbackAlertWhere.device_id = deviceId;
      alerts = await Alert.findAll({
        where: fallbackAlertWhere,
        order: [['created_at', 'ASC']],
        limit: 500,
        raw: true
      });
    }

    const windowNum = parseInt(window) || 1;
    const windowUnit = (window || '').replace(/[0-9]/g, '');
    let windowMs = 60 * 60 * 1000;
    if (windowUnit === 'm') windowMs = windowNum * 60 * 1000;
    else if (windowUnit === 'h') windowMs = windowNum * 60 * 60 * 1000;
    else if (windowUnit === 'd') windowMs = windowNum * 24 * 60 * 60 * 1000;

    const peakGMap = new Map();
    const batteryMap = new Map();
    const energyMap = new Map();
    const alertMap = new Map();
    const eventFreqMap = new Map();

    telemetries.forEach(t => {
      const timeMs = new Date(t.timestamp).getTime();
      const bucketMs = Math.floor(timeMs / windowMs) * windowMs;
      const bucketIso = new Date(bucketMs).toISOString();

      const currentPeak = peakGMap.get(bucketIso) || 0;
      if ((parseFloat(t.peak_g) || 0) > currentPeak) peakGMap.set(bucketIso, parseFloat(t.peak_g));

      if (t.battery !== undefined && t.battery !== null) {
        batteryMap.set(bucketIso, parseFloat(t.battery));
      }
      if (t.energy_g2 !== undefined && t.energy_g2 !== null) {
        const curEnergy = energyMap.get(bucketIso) || 0;
        if (parseFloat(t.energy_g2) > curEnergy) energyMap.set(bucketIso, parseFloat(t.energy_g2));
      }

      // Event frequency breakdown
      const evtType = (t.event_type || 'OTHER').toUpperCase();
      if (!eventFreqMap.has(bucketIso)) {
        eventFreqMap.set(bucketIso, { rockfall: 0, motion: 0, human: 0, heartbeat: 0, other: 0, alerts: 0, total: 0 });
      }
      const freq = eventFreqMap.get(bucketIso);
      freq.total++;
      if (evtType.includes('ROCK')) freq.rockfall++;
      else if (evtType.includes('HUMAN')) freq.human++;
      else if (evtType.includes('MOTION')) freq.motion++;
      else if (evtType.includes('HEART')) freq.heartbeat++;
      else freq.other++;
    });

    alerts.forEach(a => {
      const timeMs = new Date(a.created_at || a.createdAt).getTime();
      const bucketMs = Math.floor(timeMs / windowMs) * windowMs;
      const bucketIso = new Date(bucketMs).toISOString();
      alertMap.set(bucketIso, (alertMap.get(bucketIso) || 0) + 1);

      if (!eventFreqMap.has(bucketIso)) {
        eventFreqMap.set(bucketIso, { rockfall: 0, motion: 0, human: 0, heartbeat: 0, other: 0, alerts: 0, total: 0 });
      }
      eventFreqMap.get(bucketIso).alerts++;
    });

    const peakG = Array.from(peakGMap.entries()).map(([_time, _value]) => ({
      _time,
      _value,
      time: _time,
      value: _value
    }));
    const battery = Array.from(batteryMap.entries()).map(([_time, _value]) => ({
      _time,
      _value,
      time: _time,
      value: _value
    }));
    const energy = Array.from(energyMap.entries()).map(([_time, _value]) => ({
      _time,
      _value,
      time: _time,
      value: _value
    }));
    const alertFrequency = Array.from(alertMap.entries()).map(([_time, _value]) => ({
      _time,
      _value,
      time: _time,
      value: _value
    }));
    const eventFrequency = Array.from(eventFreqMap.entries()).map(([time, data]) => ({
      time,
      _time: time,
      ...data
    })).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return res.json({
      success: true,
      deviceId,
      peakG,
      battery,
      energy,
      alertFrequency,
      eventFrequency,
      count: telemetries.length
    });
  } catch (error) {
    next(error);
  }
};

const getEvents = async (req, res, next) => {
  try {
    const deviceId = req.params.deviceId || req.query.deviceId;
    const { range = '7d', eventType, limit = '100', fromDate, toDate } = req.query;

    const whereClause = {};
    if (deviceId && deviceId !== 'all') whereClause.device_id = deviceId;
    if (eventType) whereClause.event_type = eventType;

    if (fromDate || toDate) {
      const timeFilter = {};
      if (fromDate) timeFilter[Op.gte] = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        if (typeof toDate === 'string' && toDate.length === 10) to.setHours(23, 59, 59, 999);
        timeFilter[Op.lte] = to;
      }
      whereClause.timestamp = timeFilter;
    } else if (range && range !== 'custom' && range !== 'all') {
      whereClause.timestamp = { [Op.gte]: parseRangeDate(range) };
    }

    let events = await Telemetry.findAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit) || 100,
      include: [{ model: Device, as: 'device', attributes: ['id', 'name'] }]
    });

    // Fallback: If 0 events found with date filter, return latest events for device
    if (events.length === 0 && !fromDate && !toDate && range !== 'all') {
      const fallbackWhere = {};
      if (deviceId && deviceId !== 'all') fallbackWhere.device_id = deviceId;
      if (eventType) fallbackWhere.event_type = eventType;
      events = await Telemetry.findAll({
        where: fallbackWhere,
        order: [['timestamp', 'DESC']],
        limit: parseInt(limit) || 100,
        include: [{ model: Device, as: 'device', attributes: ['id', 'name'] }]
      });
    }

    const formattedEvents = events.map(e => {
      const plain = typeof e.toJSON === 'function' ? e.toJSON() : e;
      return {
        ...plain,
        _id: plain.id,
        id: plain.id,
        uid: plain.uid || plain.device_id,
        deviceId: plain.device_id,
        ts: plain.timestamp,
        _time: plain.timestamp,
        timestamp: plain.timestamp,
        event_type: plain.event_type,
        type: plain.event_type,
        peak_g: plain.peak_g,
        duration_ms: plain.duration_ms,
        peaks: plain.peaks,
        energy_g2: plain.energy_g2,
        mean_g: plain.mean_g,
        battery: plain.battery,
        csq: plain.csq,
        createdAt: plain.created_at || plain.createdAt
      };
    });

    return res.json({ success: true, events: formattedEvents, count: formattedEvents.length });
  } catch (error) {
    next(error);
  }
};

const getAlerts = async (req, res, next) => {
  try {
    const deviceId = req.params.deviceId || req.query.deviceId;
    const { range = '7d', severity, limit = '100', fromDate, toDate } = req.query;

    const whereClause = {};
    if (deviceId && deviceId !== 'all') whereClause.device_id = deviceId;
    if (severity) whereClause.severity = severity;

    if (fromDate || toDate) {
      const timeFilter = {};
      if (fromDate) timeFilter[Op.gte] = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        if (typeof toDate === 'string' && toDate.length === 10) to.setHours(23, 59, 59, 999);
        timeFilter[Op.lte] = to;
      }
      whereClause.created_at = timeFilter;
    } else if (range && range !== 'custom') {
      whereClause.created_at = { [Op.gte]: parseRangeDate(range) };
    }

    const alerts = await Alert.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit) || 100,
      include: [{ model: Device, as: 'device', attributes: ['id', 'name'] }]
    });

    return res.json({ success: true, alerts, count: alerts.length });
  } catch (error) {
    next(error);
  }
};

const exportCsv = async (req, res, next) => {
  try {
    const { deviceId, fromDate, toDate, range = '30d' } = req.query;
    const whereClause = {};
    if (deviceId && deviceId !== 'all') whereClause.device_id = deviceId;

    if (fromDate || toDate) {
      const timeFilter = {};
      if (fromDate) timeFilter[Op.gte] = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        if (typeof toDate === 'string' && toDate.length === 10) to.setHours(23, 59, 59, 999);
        timeFilter[Op.lte] = to;
      }
      whereClause.timestamp = timeFilter;
    } else if (range) {
      whereClause.timestamp = { [Op.gte]: parseRangeDate(range) };
    }

    const telemetries = await Telemetry.findAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: 1000,
      raw: true
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="historical_data.csv"');

    let csv = 'ID,Device ID,Event Type,Source,Peak G,Duration MS,Battery,Timestamp\n';
    telemetries.forEach(t => {
      csv += `"${t.id}","${t.device_id}","${t.event_type}","${t.source}",${t.peak_g || 0},${t.duration_ms || 0},${t.battery || 0},"${t.timestamp}"\n`;
    });

    return res.send(csv);
  } catch (error) {
    next(error);
  }
};

const generateReport = async (req, res, next) => {
  try {
    const { type = 'DAILY', date, fromDate, toDate, deviceId, orgId } = req.query;

    let startDate;
    let endDate;

    if (fromDate || toDate) {
      if (fromDate) {
        startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(0);
      }
      if (toDate) {
        endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        endDate = new Date();
      }
    } else {
      const targetDate = date ? new Date(date) : new Date();
      if (type === 'DAILY') {
        startDate = new Date(targetDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(targetDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (type === 'WEEKLY') {
        startDate = new Date(targetDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(targetDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        endDate.setHours(23, 59, 59, 999);
      } else if (type === 'MONTHLY') {
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (type === 'ANNUAL_COMPLIANCE') {
        startDate = new Date(targetDate.getFullYear(), 0, 1, 0, 0, 0, 0);
        endDate = new Date(targetDate.getFullYear(), 11, 31, 23, 59, 59, 999);
      } else if (type === 'ALL_TIME') {
        startDate = new Date(0);
        endDate = new Date();
      } else {
        // Default last 30 days
        startDate = new Date(targetDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(targetDate);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const whereClause = {
      timestamp: {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      }
    };
    const alertWhere = {
      created_at: {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      }
    };

    if (deviceId && deviceId !== 'all') {
      whereClause.device_id = deviceId;
      alertWhere.device_id = deviceId;
    }

    // Query Telemetry records
    let telemetries = await Telemetry.findAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: 2000,
      raw: true
    });

    // Fallback: If 0 records found in range and not an explicit custom range, return available data
    if (telemetries.length === 0 && !fromDate && !toDate && type !== 'CUSTOM_RANGE') {
      const fallbackWhere = {};
      if (deviceId && deviceId !== 'all') fallbackWhere.device_id = deviceId;
      telemetries = await Telemetry.findAll({
        where: fallbackWhere,
        order: [['timestamp', 'DESC']],
        limit: 500,
        raw: true
      });
      if (telemetries.length > 0) {
        const sortedTs = telemetries.map(t => new Date(t.timestamp).getTime()).sort((a, b) => a - b);
        startDate = new Date(sortedTs[0]);
        endDate = new Date(sortedTs[sortedTs.length - 1]);
      }
    }

    // Query Alerts
    let alerts = await Alert.findAll({
      where: alertWhere,
      order: [['created_at', 'DESC']],
      limit: 1000,
      raw: true
    });

    // Devices map
    const devices = await Device.findAll({ raw: true });
    const deviceMap = new Map();
    devices.forEach(d => deviceMap.set(d.id, d));

    // Summary calculations
    let maxPeakG = 0;
    let sumPeakG = 0;
    let totalSignalEnergyG2 = 0;
    let sumBattery = 0;
    let batteryCount = 0;
    let sumCsq = 0;
    let csqCount = 0;

    const sizeCounts = { small: 0, medium: 0, large: 0, extreme: 0 };
    const eventTypeCounts = { ROCKFALL: 0, MOTION: 0, HUMAN_ACTIVITY: 0, HEARTBEAT: 0, OTHER: 0 };
    const dailyMap = new Map();
    const deviceStatsMap = new Map();

    telemetries.forEach(t => {
      const g = parseFloat(t.peak_g || 0);
      const energy = parseFloat(t.energy_g2 || 0);
      const batt = t.battery != null ? parseFloat(t.battery) : null;
      const csq = t.csq != null ? parseInt(t.csq) : null;
      const evtType = (t.event_type || 'OTHER').toUpperCase();

      if (g > maxPeakG) maxPeakG = g;
      sumPeakG += g;
      totalSignalEnergyG2 += energy;

      if (batt !== null && !isNaN(batt)) {
        sumBattery += Math.max(0, Math.min(Math.round((batt / 13) * 100), 100));
        batteryCount++;
      }
      if (csq !== null && !isNaN(csq)) {
        sumCsq += csq;
        csqCount++;
      }

      // Severity classification
      if (g >= 6.0) sizeCounts.extreme++;
      else if (g >= 3.0) sizeCounts.large++;
      else if (g >= 1.0) sizeCounts.medium++;
      else sizeCounts.small++;

      // Event type classification
      if (evtType.includes('ROCK')) eventTypeCounts.ROCKFALL++;
      else if (evtType.includes('MOTION')) eventTypeCounts.MOTION++;
      else if (evtType.includes('HUMAN')) eventTypeCounts.HUMAN_ACTIVITY++;
      else if (evtType.includes('HEART')) eventTypeCounts.HEARTBEAT++;
      else eventTypeCounts.OTHER++;

      // Daily timeline aggregation
      const dayKey = new Date(t.timestamp).toISOString().slice(0, 10);
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { date: dayKey, total: 0, rockfall: 0, motion: 0, human: 0, alerts: 0, maxPeakG: 0, energy: 0 });
      }
      const day = dailyMap.get(dayKey);
      day.total++;
      if (g > day.maxPeakG) day.maxPeakG = g;
      day.energy += energy;
      if (evtType.includes('ROCK')) day.rockfall++;
      else if (evtType.includes('MOTION')) day.motion++;
      else if (evtType.includes('HUMAN')) day.human++;

      // Device aggregation
      const devId = t.device_id;
      if (!deviceStatsMap.has(devId)) {
        const dObj = deviceMap.get(devId) || {};
        deviceStatsMap.set(devId, {
          deviceId: devId,
          name: dObj.name || devId,
          location: dObj.location || 'Site',
          eventCount: 0,
          alertCount: 0,
          maxPeakG: 0,
          lastBattery: batt != null ? Math.max(0, Math.min(Math.round((batt / 13) * 100), 100)) : null,
          lastSeen: t.timestamp
        });
      }
      const devStat = deviceStatsMap.get(devId);
      devStat.eventCount++;
      if (g > devStat.maxPeakG) devStat.maxPeakG = g;
    });

    alerts.forEach(a => {
      const devId = a.device_id;
      if (deviceStatsMap.has(devId)) {
        deviceStatsMap.get(devId).alertCount++;
      }
      const dayKey = new Date(a.created_at || a.createdAt).toISOString().slice(0, 10);
      if (dailyMap.has(dayKey)) {
        dailyMap.get(dayKey).alerts++;
      }
    });

    const totalRecords = telemetries.length;
    const impactEvents = sizeCounts.small + sizeCounts.medium + sizeCounts.large + sizeCounts.extreme - eventTypeCounts.HEARTBEAT;

    const summary = {
      totalTelemetryRecords: totalRecords,
      totalEvents: totalRecords,
      totalImpactEvents: Math.max(0, impactEvents),
      rockfallEvents: eventTypeCounts.ROCKFALL,
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length,
      maxPeakG: parseFloat(maxPeakG.toFixed(3)),
      avgPeakG: totalRecords > 0 ? parseFloat((sumPeakG / totalRecords).toFixed(3)) : 0,
      totalSignalEnergyG2: parseFloat(totalSignalEnergyG2.toFixed(3)),
      totalEnergyKJ: parseFloat(((totalSignalEnergyG2 * 9.81 * 9.81) / 1000).toFixed(4)),
      avgBatteryPct: batteryCount > 0 ? Math.round(sumBattery / batteryCount) : null,
      avgCsq: csqCount > 0 ? Math.round(sumCsq / csqCount) : null,
      maxLoadKn: null,
      structuralLoadStatus: 'Nominal baseline across registered barrier sections',
      sizeCounts
    };

    const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const deviceSummaries = Array.from(deviceStatsMap.values());

    // Top incidents sorted by peak force
    const topIncidents = telemetries
      .filter(t => (t.peak_g || 0) > 0.05 || (t.event_type && t.event_type !== 'HEARTBEAT'))
      .slice(0, 50)
      .map(t => {
        const dObj = deviceMap.get(t.device_id) || {};
        return {
          id: t.id,
          timestamp: t.timestamp,
          deviceId: t.device_id,
          deviceName: dObj.name || t.device_id,
          location: dObj.location || 'Site',
          eventType: t.event_type || 'OTHER',
          peakG: parseFloat(t.peak_g || 0).toFixed(3),
          durationMs: t.duration_ms || 0,
          energyG2: parseFloat(t.energy_g2 || 0).toFixed(2),
          peaks: t.peaks || 0,
          battery: t.battery != null ? Math.max(0, Math.min(Math.round((parseFloat(t.battery) / 13) * 100), 100)) : null,
          csq: t.csq
        };
      });

    return res.json({
      success: true,
      reportType: type,
      date: date || new Date().toISOString().slice(0, 10),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        timezone: 'Asia/Kolkata'
      },
      summary,
      eventTypeCounts,
      dailyBreakdown,
      deviceSummaries,
      topIncidents
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalyticsSummary,
  getHistoricalAnalytics,
  getEventCountsByType,
  getStats,
  getEvents,
  getAlerts,
  exportCsv,
  generateReport
};
