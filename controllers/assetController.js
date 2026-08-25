const { Asset, Device, Telemetry, Organization, Location, Project } = require('../db/models');
const { Op } = require('sequelize');

const segmentDistance = (a, b) => {
  const toRadians = (deg) => deg * Math.PI / 180;
  const lat1 = toRadians(a.lat || a.latitude);
  const lat2 = toRadians(b.lat || b.latitude);
  const dLat = lat2 - lat1;
  const dLng = toRadians((b.lng || b.longitude) - (a.lng || a.longitude));
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const pointAlongPath = (points, positionPct) => {
  if (!points || !points.length) return null;
  if (points.length === 1) return points[0];
  const pct = Math.max(0, Math.min(100, Number(positionPct) || 0));
  const lengths = points.slice(1).map((p, i) => segmentDistance(points[i], p));
  const total = lengths.reduce((sum, l) => sum + l, 0);
  if (total === 0) return points[0];
  const target = total * pct / 100;
  let traversed = 0;
  for (let i = 0; i < lengths.length; i++) {
    const next = traversed + lengths[i];
    if (target <= next || i === lengths.length - 1) {
      const ratio = lengths[i] === 0 ? 0 : (target - traversed) / lengths[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const lat1 = Number(p1.lat || p1.latitude);
      const lng1 = Number(p1.lng || p1.longitude);
      const lat2 = Number(p2.lat || p2.latitude);
      const lng2 = Number(p2.lng || p2.longitude);
      return {
        lat: Number((lat1 + (lat2 - lat1) * ratio).toFixed(6)),
        lng: Number((lng1 + (lng2 - lng1) * ratio).toFixed(6))
      };
    }
    traversed = next;
  }
  return points[points.length - 1];
};

// Get all assets
const getInventory = async (req, res, next) => {
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
      whereClause.id = { [Op.in]: req.user.assigned_assets };
    }

    const orgId = req.query.org_id || req.query.organizationId;
    if (orgId && orgId !== 'undefined' && orgId !== 'null') {
      whereClause.org_id = orgId;
    }
    const locId = req.query.location_id || req.query.locationId;
    if (locId && locId !== 'undefined' && locId !== 'null') {
      whereClause.location_id = locId;
    }
    const prjId = req.query.project_id || req.query.projectId;
    if (prjId && prjId !== 'undefined' && prjId !== 'null') {
      whereClause.project_id = prjId;
    }

    const assets = await Asset.findAll({
      where: whereClause,
      include: [
        { model: Device, as: 'devices' },
        { model: Location, as: 'location', attributes: ['id', 'name', 'lat', 'lng'] },
        { model: Project, as: 'project', attributes: ['id', 'name'] },
        { model: Organization, as: 'organization', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const normalizedAssets = assets.map(a => {
      const plain = a.toJSON ? a.toJSON() : a;
      return {
        ...plain,
        _id: plain.id,
        locationId: plain.location_id,
        organizationId: plain.org_id,
        locationName: plain.location?.name || plain.location_id
      };
    });

    return res.json({ success: true, count: normalizedAssets.length, assets: normalizedAssets });
  } catch (error) {
    next(error);
  }
};

// Get asset by ID
const getAssetById = async (req, res, next) => {
  try {
    const asset = await Asset.findByPk(req.params.id, {
      include: [
        { model: Device, as: 'devices' },
        { model: Location, as: 'location' },
        { model: Project, as: 'project' },
        { model: Organization, as: 'organization' }
      ]
    });

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    return res.json({ success: true, asset });
  } catch (error) {
    next(error);
  }
};

// Create new asset
const createAsset = async (req, res, next) => {
  try {
    const { id, name, org_id, project_id, location_id, locationId, projectId, asset_type, coordinates, specifications, metadata } = req.body;

    const assetId = id || `asset_${Date.now()}`;
    const existing = await Asset.findByPk(assetId);
    if (existing) {
      return res.status(400).json({ success: false, message: `Asset with ID ${assetId} already exists.` });
    }

    const asset = await Asset.create({
      id: assetId,
      name,
      org_id: org_id || (req.user ? req.user.org_id : 'org_default'),
      project_id: project_id || projectId || 'prj_kuppavalasa',
      location_id: location_id || locationId || null,
      asset_type: asset_type || 'FENCE_BARRIER',
      coordinates: coordinates || [],
      specifications: specifications || {},
      metadata: metadata || {}
    });

    return res.status(201).json({ success: true, message: 'Asset created successfully', asset });
  } catch (error) {
    next(error);
  }
};

// Update asset
const updateAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    const { name, asset_type, status, location_id, locationId, project_id, projectId, coordinates, specifications, metadata } = req.body;

    if (name !== undefined) asset.name = name;
    if (asset_type !== undefined) asset.asset_type = asset_type;
    if (status !== undefined) asset.status = status;
    if (location_id !== undefined || locationId !== undefined) asset.location_id = location_id || locationId;
    if (project_id !== undefined || projectId !== undefined) asset.project_id = project_id || projectId;
    if (coordinates !== undefined) asset.coordinates = coordinates;
    if (specifications !== undefined) asset.specifications = specifications;
    if (metadata !== undefined) asset.metadata = metadata;

    await asset.save();

    return res.json({ success: true, message: 'Asset updated successfully', asset });
  } catch (error) {
    next(error);
  }
};

// Delete asset
const deleteAsset = async (req, res, next) => {
  try {
    const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER'];
    if (req.user && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Site and Location users cannot delete assets. Only Project, Organization, or Super Admins can remove barrier assets.'
      });
    }

    const asset = await Asset.findByPk(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    // Detach all devices
    await Device.update({ asset_id: null, asset_position_pct: null }, { where: { asset_id: asset.id } });
    await asset.destroy();

    return res.json({ success: true, message: 'Asset deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// Get available unattached devices
const getAvailableDevices = async (req, res, next) => {
  try {
    const whereClause = { asset_id: null };
    const currentUserRole = req.user?.role;
    if (currentUserRole === 'ORG_ADMIN') {
      whereClause.org_id = req.user.org_id;
    } else if (currentUserRole === 'PROJECT_ADMIN' || currentUserRole === 'PROJECT_USER') {
      whereClause.project_id = req.user.project_id;
    } else if (currentUserRole === 'LOCATION_USER' || currentUserRole === 'SITE_USER') {
      whereClause.location_id = req.user.location_id;
    }

    const devices = await Device.findAll({ where: whereClause });
    return res.json({ success: true, count: devices.length, devices });
  } catch (error) {
    next(error);
  }
};

// Attach device to asset
const attachDevice = async (req, res, next) => {
  try {
    const { assetId, deviceId } = req.params;
    const { assetPositionPct, positionPct, lat, lng } = req.body;

    const asset = await Asset.findByPk(assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    const device = await Device.findByPk(deviceId);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found.' });

    device.asset_id = asset.id;
    if (asset.location_id) device.location_id = asset.location_id;
    if (asset.org_id) device.org_id = asset.org_id;
    if (asset.project_id) device.project_id = asset.project_id;

    const posPct = Number(assetPositionPct ?? positionPct ?? 50);
    device.asset_position_pct = posPct;

    if (lat !== undefined && lng !== undefined && lat !== null && lng !== null) {
      device.lat = Number(lat);
      device.lng = Number(lng);
    } else if (Array.isArray(asset.coordinates) && asset.coordinates.length >= 2) {
      const computedPt = pointAlongPath(asset.coordinates, posPct);
      if (computedPt) {
        device.lat = computedPt.lat;
        device.lng = computedPt.lng;
      }
    }

    await device.save();

    const updatedAsset = await Asset.findByPk(assetId, { include: [{ model: Device, as: 'devices' }] });
    return res.json({ success: true, message: 'Device attached to asset successfully', asset: updatedAsset });
  } catch (error) {
    next(error);
  }
};

// Detach device from asset
const detachDevice = async (req, res, next) => {
  try {
    const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER'];
    if (req.user && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Site and Location users cannot unmount devices. Only Project Admins, Organization Admins, or Super Admins can remove devices.'
      });
    }

    const { assetId, deviceId } = req.params;

    const device = await Device.findByPk(deviceId);
    if (device) {
      device.asset_id = null;
      device.asset_position_pct = null;
      await device.save();
    }

    const updatedAsset = await Asset.findByPk(assetId, { include: [{ model: Device, as: 'devices' }] });
    return res.json({ success: true, message: 'Device detached from asset successfully', asset: updatedAsset });
  } catch (error) {
    next(error);
  }
};

// Get asset attached to a specific device
const getDeviceAsset = async (req, res, next) => {
  try {
    const device = await Device.findByPk(req.params.id, {
      include: [{ model: Asset, as: 'asset', include: [{ model: Device, as: 'devices' }] }]
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    return res.json({
      success: true,
      device,
      asset: device.asset || null
    });
  } catch (error) {
    next(error);
  }
};

// Get asset analysis & analytics
const getAssetAnalysis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { range = '24h' } = req.query;

    const asset = await Asset.findByPk(id, {
      include: [{ model: Device, as: 'devices' }]
    });

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    const deviceIds = (asset.devices || []).map(d => d.id);
    let telemetries = [];

    if (deviceIds.length > 0) {
      const num = parseInt(range) || 24;
      const unit = range.replace(/[0-9]/g, '');
      const startDate = new Date();
      if (unit === 'd') startDate.setDate(startDate.getDate() - num);
      else startDate.setHours(startDate.getHours() - num);

      telemetries = await Telemetry.findAll({
        where: {
          device_id: { [Op.in]: deviceIds },
          timestamp: { [Op.gte]: startDate }
        },
        order: [['timestamp', 'DESC']],
        limit: 500
      });
    }

    const totalEvents = telemetries.length;
    const maxPeakG = telemetries.reduce((m, t) => Math.max(m, t.peak_g || 0), 0);
    const avgPeakG = totalEvents > 0 ? (telemetries.reduce((s, t) => s + (t.peak_g || 0), 0) / totalEvents).toFixed(2) : 0;

    return res.json({
      success: true,
      asset,
      analysis: {
        totalEvents,
        maxPeakG,
        avgPeakG,
        deviceCount: deviceIds.length,
        telemetries
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventory,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getAvailableDevices,
  attachDevice,
  detachDevice,
  getDeviceAsset,
  getAssetAnalysis
};
