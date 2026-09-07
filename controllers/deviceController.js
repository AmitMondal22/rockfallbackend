const { Device, Telemetry, Organization, Location, Asset, Project } = require('../db/models');
const { Op } = require('sequelize');

const formatDevice = (device, latestTelemetry) => {
  if (!device) return null;
  const plain = typeof device.toJSON === 'function' ? device.toJSON() : device;
  const lt = latestTelemetry || null;

  const rawLastSeen = plain.last_seen || (lt && lt.timestamp) || null;
  const rawBattery = (plain.battery !== null && plain.battery !== undefined) ? Number(plain.battery) : (lt && lt.battery !== undefined && lt.battery !== null ? Number(lt.battery) : null);
  const rawCsq = (plain.csq !== null && plain.csq !== undefined) ? Number(plain.csq) : (lt && lt.csq !== undefined && lt.csq !== null ? Number(lt.csq) : null);
  const rawLastEvent = plain.last_event || (lt ? { type: lt.event_type, peak_g: lt.peak_g, duration_ms: lt.duration_ms, timestamp: lt.timestamp } : null);

  return {
    ...plain,
    _id: plain.id,
    id: plain.id,
    organizationId: plain.org_id,
    locationId: plain.location_id,
    projectId: plain.project_id,
    assetId: plain.asset_id,
    asset: plain.asset || null,
    project: plain.project || null,
    lat: plain.lat !== null && plain.lat !== undefined ? Number(plain.lat) : null,
    lng: plain.lng !== null && plain.lng !== undefined ? Number(plain.lng) : null,
    battery: rawBattery,
    csq: rawCsq,
    ratedLoadKn: plain.rated_load_kn !== null && plain.rated_load_kn !== undefined ? Number(plain.rated_load_kn) : null,
    isActive: plain.is_active !== undefined ? plain.is_active : true,
    lastSeen: rawLastSeen,
    last_seen: rawLastSeen,
    lastEvent: rawLastEvent,
    last_event: rawLastEvent,
    lastRestartAt: plain.last_restart_at || null,
    thresholdConfig: {
      MOTION_G: plain.motion_g,
      PEAK_G: plain.peak_g,
      ROCK_PEAK_G: plain.rock_peak_g,
      ROCK_DUR_MS: plain.rock_dur_ms,
      HUMAN_PEAK_MAX_G: plain.human_peak_max_g,
      HUMAN_DUR_MS: plain.human_dur_ms,
      HUMAN_PEAKS: plain.human_peaks
    },
    thresholdVersion: plain.threshold_version || 1
  };
};

const getAllDevices = async (req, res, next) => {
  try {
    const whereClause = {};
    const currentUserRole = req.user?.role;

    if (currentUserRole === 'ORG_ADMIN') {
      whereClause.org_id = req.user.org_id;
    } else if (currentUserRole === 'PROJECT_ADMIN' || currentUserRole === 'PROJECT_USER') {
      whereClause.project_id = req.user.project_id;
    } else if (currentUserRole === 'LOCATION_USER' || currentUserRole === 'SITE_USER') {
      whereClause.location_id = req.user.location_id;
    } else if (currentUserRole === 'ASSET_USER' && Array.isArray(req.user.assigned_assets) && req.user.assigned_assets.length > 0) {
      whereClause.asset_id = { [Op.in]: req.user.assigned_assets };
    }

    if (req.query.asset_id || req.query.assetId) {
      whereClause.asset_id = req.query.asset_id || req.query.assetId;
    }
    if (req.query.location_id || req.query.locationId) {
      whereClause.location_id = req.query.location_id || req.query.locationId;
    }
    if (req.query.project_id || req.query.projectId) {
      whereClause.project_id = req.query.project_id || req.query.projectId;
    }

    const devices = await Device.findAll({
      where: whereClause,
      include: [
        { model: Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: Location, as: 'locationRef', attributes: ['id', 'name', 'address', 'lat', 'lng'] },
        { model: Asset, as: 'asset', attributes: ['id', 'name', 'asset_type', 'status'] },
        { model: Project, as: 'project', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const deviceIds = devices.map(d => d.id);
    const latestTelemetryMap = new Map();
    if (deviceIds.length > 0) {
      const latestTelemetries = await Telemetry.findAll({
        where: { device_id: { [Op.in]: deviceIds } },
        order: [['timestamp', 'DESC']],
        limit: 5000,
        raw: true
      }).catch(() => []);

      latestTelemetries.forEach(t => {
        if (!latestTelemetryMap.has(t.device_id)) {
          latestTelemetryMap.set(t.device_id, t);
        }
      });
    }

    const formatted = devices.map(d => formatDevice(d, latestTelemetryMap.get(d.id)));
    return res.json({ success: true, count: formatted.length, devices: formatted });
  } catch (error) {
    next(error);
  }
};

const getDeviceById = async (req, res, next) => {
  try {
    const device = await Device.findByPk(req.params.id, {
      include: [
        { model: Organization, as: 'organization' },
        { model: Location, as: 'locationRef' },
        { model: Asset, as: 'asset' },
        { model: Project, as: 'project' }
      ]
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const latestTelemetry = await Telemetry.findOne({
      where: { device_id: device.id },
      order: [['timestamp', 'DESC']],
      raw: true
    }).catch(() => null);

    return res.json({ success: true, device: formatDevice(device, latestTelemetry) });
  } catch (error) {
    next(error);
  }
};

const createDevice = async (req, res, next) => {
  try {
    const {
      id, _id, name, dev_eui, org_id, organizationId, location_id, locationId, location,
      asset_id, assetId, project_id, projectId, description,
      lat, lng, battery, csq, ratedLoadKn, rated_load_kn, communication_type,
      motion_g, peak_g, rock_peak_g, rock_dur_ms, human_peak_max_g, human_dur_ms, human_peaks
    } = req.body;

    const deviceId = (id || _id || '').trim();
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Hardware / Device ID is required. Please manually enter a unique ID (e.g. TECHA101).' });
    }

    const existing = await Device.findByPk(deviceId);
    if (existing) {
      return res.status(400).json({ success: false, message: `Device with ID ${deviceId} already exists. Please choose another unique hardware ID.` });
    }

    let finalOrgId = org_id || organizationId || (req.user ? req.user.org_id : 'org_default');
    let finalLocationId = location_id || locationId || null;
    let finalProjectId = project_id || projectId || null;
    const finalAssetId = asset_id || assetId || null;

    // If attached to a barrier asset, auto-resolve location and project if not provided
    if (finalAssetId) {
      const asset = await Asset.findByPk(finalAssetId);
      if (asset) {
        if (!finalLocationId && asset.location_id) finalLocationId = asset.location_id;
        if (!finalProjectId && asset.project_id) finalProjectId = asset.project_id;
        if (!finalOrgId && asset.org_id) finalOrgId = asset.org_id;
      }
    }

    const device = await Device.create({
      id: deviceId,
      name: name || `Sensor ${deviceId}`,
      dev_eui: dev_eui || null,
      org_id: finalOrgId,
      project_id: finalProjectId,
      location_id: finalLocationId,
      asset_id: finalAssetId,
      location: location || '',
      description: description || '',
      lat: lat !== undefined && lat !== null && lat !== '' ? parseFloat(lat) : null,
      lng: lng !== undefined && lng !== null && lng !== '' ? parseFloat(lng) : null,
      battery: battery !== undefined && battery !== null ? parseFloat(battery) : 13.0,
      csq: csq !== undefined && csq !== null ? parseInt(csq) : 28,
      rated_load_kn: rated_load_kn !== undefined ? rated_load_kn : (ratedLoadKn !== undefined ? ratedLoadKn : null),
      communication_type: communication_type || 'HYBRID',
      motion_g: motion_g !== undefined ? motion_g : 0.05,
      peak_g: peak_g !== undefined ? peak_g : 0.20,
      rock_peak_g: rock_peak_g !== undefined ? rock_peak_g : 1.50,
      rock_dur_ms: rock_dur_ms !== undefined ? rock_dur_ms : 200,
      human_peak_max_g: human_peak_max_g !== undefined ? human_peak_max_g : 1.60,
      human_dur_ms: human_dur_ms !== undefined ? human_dur_ms : 500,
      human_peaks: human_peaks !== undefined ? human_peaks : 3,
      threshold_version: 1,
      status: 'ONLINE'
    });

    const refreshed = await Device.findByPk(deviceId, {
      include: [
        { model: Organization, as: 'organization' },
        { model: Location, as: 'locationRef' },
        { model: Asset, as: 'asset' },
        { model: Project, as: 'project' }
      ]
    });

    return res.status(201).json({
      success: true,
      message: 'Device created and registered successfully',
      device: formatDevice(refreshed)
    });
  } catch (error) {
    next(error);
  }
};

const updateDeviceThreshold = async (req, res, next) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const fields = [
      'motion_g', 'peak_g', 'rock_peak_g', 'rock_dur_ms',
      'human_peak_max_g', 'human_dur_ms', 'human_peaks', 'communication_type'
    ];

    let updated = false;
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        device[field] = req.body[field];
        updated = true;
      }
    });

    if (updated) {
      device.threshold_version = (device.threshold_version || 1) + 1;
      await device.save();
    }

    return res.json({
      success: true,
      message: 'Device thresholds updated successfully',
      device: formatDevice(device)
    });
  } catch (error) {
    next(error);
  }
};

const getDeviceThreshold = async (req, res, next) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    return res.json({
      status: 'OK',
      uid: device.id,
      thresholdVersion: device.threshold_version,
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

const updateDevice = async (req, res, next) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const {
      name, location, location_id, locationId, asset_id, assetId, project_id, projectId,
      communication_type, status, dev_eui, org_id, organizationId,
      description, lat, lng, battery, csq, ratedLoadKn, rated_load_kn
    } = req.body;

    if (name !== undefined) device.name = name;
    if (location !== undefined) device.location = location;
    if (location_id !== undefined || locationId !== undefined) device.location_id = location_id || locationId;
    if (asset_id !== undefined || assetId !== undefined) device.asset_id = asset_id || assetId;
    if (project_id !== undefined || projectId !== undefined) device.project_id = project_id || projectId;
    if (description !== undefined) device.description = description;
    if (lat !== undefined) device.lat = lat !== '' && lat !== null ? parseFloat(lat) : null;
    if (lng !== undefined) device.lng = lng !== '' && lng !== null ? parseFloat(lng) : null;
    if (battery !== undefined) device.battery = battery !== null ? parseFloat(battery) : null;
    if (csq !== undefined) device.csq = csq !== null ? parseInt(csq) : null;
    if (rated_load_kn !== undefined || ratedLoadKn !== undefined) device.rated_load_kn = rated_load_kn !== undefined ? rated_load_kn : ratedLoadKn;
    if (communication_type !== undefined) device.communication_type = communication_type;
    if (status !== undefined) device.status = status;
    if (dev_eui !== undefined) device.dev_eui = dev_eui;
    if ((org_id !== undefined || organizationId !== undefined) && req.user?.role === 'SUPER_ADMIN') {
      device.org_id = org_id || organizationId;
    }

    await device.save();

    const refreshed = await Device.findByPk(device.id, {
      include: [
        { model: Organization, as: 'organization' },
        { model: Location, as: 'locationRef' },
        { model: Asset, as: 'asset' },
        { model: Project, as: 'project' }
      ]
    });

    return res.json({ success: true, message: 'Device updated successfully', device: formatDevice(refreshed) });
  } catch (error) {
    next(error);
  }
};

const deleteDevice = async (req, res, next) => {
  try {
    const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER'];
    if (req.user && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Site, Location, and Asset users cannot delete devices. Only Project Admins, Organization Admins, or Super Admins can remove devices.'
      });
    }

    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    await device.destroy();
    return res.json({ success: true, message: 'Device deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDeviceThreshold,
  getDeviceThreshold,
  updateDevice,
  deleteDevice
};
