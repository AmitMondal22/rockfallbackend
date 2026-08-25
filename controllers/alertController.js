const { Op } = require('sequelize');
const { Alert, AlertRule, Device, Organization } = require('../db/models');
const { broadcast } = require('../websocket/wsServer');

const getActiveAlerts = async (req, res, next) => {
  try {
    const {
      status,
      severity,
      device_id,
      deviceId,
      event_type,
      eventType,
      search,
      range,
      fromDate,
      toDate,
      page = 1,
      limit = 200
    } = req.query;

    const whereClause = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (severity) {
      whereClause.severity = severity;
    }
    if (device_id || deviceId) {
      whereClause.device_id = device_id || deviceId;
    }
    if (event_type || eventType) {
      whereClause.event_type = event_type || eventType;
    }
    if (req.user && req.user.role === 'ORG_ADMIN') {
      whereClause.org_id = req.user.org_id;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { id: { [Op.iLike]: term } },
        { device_id: { [Op.iLike]: term } },
        { message: { [Op.iLike]: term } },
        { event_type: { [Op.iLike]: term } }
      ];
    }

    // Date range filtering on created_at
    let startDate = null;
    let endDate = null;

    if (fromDate) {
      startDate = new Date(fromDate);
      if (fromDate.length === 10) startDate.setHours(0, 0, 0, 0);
    }
    if (toDate) {
      endDate = new Date(toDate);
      if (toDate.length === 10) endDate.setHours(23, 59, 59, 999);
    }

    if (!startDate && !endDate && range && range !== 'all' && range !== 'custom') {
      const now = new Date();
      if (range === '24h') startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      else if (range === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (range === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = startDate;
      if (endDate) whereClause.created_at[Op.lte] = endDate;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let { count, rows: rawAlerts } = await Alert.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      include: [{ model: Device, as: 'device', attributes: ['id', 'name', 'location'] }]
    });

    // Fallback: If querying default relative window and 0 results found, show available records
    if (count === 0 && !fromDate && !toDate && range && range !== 'all') {
      const fallbackWhere = { ...whereClause };
      delete fallbackWhere.created_at;
      const fallbackResult = await Alert.findAndCountAll({
        where: fallbackWhere,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
        include: [{ model: Device, as: 'device', attributes: ['id', 'name', 'location'] }]
      });
      if (fallbackResult.count > 0) {
        count = fallbackResult.count;
        rawAlerts = fallbackResult.rows;
      }
    }

    const alerts = rawAlerts.map(a => {
      const alertJson = a.toJSON ? a.toJSON() : a;
      const ts = (a.dataValues && a.dataValues.created_at) || alertJson.created_at || a.created_at || a.createdAt || alertJson.createdAt || new Date().toISOString();
      const updatedTs = (a.dataValues && a.dataValues.updated_at) || alertJson.updated_at || a.updated_at || a.updatedAt || alertJson.updatedAt || new Date().toISOString();
      return {
        ...alertJson,
        _id: alertJson.id,
        deviceId: alertJson.device_id || alertJson.deviceId,
        orgId: alertJson.org_id || alertJson.orgId,
        eventType: alertJson.event_type || alertJson.eventType,
        ruleId: alertJson.rule_id || alertJson.ruleId,
        createdAt: ts,
        created_at: ts,
        updatedAt: updatedTs,
        updated_at: updatedTs,
        triggerData: alertJson.trigger_data || alertJson.triggerData
      };
    });

    // Summary counts for current scope
    const summaryWhere = { ...(req.user && req.user.role === 'ORG_ADMIN' ? { org_id: req.user.org_id } : {}) };
    if (startDate || endDate) {
      summaryWhere.created_at = {};
      if (startDate) summaryWhere.created_at[Op.gte] = startDate;
      if (endDate) summaryWhere.created_at[Op.lte] = endDate;
    }

    const [activeCount, ackCount, resolvedCount, criticalOpenCount] = await Promise.all([
      Alert.count({ where: { ...summaryWhere, status: 'ACTIVE' } }),
      Alert.count({ where: { ...summaryWhere, status: 'ACKNOWLEDGED' } }),
      Alert.count({ where: { ...summaryWhere, status: 'RESOLVED' } }),
      Alert.count({ where: { ...summaryWhere, status: { [Op.ne]: 'RESOLVED' }, severity: { [Op.in]: ['CRITICAL', 'HIGH'] } } })
    ]);

    return res.json({
      success: true,
      total: count,
      count,
      page: parseInt(page),
      limit: parseInt(limit),
      summary: {
        total: count,
        active: activeCount,
        acknowledged: ackCount,
        resolved: resolvedCount,
        criticalOpen: criticalOpenCount
      },
      alerts
    });
  } catch (error) {
    next(error);
  }
};

const acknowledgeAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    alert.status = 'ACKNOWLEDGED';
    await alert.save();

    const normalized = {
      ...alert.toJSON(),
      _id: alert.id,
      deviceId: alert.device_id,
      orgId: alert.org_id,
      eventType: alert.event_type,
      ruleId: alert.rule_id,
      createdAt: alert.created_at,
      updatedAt: alert.updated_at
    };

    broadcast({
      type: 'alert_update',
      event: 'ALERT_ACKNOWLEDGED',
      data: normalized,
      timestamp: new Date().toISOString()
    });

    return res.json({ success: true, message: 'Alert acknowledged successfully.', alert: normalized });
  } catch (error) {
    next(error);
  }
};

const resolveAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    alert.status = 'RESOLVED';
    await alert.save();

    // Check if device has any other active alerts
    const activeCount = await Alert.count({
      where: { device_id: alert.device_id, status: 'ACTIVE' }
    });

    if (activeCount === 0) {
      const device = await Device.findByPk(alert.device_id);
      if (device) {
        device.status = 'ONLINE';
        await device.save();
      }
    }

    const normalized = {
      ...alert.toJSON(),
      _id: alert.id,
      deviceId: alert.device_id,
      orgId: alert.org_id,
      eventType: alert.event_type,
      ruleId: alert.rule_id,
      createdAt: alert.created_at,
      updatedAt: alert.updated_at
    };

    broadcast({
      type: 'alert_update',
      event: 'ALERT_RESOLVED',
      data: normalized,
      timestamp: new Date().toISOString()
    });

    return res.json({ success: true, message: 'Alert resolved successfully.', alert: normalized });
  } catch (error) {
    next(error);
  }
};

// Alert Rules Controllers
const getAlertRules = async (req, res, next) => {
  try {
    const rules = await AlertRule.findAll({
      include: [{ model: Device, as: 'device', attributes: ['id', 'name'] }]
    });
    const normalized = rules.map(r => ({
      ...r.toJSON(),
      _id: r.id,
      deviceId: r.device_id,
      orgId: r.org_id,
      eventType: r.event_type,
      isActive: r.enabled
    }));
    return res.json({ success: true, count: normalized.length, rules: normalized });
  } catch (error) {
    next(error);
  }
};

const createAlertRule = async (req, res, next) => {
  try {
    const { name, org_id, organizationId, device_id, deviceId, event_type, eventType, min_peak_g, max_peak_g, min_dur_ms, severity, enabled, isActive } = req.body;
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const rule = await AlertRule.create({
      id: ruleId,
      name,
      org_id: org_id || organizationId || (req.user ? req.user.org_id : null),
      device_id: device_id || deviceId || null,
      event_type: event_type || eventType || 'ROCKFALL',
      min_peak_g: min_peak_g !== undefined ? min_peak_g : 1.50,
      max_peak_g: max_peak_g || null,
      min_dur_ms: min_dur_ms !== undefined ? min_dur_ms : 100,
      severity: severity || 'CRITICAL',
      enabled: enabled !== undefined ? enabled : (isActive !== undefined ? isActive : true)
    });

    const normalized = {
      ...rule.toJSON(),
      _id: rule.id,
      deviceId: rule.device_id,
      orgId: rule.org_id,
      eventType: rule.event_type,
      isActive: rule.enabled
    };

    return res.status(201).json({ success: true, message: 'Alert rule created successfully', rule: normalized });
  } catch (error) {
    next(error);
  }
};

const updateAlertRule = async (req, res, next) => {
  try {
    const rule = await AlertRule.findByPk(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Alert rule not found.' });
    }

    const { name, min_peak_g, max_peak_g, min_dur_ms, severity, enabled, isActive } = req.body;
    if (name !== undefined) rule.name = name;
    if (min_peak_g !== undefined) rule.min_peak_g = min_peak_g;
    if (max_peak_g !== undefined) rule.max_peak_g = max_peak_g;
    if (min_dur_ms !== undefined) rule.min_dur_ms = min_dur_ms;
    if (severity !== undefined) rule.severity = severity;
    if (enabled !== undefined) rule.enabled = enabled;
    if (isActive !== undefined) rule.enabled = isActive;

    await rule.save();

    const normalized = {
      ...rule.toJSON(),
      _id: rule.id,
      deviceId: rule.device_id,
      orgId: rule.org_id,
      eventType: rule.event_type,
      isActive: rule.enabled
    };

    return res.json({ success: true, message: 'Alert rule updated successfully.', rule: normalized });
  } catch (error) {
    next(error);
  }
};

const deleteAlertRule = async (req, res, next) => {
  try {
    const rule = await AlertRule.findByPk(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Alert rule not found.' });
    }

    await rule.destroy();
    return res.json({ success: true, message: 'Alert rule deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveAlerts,
  acknowledgeAlert,
  resolveAlert,
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule
};
